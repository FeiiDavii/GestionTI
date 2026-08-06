<?php
class AuthController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? $_POST['username'] ?? '');
        $password = trim($input['password'] ?? $_POST['password'] ?? '');
        
        if (empty($username)) json_error('Por favor ingrese su nombre de usuario o correo electrónico', 400);
        if (empty($password)) json_error('Por favor ingrese su contraseña', 400);
        
        $user = Auth::login($this->pdo, $username, $password);
        if ($user) {
            $esAdmin = ($user['inv_ver'] || $user['tk_ver_global'] || $user['tk_responder'] || $user['usr_ver'] || $user['rep_generar'] || $user['conf_basica']);
            registrar_log($this->pdo, $user['id'], 'sesiones', "Inicio de sesión: {$user['username']} ({$user['nombre_completo']})");
            json_success([
                'id' => $user['id'],
                'username' => $user['username'],
                'nombre' => $user['nombre_completo'],
                'role' => $user['id_rol'],
                'permisos' => $_SESSION['permisos'],
                'redirect' => $esAdmin ? '/dashboard' : '/tickets'
            ]);
        }
        json_error('El nombre de usuario o contraseña son incorrectos. Por favor verifique sus credenciales e intente nuevamente.', 401);
    }

    public function logout() {
        // Limpiar force_logout ANTES de destruir la sesión
        // Garantiza que el usuario pueda volver a iniciar sesión
        if (session_status() === PHP_SESSION_NONE) {
            session_name('PHPSESSID');
            session_start();
        }
        $userId = $_SESSION['user_id'] ?? null;
        if ($userId) {
            $this->pdo->prepare("UPDATE usuarios SET force_logout = 0 WHERE id = ?")->execute([$userId]);
        }
        Auth::logout();
        json_success(null, 'Sesión cerrada');
    }

    public function me() {
        Auth::requireLogin();
        Auth::checkForceLogout($this->pdo);
        // Refrescar permisos desde BD: evita servir permisos estancados en sesión
        // cuando un admin modifica la matriz de un rol.
        $permisos = Auth::getPermissions($this->pdo);
        $user = Auth::getUser($this->pdo);
        if (!$user) json_error('Usuario no encontrado', 404);
        // Obtener ultimo_acceso directamente
        $stmt = $this->pdo->prepare("SELECT ultimo_acceso FROM usuarios WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $ultimo_acceso = $stmt->fetchColumn();
        
        json_success([
            'id' => $user['id'],
            'username' => $user['username'],
            'nombre' => $user['nombre'],
            'id_rol' => $user['id_rol'],
            'role' => $user['role'],
            'estado' => $user['estado'],
            'ultimo_acceso' => $ultimo_acceso,
            'permisos' => $permisos
        ]);
    }

    public function permisos() {
        Auth::requireLogin();
        json_success($_SESSION['permisos'] ?? []);
    }

    public function recovery() {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        if (empty($username)) json_error('Por favor ingrese su nombre de usuario para solicitar la recuperación de contraseña', 400);
        if (strlen($username) < 3) json_error('El nombre de usuario debe tener al menos 3 caracteres', 400);

        $stmt = $this->pdo->prepare("SELECT id, nombre_completo, estado FROM usuarios WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user) json_error('El nombre de usuario "' . htmlspecialchars($username) . '" no existe en el sistema. Por favor verifique e intente nuevamente.', 404);
        if ($user['estado'] != 1) json_error('El usuario "' . htmlspecialchars($username) . '" se encuentra inactivo. Contacte al administrador del sistema.', 403);

        // Notificar a administradores
        $admins = $this->pdo->query("SELECT id FROM usuarios WHERE id_rol = 1 AND estado = 1")->fetchAll();
        if (empty($admins)) json_error('No hay administradores activos en el sistema para gestionar su solicitud. Contacte al soporte técnico.', 500);
        
        foreach ($admins as $admin) {
            $stmt = $this->pdo->prepare("INSERT INTO notificaciones (id_destinatario, id_remitente, titulo, mensaje, tipo) VALUES (?, ?, ?, ?, 'personal')");
            $stmt->execute([$admin['id'], $user['id'], 'Solicitud de recuperación de contraseña',
                "El usuario {$user['nombre_completo']} ($username) ha solicitado recuperar su contraseña. Por favor, gestione el cambio."]);
        }
        json_success(null, 'Solicitud enviada correctamente. Se ha notificado a los administradores y recibirán su solicitud de recuperación de contraseña.');
    }

    public function changePassword() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $current = $input['current_password'] ?? '';
        $new = $input['new_password'] ?? '';
        $confirm = $input['confirm_password'] ?? '';

        if (empty($current)) json_error('Por favor ingrese su contraseña actual', 400);
        if (empty($new)) json_error('Por favor ingrese la nueva contraseña', 400);
        if (empty($confirm)) json_error('Por favor confirme la nueva contraseña', 400);

        $stmt = $this->pdo->prepare("SELECT password FROM usuarios WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $db_pass = $stmt->fetchColumn();

        if (!password_verify($current, $db_pass))
            json_error('La contraseña actual ingresada es incorrecta. Por favor verifique e intente nuevamente.', 401);
        if ($new !== $confirm) json_error('La nueva contraseña y la confirmación no coinciden. Por favor asegúrese de que sean iguales.', 400);
        if ($current === $new) json_error('La nueva contraseña no puede ser igual a la actual. Por favor ingrese una contraseña diferente.', 400);
        if (strlen($new) < 4) json_error('La nueva contraseña debe tener al menos 4 caracteres. Por favor ingrese una contraseña más segura.', 400);

        $hash = password_hash($new, PASSWORD_DEFAULT);
        $this->pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?")->execute([$hash, $_SESSION['user_id']]);
        registrar_log($this->pdo, $_SESSION['user_id'], 'sesiones', "Cambio de contraseña realizado por el usuario ID: {$_SESSION['user_id']}");
        json_success(null, 'Contraseña actualizada exitosamente. Ahora puede iniciar sesión con su nueva contraseña.');
    }

    public function profileStats() {
        Auth::requireLogin();
        $uid = (int)$_SESSION['user_id'];

        // Tickets creados por el usuario
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM tickets WHERE usuario_id = ?");
        $stmt->execute([$uid]);
        $tickets_creados = (int)$stmt->fetchColumn();

        // Tickets resueltos o cerrados del usuario
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM tickets WHERE usuario_id = ? AND estado IN ('Resuelto','Cerrado')");
        $stmt->execute([$uid]);
        $tickets_resueltos = (int)$stmt->fetchColumn();

        // Equipos asignados al funcionario vinculado al usuario
        $stmt = $this->pdo->prepare("SELECT id_funcionario FROM usuarios WHERE id = ?");
        $stmt->execute([$uid]);
        $id_funcionario = $stmt->fetchColumn();
        $equipos_asignados = 0;
        if ($id_funcionario) {
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM equipos_de_computo WHERE id_usuario = ?");
            $stmt->execute([$id_funcionario]);
            $equipos_asignados = (int)$stmt->fetchColumn();
        }

        // Mantenimientos/acciones registradas por el usuario en historial_equipos
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM historial_equipos WHERE usuario_id = ?");
        $stmt->execute([$uid]);
        $mantenimientos = (int)$stmt->fetchColumn();

        // Último acceso
        $stmt = $this->pdo->prepare("SELECT ultimo_acceso FROM usuarios WHERE id = ?");
        $stmt->execute([$uid]);
        $ultimo_acceso = $stmt->fetchColumn();

        json_success([
            'tickets_creados'           => $tickets_creados,
            'tickets_resueltos'         => $tickets_resueltos,
            'equipos_asignados'         => $equipos_asignados,
            'mantenimientos_realizados' => $mantenimientos,
            'ultimo_acceso'             => $ultimo_acceso ?: null,
        ]);
    }
}
