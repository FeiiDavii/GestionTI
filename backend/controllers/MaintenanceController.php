<?php
class MaintenanceController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function list() {
        Auth::requireLogin();
        Permission::require('tk_mantenimientos');
        // Equipos activos (en servicio)
        $equipos = $this->pdo->query(
            "SELECT e.*, m.nombre_marca, a.nombre_area, CONCAT(f.nombre,' ',f.apellido) as responsable,
                    t.tipo as tipo_equipo, c.ram_rom
             FROM equipos_de_computo e
             LEFT JOIN marcas m ON e.id_marca=m.id
             LEFT JOIN areas a ON e.id_area=a.id
             LEFT JOIN tipos t ON e.id_tipo=t.id
             LEFT JOIN configuraciones c ON e.id_configuracion=c.id
             LEFT JOIN funcionarios f ON e.id_usuario=f.id
             WHERE e.estado != 'De baja'
             ORDER BY e.nombre_equipo ASC"
        )->fetchAll();

        // Equipos de baja (hoja de vida en solo lectura)
        $equipos_baja = $this->pdo->query(
            "SELECT e.*, m.nombre_marca, a.nombre_area, CONCAT(f.nombre,' ',f.apellido) as responsable,
                    t.tipo as tipo_equipo, c.ram_rom
             FROM equipos_de_computo e
             LEFT JOIN marcas m ON e.id_marca=m.id
             LEFT JOIN areas a ON e.id_area=a.id
             LEFT JOIN tipos t ON e.id_tipo=t.id
             LEFT JOIN configuraciones c ON e.id_configuracion=c.id
             LEFT JOIN funcionarios f ON e.id_usuario=f.id
             WHERE e.estado = 'De baja'
             ORDER BY e.fecha_baja DESC, e.nombre_equipo ASC"
        )->fetchAll();

