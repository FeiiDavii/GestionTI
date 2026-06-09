<?php
class PermissionController {
    private $pdo;
    private $permisosList = ['inv_ver', 'inv_crear_editar', 'inv_eliminar', 'inv_asignaciones', 'inv_licencias', 'inv_bajas', 'tk_ver_global', 'tk_responder', 'tk_asignar_otros', 'tk_mantenimientos', 'tk_crear', 'usr_ver', 'usr_gestionar', 'rep_generar', 'conf_basica', 'conf_roles', 'conf_avanzada', 'conf_sla'];

    public function __construct($pdo) { $this->pdo = $pdo; }

    public function roles() {
        Auth::requireLogin();
        Auth::checkForceLogout($this->pdo);
        Permission::requireAny(['conf_basica', 'conf_roles']);
        $roles = $this->pdo->query("SELECT * FROM roles ORDER BY id")->fetchAll();
        foreach ($roles as &$rol) {
            // Alias: exponer nombre_rol también como nombre para el frontend React
            $rol['nombre'] = $rol['nombre_rol'];
            $permisos = [];
            foreach ($this->permisosList as $p) {
                $permisos[$p] = !empty($rol[$p]) ? 1 : 0;
                unset($rol[$p]);
            }
            $rol['permisos'] = $permisos;
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE id_rol=?");
            $stmt->execute([$rol['id']]);
            $rol['total_usuarios'] = (int)$stmt->fetchColumn();
        }
        json_success($roles);
    }

