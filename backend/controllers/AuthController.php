<?php
class AuthController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? $_POST['username'] ?? '');
        $password = trim($input['password'] ?? $_POST['password'] ?? '');
        $user = Auth::login($this->pdo, $username, $password);
        if ($user) {
            $esAdmin = ($user['inv_ver'] || $user['tk_ver_global'] || $user['tk_responder'] || $user['usr_ver'] || $user['rep_generar'] || $user['conf_basica']);
            json_success([
                'id' => $user['id'],
                'username' => $user['username'],
                'nombre' => $user['nombre_completo'],
                'role' => $user['id_rol'],
                'permisos' => $_SESSION['permisos'],
                'redirect' => $esAdmin ? '/dashboard' : '/tickets'
            ]);
        }
        json_error('Credenciales incorrectas', 401);
    }

    public function logout() {
        Auth::logout();
        json_success(null, 'Sesión cerrada');
    }

    public function me() {
        Auth::requireLogin();
        Auth::checkForceLogout($this->pdo);
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
            'permisos' => $_SESSION['permisos'] ?? []
        ]);
    }

    public function permisos() {
        Auth::requireLogin();
        json_success($_SESSION['permisos'] ?? []);
    }

    public function recovery() {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        if (empty($username)) json_error('Debe ingresar un nombre de usuario');

        $stmt = $this->pdo->prepare("SELECT id, nombre_completo FROM usuarios WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user) json_error('Usuario no encontrado', 404);

        // Notificar a administradores
        $admins = $this->pdo->query("SELECT id FROM usuarios WHERE id_rol = 1 AND estado = 1")->fetchAll();
        foreach ($admins as $admin) {
            $stmt = $this->pdo->prepare("INSERT INTO notificaciones (id_destinatario, id_remitente, titulo, mensaje, tipo) VALUES (?, ?, ?, ?, 'personal')");
            $stmt->execute([$admin['id'], $user['id'], 'Solicitud de recuperación de contraseña',
                "El usuario {$user['nombre_completo']} ($username) ha solicitado recuperar su contraseña. Por favor, gestione el cambio."]);
        }
        json_success(null, 'Se ha notificado a los administradores. Espere a que gestionen su solicitud.');
    }

    public function changePassword() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $current = $input['current_password'] ?? '';
        $new = $input['new_password'] ?? '';
        $confirm = $input['confirm_password'] ?? '';

        $stmt = $this->pdo->prepare("SELECT password FROM usuarios WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $db_pass = $stmt->fetchColumn();

        if (!($current === $db_pass || password_verify($current, $db_pass)))
            json_error('La contraseña actual es incorrecta');
        if ($new !== $confirm) json_error('Las nuevas contraseñas no coinciden');
        if (strlen($new) < 4) json_error('La nueva contraseña es muy corta');

        $hash = password_hash($new, PASSWORD_DEFAULT);
        $this->pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?")->execute([$hash, $_SESSION['user_id']]);
        json_success(null, 'Contraseña actualizada correctamente');
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
