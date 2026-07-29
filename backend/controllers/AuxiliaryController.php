<?php
class AuxiliaryController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function areas() {
        Auth::requireLogin();
        json_success($this->pdo->query("SELECT * FROM areas ORDER BY nombre_area")->fetchAll());
    }
    public function marcas() {
        Auth::requireLogin();
        json_success($this->pdo->query("SELECT * FROM marcas ORDER BY nombre_marca")->fetchAll());
    }
    public function tipos() {
        Auth::requireLogin();
        json_success($this->pdo->query("SELECT * FROM tipos ORDER BY tipo")->fetchAll());
    }
    public function configuraciones() {
        Auth::requireLogin();
        // Retorna info del sistema + estadísticas (como el old IAV2)
        $tables = ['usuarios', 'roles', 'equipos_de_computo', 'asignaciones', 'acciones', 'funcionarios', 'areas', 'sla_config'];
        $db = [];
        foreach ($tables as $table) {
            $db['total_' . $table] = (int)$this->pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
        }
        $lastBackup = $this->pdo->query("SELECT MAX(fecha) FROM acciones WHERE tabla='sistema' AND descripcion LIKE 'Backup%'")->fetchColumn();
        json_success([
            'version' => 'v3.9.0',
            'host' => 'localhost',
            'db' => 'MySQL',
            'totalUsuarios' => $db['total_usuarios'] ?? 0,
            'totalEquipos'  => $db['total_equipos_de_computo'] ?? 0,
            'lastBackup'    => $lastBackup ?: 'Nunca',
            'backupSize'    => '—',
        ]);
    }

    public function hardwareConfigs() {
        Auth::requireLogin();
        json_success($this->pdo->query("SELECT * FROM configuraciones ORDER BY ram_rom")->fetchAll());
    }
    public function funcionarios() {
        Auth::requireLogin();
        json_success($this->pdo->query("SELECT f.id, f.nombre, f.apellido, f.celular, f.id_area, a.nombre_area FROM funcionarios f LEFT JOIN areas a ON f.id_area=a.id ORDER BY f.nombre")->fetchAll());
    }

    public function users() {
        Auth::requireLogin();
        Permission::requireAny(['usr_ver', 'usr_gestionar']);
        // Mapear campos para el frontend React
        $users = $this->pdo->query(
            "SELECT u.id, u.nombre_completo as nombre, u.username, u.estado as activo,
                    u.id_rol as role_id, r.nombre_rol as rol_nombre,
                    u.id_funcionario, u.force_logout
             FROM usuarios u
             LEFT JOIN roles r ON u.id_rol=r.id
             ORDER BY u.nombre_completo"
        )->fetchAll();
        $roles = $this->pdo->query("SELECT id, nombre_rol as nombre, descripcion FROM roles ORDER BY nombre_rol")->fetchAll();
        $funcionarios = $this->pdo->query(
            "SELECT id, CONCAT(nombre, ' ', apellido) as nombre_completo FROM funcionarios ORDER BY nombre"
        )->fetchAll();
        json_success(compact('users', 'roles', 'funcionarios'));
    }

    public function saveUser() {
        Auth::requireLogin();
        Permission::require('usr_gestionar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $nombre = sanitize_input($input['nombre'] ?? '', 'string', 150);
        $username = sanitize_input($input['username'] ?? '', 'username', 50);
        // Soporta role_id (React) y rol (legacy)
        $rol = (int)($input['role_id'] ?? $input['rol'] ?? 3);
        $id_funcionario = !empty($input['id_funcionario']) ? (int)$input['id_funcionario'] : null;
        // Soporta user_id (legacy) e id (React)
        $user_id = !empty($input['user_id']) ? (int)$input['user_id'] : (!empty($input['id']) ? (int)$input['id'] : null);
        $password = $input['password'] ?? null;

        if (empty($nombre) || empty($username)) json_error('Nombre y usuario son obligatorios.');

        // Check duplicate username
        $checkSql = $user_id ? "SELECT id FROM usuarios WHERE username=? AND id!=?" : "SELECT id FROM usuarios WHERE username=?";
        $checkParams = $user_id ? [$username, $user_id] : [$username];
        $stmt = $this->pdo->prepare($checkSql); $stmt->execute($checkParams);
        if ($stmt->fetch()) json_error("El usuario '$username' ya está en uso.");

        try {
            if ($user_id) {
                if ($user_id == $_SESSION['user_id']) json_error('No puedes editar tu propio usuario desde este panel. Ve a Perfil.');
                $old_rol = $this->pdo->query("SELECT id_rol FROM usuarios WHERE id=$user_id")->fetchColumn();
                if ($password && strlen($password) >= 6) {
                    $hash = password_hash($password, PASSWORD_DEFAULT);
                    $this->pdo->prepare("UPDATE usuarios SET nombre_completo=?, username=?, id_rol=?, id_funcionario=?, password=? WHERE id=?")
                        ->execute([$nombre, $username, $rol, $id_funcionario, $hash, $user_id]);
                } else {
                    $this->pdo->prepare("UPDATE usuarios SET nombre_completo=?, username=?, id_rol=?, id_funcionario=? WHERE id=?")
                        ->execute([$nombre, $username, $rol, $id_funcionario, $user_id]);
                }
                if (isset($old_rol) && $old_rol != $rol) {
                    $this->pdo->prepare("UPDATE usuarios SET force_logout=3 WHERE id=?")->execute([$user_id]);
                }
                registrar_log($this->pdo, $_SESSION['user_id'], 'usuarios', "Usuario actualizado: $username ($nombre, Rol ID: $rol, ID: $user_id)");
                json_success(null, 'Usuario actualizado exitosamente');
            } else {
                if (!$password || strlen($password) < 6) json_error('La contraseña debe tener al menos 6 caracteres.');
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $this->pdo->prepare("INSERT INTO usuarios (nombre_completo, username, password, id_rol, id_funcionario, estado) VALUES (?,?,?,?,?,1)")
                    ->execute([$nombre, $username, $hash, $rol, $id_funcionario]);
                registrar_log($this->pdo, $_SESSION['user_id'], 'usuarios', "Usuario creado: $username ($nombre, Rol ID: $rol)");
                json_success(null, 'Usuario creado exitosamente');
            }
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function toggleStatus() {
        Auth::requireLogin();
        Permission::require('usr_gestionar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? 0;
        if ($id == $_SESSION['user_id']) json_error('No puedes desactivar tu propia cuenta.');
        // Soporta activo (React) o toggle automático (legacy)
        if (isset($input['activo'])) {
            $nuevo = $input['activo'] ? 1 : 0;
        } else {
            $stmt = $this->pdo->prepare("SELECT estado FROM usuarios WHERE id=?");
            $stmt->execute([$id]);
            $nuevo = $stmt->fetchColumn() ? 0 : 1;
        }
        $uName = $this->pdo->query("SELECT username FROM usuarios WHERE id = " . (int)$id)->fetchColumn();
        $force_logout = !$nuevo ? 2 : 0; // 2 = cuenta desactivada
        $this->pdo->prepare("UPDATE usuarios SET estado = ?, force_logout = ? WHERE id = ?")->execute([$nuevo, $force_logout, $id]);
        registrar_log($this->pdo, $_SESSION['user_id'], 'usuarios', "Estado del usuario $uName (ID: $id) cambiado a: " . ($nuevo ? 'Activo' : 'Inactivo'));
        json_success(['estado' => $nuevo], $nuevo ? 'Usuario activado' : 'Usuario desactivado');
    }

    public function forceLogout() {
        Auth::requireLogin();
        Permission::require('usr_gestionar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? 0;
        $uName = $this->pdo->query("SELECT username FROM usuarios WHERE id = " . (int)$id)->fetchColumn();
        $this->pdo->prepare("UPDATE usuarios SET force_logout=1 WHERE id=?")->execute([$id]);
        registrar_log($this->pdo, $_SESSION['user_id'], 'usuarios', "Forzado cierre de sesión para el usuario: $uName (ID: $id)");
        json_success(null, 'Sesión forzada a cerrar');
    }

    private function generarBackupSQL() {
        set_time_limit(300);
        $dbName = $this->pdo->query("SELECT DATABASE()")->fetchColumn();
        $filename = 'backup_' . $dbName . '_' . date('Y-m-d_H-i-s') . '.sql';

        // Obtener todas las tablas
        $tables = $this->pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

        $sql = "-- Backup de base de datos: $dbName\n";
        $sql .= "-- Generado: " . date('Y-m-d H:i:s') . "\n";
        $sql .= "-- Sistema: GestionTI\n\n";
        $sql .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        foreach ($tables as $table) {
            // Estructura de la tabla
            $createStmt = $this->pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
            $createSQL  = $createStmt['Create Table'] ?? '';
            $sql .= "DROP TABLE IF EXISTS `$table`;\n";
            $sql .= $createSQL . ";\n\n";

            // Datos de la tabla
            $rows = $this->pdo->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) {
                $columns = array_keys($rows[0]);
                $colList = '`' . implode('`, `', $columns) . '`';
                $sql .= "INSERT INTO `$table` ($colList) VALUES\n";
                $valueRows = [];
                foreach ($rows as $row) {
                    $vals = array_map(function($v) {
                        if ($v === null) return 'NULL';
                        return "'" . addslashes($v) . "'";
                    }, array_values($row));
                    $valueRows[] = '(' . implode(', ', $vals) . ')';
                }
                $sql .= implode(",\n", $valueRows) . ";\n\n";
            }
        }

        $sql .= "SET FOREIGN_KEY_CHECKS = 1;\n";

        // Registrar en acciones
        try {
            $this->pdo->prepare("INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('sistema', 'Backup generado: $filename', ?)")
                ->execute([$_SESSION['user_id']]);
        } catch (Exception $e) { /* no bloquear por esto */ }

        // Enviar como descarga
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($sql));
        header('Cache-Control: no-cache, no-store, must-revalidate');
        echo $sql;
        exit;
    }

    public function save() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $type = $input['type'] ?? '';
        // Soporta action (React) como alias de type
        if (empty($type) && !empty($input['action'])) $type = $input['action'];
        $nombre = sanitize_input($input['nombre'] ?? '', 'string', 150);

        try {
            switch ($type) {
                case 'marca':
                    $dup = $this->pdo->prepare("SELECT id FROM marcas WHERE nombre_marca=?");
                    $dup->execute([$nombre]);
                    if ($dup->fetch()) json_error("La marca '$nombre' ya existe.");
                    $this->pdo->prepare("INSERT INTO marcas (nombre_marca) VALUES (?)")->execute([$nombre]);
                    $id = $this->pdo->lastInsertId();
                    registrar_log($this->pdo, $_SESSION['user_id'], 'marcas', "Marca creada: $nombre");
                    json_success(['id' => $id, 'name' => $nombre], 'Marca creada');
                    break;
                case 'area':
                    $codigo = sanitize_input($input['codigo_area'] ?? '', 'string', 50);
                    $this->pdo->prepare("INSERT INTO areas (nombre_area, codigo_area) VALUES (?,?)")->execute([$nombre, $codigo]);
                    $id = $this->pdo->lastInsertId();
                    registrar_log($this->pdo, $_SESSION['user_id'], 'areas', "Área creada: $nombre ($codigo)");
                    json_success(['id' => $id, 'name' => $nombre], 'Área creada');
                    break;
                case 'tipo':
                    $this->pdo->prepare("INSERT INTO tipos (tipo) VALUES (?)")->execute([$nombre]);
                    $id = $this->pdo->lastInsertId();
                    registrar_log($this->pdo, $_SESSION['user_id'], 'tipos', "Tipo de equipo creado: $nombre");
                    json_success(['id' => $id, 'name' => $nombre], 'Tipo creado');
                    break;
                case 'configuracion':
                    $desc = sanitize_input($input['descripcion'] ?? '', 'string', 255);
                    $this->pdo->prepare("INSERT INTO configuraciones (ram_rom, descripcion) VALUES (?,?)")->execute([$nombre, $desc]);
                    $id = $this->pdo->lastInsertId();
                    registrar_log($this->pdo, $_SESSION['user_id'], 'configuraciones', "Configuración de hardware creada: $nombre ($desc)");
                    json_success(['id' => $id, 'name' => $nombre], 'Configuración creada');
                    break;
                case 'funcionario':
                    $apellido = sanitize_input($input['apellido'] ?? '', 'string', 100);
                    $celular = sanitize_input($input['celular'] ?? '', 'string', 50);
                    $id_area = !empty($input['id_area']) ? (int)$input['id_area'] : null;
                    $this->pdo->prepare("INSERT INTO funcionarios (nombre, apellido, celular, id_area) VALUES (?,?,?,?)")
                        ->execute([$nombre, $apellido, $celular, $id_area]);
                    $id = $this->pdo->lastInsertId();
                    registrar_log($this->pdo, $_SESSION['user_id'], 'funcionarios', "Funcionario creado: $nombre $apellido");
                    json_success(['id' => $id, 'name' => "$nombre $apellido"], 'Funcionario creado');
                    break;
                case 'backup_bd':
                    // Genera un dump SQL descargable
                    Permission::require('conf_avanzada');
                    $this->generarBackupSQL();
                    break;
                default:
                    json_error('Tipo no válido: ' . $type);
            }
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }
}
