<?php
class Auth {
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
        $stmt = $pdo->prepare("SELECT r.* FROM usuarios u LEFT JOIN roles r ON u.id_rol = r.id WHERE u.id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $permisos = $stmt->fetch(PDO::FETCH_ASSOC);
        $_SESSION['permisos'] = $permisos;
        return $permisos;
    }

    public static function getUser($pdo) {
        $stmt = $pdo->prepare("SELECT u.id, u.username, u.nombre_completo as nombre, u.id_rol, u.estado, r.nombre_rol as role,
            r.inv_ver, r.inv_crear_editar, r.inv_eliminar, r.inv_asignaciones, r.inv_licencias, r.inv_bajas,
            r.tk_ver_global, r.tk_responder, r.tk_asignar_otros, r.tk_mantenimientos, r.tk_crear,
            r.usr_ver, r.usr_gestionar, r.rep_generar, r.conf_basica, r.conf_roles, r.conf_avanzada, r.conf_sla
            FROM usuarios u LEFT JOIN roles r ON u.id_rol = r.id WHERE u.id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function login($pdo, $username, $password) {
        $sql = "SELECT u.*, r.inv_ver, r.inv_crear_editar, r.inv_eliminar, r.inv_asignaciones, 
                r.inv_licencias, r.inv_bajas, r.tk_ver_global, r.tk_responder, 
                r.tk_asignar_otros, r.tk_mantenimientos, r.tk_crear, r.usr_ver, r.usr_gestionar, 
                r.rep_generar, r.conf_basica, r.conf_roles, r.conf_avanzada, r.conf_sla
                FROM usuarios u LEFT JOIN roles r ON u.id_rol = r.id WHERE u.username = ? AND u.estado = 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && ($password === $user['password'] || password_verify($password, $user['password']))) {
            // Actualizar último acceso y limpiar force_logout al iniciar sesión
            $pdo->prepare("UPDATE usuarios SET ultimo_acceso = NOW(), force_logout = 0 WHERE id = ?")->execute([$user['id']]);
            
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['id_rol'];
            $_SESSION['nombre'] = $user['nombre_completo'];
            $_SESSION['permisos'] = [
                'inv_ver' => (bool)$user['inv_ver'], 'inv_crear_editar' => (bool)$user['inv_crear_editar'],
                'inv_eliminar' => (bool)$user['inv_eliminar'], 'inv_asignaciones' => (bool)$user['inv_asignaciones'],
                'inv_licencias' => (bool)$user['inv_licencias'], 'inv_bajas' => (bool)$user['inv_bajas'],
                'tk_ver_global' => (bool)$user['tk_ver_global'], 'tk_responder' => (bool)$user['tk_responder'],
                'tk_asignar_otros' => (bool)$user['tk_asignar_otros'], 'tk_mantenimientos' => (bool)$user['tk_mantenimientos'],
                'tk_crear' => (bool)$user['tk_crear'], 'usr_ver' => (bool)$user['usr_ver'],
                'usr_gestionar' => (bool)$user['usr_gestionar'], 'rep_generar' => (bool)$user['rep_generar'],
                'conf_basica' => (bool)$user['conf_basica'], 'conf_roles' => (bool)$user['conf_roles'],
                'conf_avanzada' => (bool)$user['conf_avanzada'], 'conf_sla' => (bool)$user['conf_sla']
            ];
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
