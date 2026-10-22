<?php
class Auth {
    /**
     * Fuente única de verdad: columnas de permisos (PBAC) en la tabla roles.
     * Agregar/renombrar un permiso solo requiere editar esta lista.
     */
    const PERMISSIONS = [
        'inv_ver', 'inv_crear_editar', 'inv_eliminar', 'inv_asignaciones',
        'inv_licencias', 'inv_bajas', 'inv_topology',
        'tk_ver_global', 'tk_responder', 'tk_asignar_otros', 'tk_mantenimientos', 'tk_crear',
        'usr_ver', 'usr_gestionar', 'rep_generar',
        'conf_basica', 'conf_roles', 'conf_avanzada', 'conf_sla',
    ];

    /** ID del usuario superadministrador: inalterable y con todos los permisos siempre */
    const ADMIN_USER_ID = 1;

    /** Columnas r.<permiso> listas para un SELECT */
    private static function permissionColumnsSql() {
        return implode(', ', array_map(function ($p) { return "r.$p"; }, self::PERMISSIONS));
    }

    /** Construye el mapa limpio de permisos (bool) desde una fila de resultados */
    private static function buildPermissionsArray($row) {
        $permisos = [];
        foreach (self::PERMISSIONS as $p) {
            $permisos[$p] = !empty($row[$p]);
        }
        return $permisos;
    }

    /** Permisos completos (todo en true): solo aplica al superadministrador */
    private static function allPermissions() {
        return array_fill_keys(self::PERMISSIONS, true);
    }

    /** El superadministrador (id 1) siempre tiene todos los permisos, sin importar su rol */
    public static function isSuperAdmin($userId) {
        return (int)$userId === self::ADMIN_USER_ID;
    }

    public static function requireLogin() {
        if (session_status() === PHP_SESSION_NONE) {
            ini_set('session.cookie_path', '/');
            ini_set('session.cookie_samesite', 'Lax');
            session_name('PHPSESSID');
            session_start();
        }
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'No autenticado']);
            exit;
        }
        return $_SESSION['user_id'];
    }

    public static function checkForceLogout($pdo) {
        $stmt = $pdo->prepare("SELECT force_logout FROM usuarios WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $reason = (int)$stmt->fetchColumn();
        if ($reason > 0) {
            $pdo->prepare("UPDATE usuarios SET force_logout = 0 WHERE id = ?")->execute([$_SESSION['user_id']]);
            session_unset();
            session_destroy();
            http_response_code(401);
            echo json_encode([
                'success' => false, 
                'message' => 'Sesión terminada. Por favor, inicia sesión nuevamente.', 
                'reason' => $reason
            ]);
            exit;
        }
    }

    public static function getPermissions($pdo) {
        if (self::isSuperAdmin($_SESSION['user_id'])) {
            $permisos = self::allPermissions();
            $_SESSION['permisos'] = $permisos;
            return $permisos;
        }
        $stmt = $pdo->prepare("SELECT " . self::permissionColumnsSql() . " FROM usuarios u LEFT JOIN roles r ON u.id_rol = r.id WHERE u.id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $permisos = self::buildPermissionsArray($row);
        $_SESSION['permisos'] = $permisos;
        return $permisos;
    }

    public static function getUser($pdo) {
        $stmt = $pdo->prepare("SELECT u.id, u.username, u.nombre_completo as nombre, u.id_rol, u.estado, r.nombre_rol as role, " .
            self::permissionColumnsSql() . "
            FROM usuarios u LEFT JOIN roles r ON u.id_rol = r.id WHERE u.id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function login($pdo, $username, $password) {
        $sql = "SELECT u.*, " . self::permissionColumnsSql() . "
                FROM usuarios u LEFT JOIN roles r ON u.id_rol = r.id WHERE u.username = ? AND u.estado = 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password'])) {
            // Actualizar último acceso y limpiar force_logout al iniciar sesión
            $pdo->prepare("UPDATE usuarios SET ultimo_acceso = NOW(), force_logout = 0 WHERE id = ?")->execute([$user['id']]);
            
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['id_rol'];
            $_SESSION['nombre'] = $user['nombre_completo'];
            $_SESSION['permisos'] = self::isSuperAdmin($user['id'])
                ? self::allPermissions()
                : self::buildPermissionsArray($user);
            return $user;
        }
        return null;
    }

    public static function logout() {
        if (session_status() === PHP_SESSION_NONE) {
            ini_set('session.cookie_path', '/');
            session_name('PHPSESSID');
            session_start();
        }
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, '/', $params["domain"], $params["secure"], $params["httponly"]);
        }
        session_destroy();
    }
}