        $configs = $this->pdo->query("SELECT * FROM configuraciones")->fetchAll();
        $areas   = $this->pdo->query("SELECT * FROM areas")->fetchAll();
        json_success(compact('equipos', 'equipos_baja', 'configs', 'areas'));
    }

    public function detail() {
        Auth::requireLogin();
        $id = $_GET['id'] ?? 0;
        $equipo = $this->pdo->prepare("SELECT e.*, m.nombre_marca, a.nombre_area, t.tipo as tipo_equipo, c.ram_rom, CONCAT(f.nombre,' ',f.apellido) as responsable, uc.nombre_completo as creador_nombre FROM equipos_de_computo e LEFT JOIN marcas m ON e.id_marca=m.id LEFT JOIN areas a ON e.id_area=a.id LEFT JOIN tipos t ON e.id_tipo=t.id LEFT JOIN configuraciones c ON e.id_configuracion=c.id LEFT JOIN funcionarios f ON e.id_usuario=f.id LEFT JOIN usuarios uc ON e.creado_por=uc.id WHERE e.id=?");
        $equipo->execute([$id]);
        $mantenimientos = $this->pdo->prepare("SELECT m.*, u.nombre_completo as usuario_nombre FROM historial_equipos m LEFT JOIN usuarios u ON m.usuario_id=u.id WHERE m.id_equipo=? ORDER BY m.fecha DESC");
        $mantenimientos->execute([$id]);
        $licencias = $this->pdo->prepare("SELECT * FROM licencias WHERE id_equipo=?");
        $licencias->execute([$id]);

        json_success([
            'equipo' => $equipo->fetch(),
            'mantenimientos' => $mantenimientos->fetchAll(),
            'licencias' => $licencias->fetchAll()
        ]);
    }

    public function save() {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id_equipo = $input['id_equipo'] ?? 0;
        $tipo = $input['tipo'] ?? '';
        $fecha = $input['fecha'] ?? date('Y-m-d');
        $razon = $input['razon'] ?? '';
        $observaciones = $input['observaciones'] ?? '';
        $id_configuracion = $input['id_configuracion'] ?? null;

        // Verificar que el equipo no esté de baja (hoja de vida es de solo lectura)
        $estadoStmt = $this->pdo->prepare("SELECT estado FROM equipos_de_computo WHERE id=?");
        $estadoStmt->execute([$id_equipo]);
        $estadoEquipo = $estadoStmt->fetchColumn();
        if ($estadoEquipo === 'De baja') {
            json_error('No se pueden registrar mantenimientos en un equipo que está de baja. La hoja de vida es de solo lectura.');
        }

        if ($tipo === 'Mantenimiento Correctivo' && strlen($razon) < 6)
            json_error('La razón/falla debe tener al menos 6 caracteres.');
        if (strlen($observaciones) < 4)
            json_error('Las observaciones deben tener al menos 4 caracteres.');

        $detalles_cambio = null;
        if ($tipo === 'Repotenciacion' && $id_configuracion) {
            $stmtConf = $this->pdo->prepare("SELECT ram_rom FROM configuraciones WHERE id = ?");
            $stmtConf->execute([$id_configuracion]);
            $confName = $stmtConf->fetchColumn();
            if ($confName) {
                $detalles_cambio = "Nueva configuración instalada: " . $confName;
            }
        }

        try {
            $this->pdo->beginTransaction();

            $this->pdo->prepare("INSERT INTO historial_equipos (id_equipo, tipo_accion, fecha, razon, observaciones, usuario_id, detalles_cambio) VALUES (?,?,?,?,?,?,?)")
                ->execute([$id_equipo, $tipo, $fecha, $razon, $observaciones, $_SESSION['user_id'], $detalles_cambio]);

            if ($tipo === 'Repotenciacion' && $id_configuracion) {
                $this->pdo->prepare("UPDATE equipos_de_computo SET id_configuracion=? WHERE id=?")
                    ->execute([$id_configuracion, $id_equipo]);
            }

            $this->pdo->commit();
            json_success(null, 'Mantenimiento registrado');
        } catch (Exception $e) {
            $this->pdo->rollBack();
            json_error(get_friendly_error($e));
        }
    }

    public function update() {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id_equipo = $input['id_equipo'] ?? 0;

        $curr = $this->pdo->prepare("SELECT nombre_equipo, id_area, id_usuario, sistema_operativo, teamviewer_id, teamviewer_version, estado, fecha_baja FROM equipos_de_computo WHERE id = ?");
        $curr->execute([$id_equipo]);
        $current = $curr->fetch();
        if (!$current) {
            json_error('Equipo no encontrado');
        }

        $obs_cambio = trim($input['observaciones_cambio'] ?? $input['justificacion'] ?? '');
        if (strlen($obs_cambio) < 10) {
            json_error('La justificación de cambios debe tener al menos 10 caracteres.');
        }

        $campos = [];
        $params = [];
        $cambios = [];

        if (isset($input['nombre_equipo'])) {
            $val = sanitize_input($input['nombre_equipo'], 'string', 100);
            if ($current['nombre_equipo'] != $val) {
                $cambios[] = "Nombre: '{$current['nombre_equipo']}' -> '$val'";
            }
            $campos[] = 'nombre_equipo=?';
            $params[] = $val;
        }
        if (isset($input['sistema_operativo'])) {
            $val = $input['sistema_operativo'];
            if ($current['sistema_operativo'] != $val) {
                $cambios[] = "SO modificado";
            }
            $campos[] = 'sistema_operativo=?';
            $params[] = $val;
        }
        if (isset($input['estado'])) {
            $val = $input['estado'];
            if ($current['estado'] != $val) {
                $cambios[] = "Estado: '{$current['estado']}' -> '$val'";
            }
            $campos[] = 'estado=?';
            $params[] = $val;
        }
        if (isset($input['fecha_baja'])) {
            $val = $input['fecha_baja'];
            // Normalize empty dates to null
            $normVal = !empty($val) ? $val : null;
            $normCurr = !empty($current['fecha_baja']) ? $current['fecha_baja'] : null;
            if ($normCurr != $normVal) {
                $cambios[] = "Fecha Baja actualizada";
            }
            $campos[] = 'fecha_baja=?';
            $params[] = $normVal;
        }
        if (isset($input['teamviewer_id'])) {
            $val = sanitize_input($input['teamviewer_id'], 'string', 100);
            if ($current['teamviewer_id'] != $val) {
                $cambios[] = "TeamViewer ID: '{$current['teamviewer_id']}' -> '$val'";
            }
            $campos[] = 'teamviewer_id=?';
            $params[] = $val;
        }
        if (isset($input['teamviewer_version'])) {
            $val = sanitize_input($input['teamviewer_version'], 'string', 50);
            if ($current['teamviewer_version'] != $val) {
                $cambios[] = "TeamViewer Ver: '{$current['teamviewer_version']}' -> '$val'";
            }
            $campos[] = 'teamviewer_version=?';
            $params[] = $val;
        }
        if (isset($input['id_area'])) {
            $val = (int)$input['id_area'];
            if ($current['id_area'] != $val) {
                $oldA = $this->pdo->query("SELECT nombre_area FROM areas WHERE id = " . ($current['id_area'] ?: 0))->fetchColumn() ?: 'N/A';
                $newA = $this->pdo->query("SELECT nombre_area FROM areas WHERE id = " . ($val ?: 0))->fetchColumn() ?: 'N/A';
                $cambios[] = "Área: '$oldA' -> '$newA'";
            }
            $campos[] = 'id_area=?';
            $params[] = $val;
        }
        if (isset($input['id_usuario'])) {
            $val = !empty($input['id_usuario']) ? (int)$input['id_usuario'] : null;
            if ($current['id_usuario'] != $val) {
                $oldF = $this->pdo->query("SELECT CONCAT(nombre,' ',apellido) FROM funcionarios WHERE id = " . ($current['id_usuario'] ?: 0))->fetchColumn() ?: 'N/A';
                $newF = $this->pdo->query("SELECT CONCAT(nombre,' ',apellido) FROM funcionarios WHERE id = " . ($val ?: 0))->fetchColumn() ?: 'N/A';
                $cambios[] = "Funcionario: '$oldF' -> '$newF'";
            }
            $campos[] = 'id_usuario=?';
            $params[] = $val;
        }

        if (empty($campos)) {
            json_error('No hay campos para actualizar');
        }
        if (empty($cambios)) {
            json_error('No se detectaron cambios.');
        }

        try {
            $this->pdo->beginTransaction();

            $params[] = $id_equipo;
            $this->pdo->prepare("UPDATE equipos_de_computo SET " . implode(', ', $campos) . " WHERE id=?")->execute($params);

            $detalles = implode(", ", $cambios);
            $this->pdo->prepare("INSERT INTO historial_equipos (id_equipo, tipo_accion, fecha, usuario_id, observaciones, detalles_cambio) VALUES (?, 'Actualizacion de Datos', NOW(), ?, ?, ?)")
                ->execute([$id_equipo, $_SESSION['user_id'], $obs_cambio, $detalles]);

            $this->pdo->commit();
            json_success(null, 'Ficha técnica actualizada e historial generado.');
        } catch (Exception $e) {
            $this->pdo->rollBack();
            json_error(get_friendly_error($e));
        }
    }
}