    public function saveRole() {
        Auth::requireLogin();
        Permission::require('conf_roles');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? null;
        $nombre = sanitize_input($input['nombre_rol'] ?? $input['nombre'] ?? '', 'string', 50);
        $desc = sanitize_input($input['descripcion'] ?? '', 'string', 255);

        if (empty($nombre)) json_error('El nombre del rol es obligatorio.');

        // Soporta permisos anidados (frontend React) y planos (legacy)
        $permisosInput = $input['permisos'] ?? $input;
        $permisos = [];
        foreach ($this->permisosList as $p) {
            $permisos[$p] = !empty($permisosInput[$p]) ? 1 : 0;
        }

        try {
            if ($id) {
                if ($id == 1) json_error('El rol Administrador no puede ser modificado.');
                $sets = implode('=?, ', array_keys($permisos)) . '=?';
                $values = array_values($permisos);
                $this->pdo->prepare("UPDATE roles SET nombre_rol=?, descripcion=?, $sets WHERE id=?")
                    ->execute(array_merge([$nombre, $desc], $values, [$id]));
                // Force logout users with this role
                $this->pdo->prepare("UPDATE usuarios SET force_logout=1 WHERE id_rol=? AND id!=?")
                    ->execute([$id, $_SESSION['user_id']]);
                json_success(['forceLogout' => true], 'Rol actualizado exitosamente');
            } else {
                $cols = implode(', ', array_keys($permisos));
                $vals = implode(', ', array_fill(0, count($permisos), '?'));
                $this->pdo->prepare("INSERT INTO roles (nombre_rol, descripcion, $cols) VALUES (?,?, $vals)")
                    ->execute(array_merge([$nombre, $desc], array_values($permisos)));
                json_success(null, 'Rol creado exitosamente');
            }
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function deleteRole() {
        Auth::requireLogin();
        Permission::require('conf_roles');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? 0;
        if ($id <= 1) json_error('No se puede eliminar el rol de Administrador.');
        $check = $this->pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE id_rol=?");
        $check->execute([$id]);
        if ($check->fetchColumn() > 0) json_error('No se puede eliminar el rol porque tiene usuarios asignados.');
        $this->pdo->prepare("DELETE FROM roles WHERE id=?")->execute([$id]);
        json_success(null, 'Rol eliminado');
    }

    public function configSLA() {
        Auth::requireLogin();
        Permission::require('conf_sla');
        $configs = $this->pdo->query("SELECT * FROM sla_config ORDER BY FIELD(prioridad_ticket, 'Crítica', 'Alta', 'Media', 'Baja')")->fetchAll();
        json_success($configs);
    }

    public function saveSLA() {
        Auth::requireLogin();
        Permission::require('conf_sla');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        // Soporta envio desde React (sla) y legacy (slas)
        $slas = $input['sla'] ?? $input['slas'] ?? [];
        foreach ($slas as $sla) {
            $respuesta  = (int)($sla['respuesta'] ?? $sla['tiempo_respuesta_minutos'] ?? 60) * 60; // convertir horas a minutos
            $resolucion = (int)($sla['resolucion'] ?? $sla['tiempo_resolucion_minutos'] ?? 240) * 60;
            $activo     = isset($sla['activo']) ? (int)$sla['activo'] : 1;
            $id         = $sla['id'] ?? 0;
            if ($id) {
                $this->pdo->prepare("UPDATE sla_config SET tiempo_respuesta_minutos=?, tiempo_resolucion_minutos=?, activo=? WHERE id=?")
                    ->execute([$respuesta, $resolucion, $activo, $id]);
            } else {
                $prioridad = $sla['prioridad'] ?? $sla['prioridad_ticket'] ?? 'Media';
                $nombre    = $sla['nombre'] ?? 'SLA '.$prioridad;
                $this->pdo->prepare("INSERT INTO sla_config (nombre, prioridad_ticket, tiempo_respuesta_minutos, tiempo_resolucion_minutos, activo) VALUES (?,?,?,?,?)")
                    ->execute([$nombre, $prioridad, $respuesta, $resolucion, $activo]);
            }
        }
        json_success(null, 'SLAs actualizados');
    }

    public function keywords() {
        Auth::requireLogin();
        Permission::require('conf_sla');
        $keywords = $this->pdo->query("SELECT * FROM config_prioridades ORDER BY prioridad_asignada, palabra_clave")->fetchAll();
        json_success($keywords);
    }

    public function saveKeyword() {
        Auth::requireLogin();
        Permission::require('conf_sla');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        // Soporta keyword (React) y palabra_clave (legacy)
        $palabra   = strtolower(sanitize_input($input['keyword'] ?? $input['palabra_clave'] ?? '', 'string', 100));
        $prioridad = $input['prioridad'] ?? $input['prioridad_asignada'] ?? 'Baja';
        $id        = $input['id'] ?? null;

        if (empty($palabra)) json_error('La palabra clave es obligatoria.');
        if (strlen($palabra) < 2) json_error('La palabra clave debe tener al menos 2 caracteres.');

        try {
            if ($id) {
                $this->pdo->prepare("UPDATE config_prioridades SET palabra_clave=?, prioridad_asignada=? WHERE id=?")
                    ->execute([$palabra, $prioridad, $id]);
            } else {
                $check = $this->pdo->prepare("SELECT id FROM config_prioridades WHERE palabra_clave=?");
                $check->execute([$palabra]);
                if ($check->fetch()) json_error("La palabra clave '$palabra' ya existe.");
                $this->pdo->prepare("INSERT INTO config_prioridades (palabra_clave, prioridad_asignada) VALUES (?,?)")
                    ->execute([$palabra, $prioridad]);
            }
            json_success(null, 'Palabra clave guardada');
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function deleteKeyword() {
        Auth::requireLogin();
        Permission::require('conf_sla');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $this->pdo->prepare("DELETE FROM config_prioridades WHERE id=?")->execute([$input['id'] ?? 0]);
        json_success(null, 'Palabra clave eliminada');
    }

    public function logs() {
        Auth::requireLogin();
        Permission::requireAny(['conf_basica', 'conf_roles', 'rep_generar']);
        $acciones = $this->pdo->query("SELECT a.*, u.nombre_completo FROM acciones a LEFT JOIN usuarios u ON a.usuario_id=u.id ORDER BY a.fecha DESC LIMIT 200")->fetchAll();
        json_success([
            'data' => $acciones,
            'total' => count($acciones)
        ]);
    }

    public function clearLogs() {
        Auth::requireLogin();
        Permission::require('conf_avanzada');
        $stmt = $this->pdo->prepare("DELETE FROM acciones WHERE fecha < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        $stmt->execute();
        $deleted = $stmt->rowCount();
        json_success(['deleted' => $deleted], "$deleted registros de log antiguos eliminados.");
    }

    public function importBackup() {
        Auth::requireLogin();
        Permission::require('conf_avanzada');
        if (empty($_FILES['backup_file']) || $_FILES['backup_file']['error'] !== UPLOAD_ERR_OK) {
            json_error('No se recibió ningún archivo o hubo un error en la subida.');
        }
        $ext = strtolower(pathinfo($_FILES['backup_file']['name'], PATHINFO_EXTENSION));
        if ($ext !== 'sql') json_error('Solo se permiten archivos .sql');
        try {
            $content = file_get_contents($_FILES['backup_file']['tmp_name']);
            if (empty($content)) json_error('El archivo está vacío.');
            set_time_limit(300);
            $this->pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
            $this->pdo->exec($content);
            $this->pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            json_success(null, 'Backup restaurado exitosamente. Todos los datos fueron reemplazados.');
        } catch (Exception $e) {
            $this->pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            json_error(get_friendly_error($e));
        }
    }

    public function deleteSLA() {
        Auth::requireLogin();
        Permission::require('conf_sla');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? 0;
        if (!$id) json_error('ID de SLA no especificado.');
        $check = $this->pdo->prepare("SELECT COUNT(*) FROM sla_registros WHERE sla_config_id=?");
        $check->execute([$id]);
        if ($check->fetchColumn() > 0) {
            json_error('No puedes eliminar un SLA que está siendo utilizado en registros.');
        }
        $stmt = $this->pdo->prepare("DELETE FROM sla_config WHERE id=?");
        $stmt->execute([$id]);
        json_success(null, 'SLA eliminado exitosamente');
    }
}
