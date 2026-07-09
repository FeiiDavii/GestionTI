<?php
class EquipmentController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function list() {
        Auth::requireLogin();
        $permisos = Auth::getPermissions($this->pdo);
        if (empty($permisos['inv_ver'])) json_error('No tienes permisos para ver el inventario. Contacte al administrador del sistema.', 403);

        $data = $this->pdo->query("SELECT e.*, m.nombre_marca, a.nombre_area, t.tipo, c.ram_rom, 
            CONCAT(f.nombre, ' ', f.apellido) as nombre_usuario, uc.nombre_completo as creador_nombre
            FROM equipos_de_computo e 
            LEFT JOIN marcas m ON e.id_marca=m.id 
            LEFT JOIN areas a ON e.id_area=a.id 
            LEFT JOIN tipos t ON e.id_tipo=t.id 
            LEFT JOIN configuraciones c ON e.id_configuracion=c.id 
            LEFT JOIN funcionarios f ON e.id_usuario=f.id 
            LEFT JOIN usuarios uc ON e.creado_por=uc.id 
            WHERE e.estado != 'De baja'
            ORDER BY e.id DESC")->fetchAll();

        $impresoras = $this->pdo->query("SELECT i.*, m.nombre_marca, t.tipo, e.nombre_equipo FROM impresoras_escaneres i LEFT JOIN marcas m ON i.id_marca=m.id LEFT JOIN tipos t ON i.id_tipo=t.id LEFT JOIN equipos_de_computo e ON i.id_equipo=e.id ORDER BY i.id DESC")->fetchAll();
        $monitores = $this->pdo->query("SELECT mn.*, m.nombre_marca, e.nombre_equipo FROM monitores mn LEFT JOIN marcas m ON mn.id_marca=m.id LEFT JOIN equipos_de_computo e ON mn.id_equipo=e.id ORDER BY mn.id DESC")->fetchAll();
        $telefonos = $this->pdo->query("SELECT tel.*, m.nombre_marca, CONCAT(f.nombre, ' ', f.apellido) as nombre_usuario FROM telefonos tel LEFT JOIN marcas m ON tel.id_marca=m.id LEFT JOIN funcionarios f ON tel.id_usuario=f.id ORDER BY tel.id DESC")->fetchAll();
        $otros = $this->pdo->query("SELECT o.*, m.nombre_marca, t.tipo, a.nombre_area FROM otros o LEFT JOIN marcas m ON o.id_marca=m.id LEFT JOIN tipos t ON o.id_tipo=t.id LEFT JOIN areas a ON o.id_area=a.id ORDER BY o.id DESC")->fetchAll();
        $funcionarios = $this->pdo->query("SELECT f.*, a.nombre_area FROM funcionarios f LEFT JOIN areas a ON f.id_area=a.id ORDER BY f.nombre ASC")->fetchAll();
        $areas = $this->pdo->query("SELECT * FROM areas ORDER BY nombre_area ASC")->fetchAll();
        $marcas = $this->pdo->query("SELECT * FROM marcas ORDER BY nombre_marca ASC")->fetchAll();
        $tipos = $this->pdo->query("SELECT * FROM tipos ORDER BY tipo ASC")->fetchAll();
        $configs = $this->pdo->query("SELECT * FROM configuraciones ORDER BY ram_rom ASC")->fetchAll();

        json_success([
            'equipos' => $data, 'impresoras' => $impresoras, 'monitores' => $monitores,
            'telefonos' => $telefonos, 'otros' => $otros, 'funcionarios' => $funcionarios,
            'areas' => $areas, 'marcas' => $marcas, 'tipos' => $tipos, 'configuraciones' => $configs
        ]);
    }

    public function get() {
        Auth::requireLogin();
        $id = $_GET['id'] ?? 0;
        if (empty($id) || !is_numeric($id)) json_error('ID de equipo inválido. Por favor proporcione un ID válido.', 400);
        
        $stmt = $this->pdo->prepare("SELECT e.*, m.nombre_marca, a.nombre_area, t.tipo, c.ram_rom,
            CONCAT(f.nombre, ' ', f.apellido) as nombre_usuario, uc.nombre_completo as creador_nombre
            FROM equipos_de_computo e 
            LEFT JOIN marcas m ON e.id_marca=m.id 
            LEFT JOIN areas a ON e.id_area=a.id 
            LEFT JOIN tipos t ON e.id_tipo=t.id 
            LEFT JOIN configuraciones c ON e.id_configuracion=c.id 
            LEFT JOIN funcionarios f ON e.id_usuario=f.id 
            LEFT JOIN usuarios uc ON e.creado_por=uc.id 
            WHERE e.id = ?");
        $stmt->execute([$id]);
        $equipo = $stmt->fetch();
        if (!$equipo) json_error('El equipo solicitado no existe o fue eliminado del sistema.', 404);
        json_success($equipo);
    }

    public function listas() {
        Auth::requireLogin();
        json_success([
            'marcas' => $this->pdo->query("SELECT * FROM marcas ORDER BY nombre_marca")->fetchAll(),
            'tipos' => $this->pdo->query("SELECT * FROM tipos ORDER BY tipo")->fetchAll(),
            'areas' => $this->pdo->query("SELECT * FROM areas ORDER BY nombre_area")->fetchAll(),
            'funcionarios' => $this->pdo->query("SELECT id, nombre, apellido FROM funcionarios ORDER BY nombre")->fetchAll(),
            'configuraciones' => $this->pdo->query("SELECT * FROM configuraciones")->fetchAll(),
            'equipos' => $this->pdo->query("SELECT id, nombre_equipo, serial FROM equipos_de_computo WHERE estado != 'De baja' ORDER BY nombre_equipo")->fetchAll()
        ]);
    }

    public function totales() {
        Auth::requireLogin();
        json_success([
            'equipos' => $this->pdo->query("SELECT COUNT(*) FROM equipos_de_computo WHERE estado != 'De baja'")->fetchColumn(),
            'impresoras' => $this->pdo->query("SELECT COUNT(*) FROM impresoras_escaneres")->fetchColumn(),
            'monitores' => $this->pdo->query("SELECT COUNT(*) FROM monitores")->fetchColumn(),
            'telefonos' => $this->pdo->query("SELECT COUNT(*) FROM telefonos")->fetchColumn(),
            'otros' => $this->pdo->query("SELECT COUNT(*) FROM otros")->fetchColumn(),
            'funcionarios' => $this->pdo->query("SELECT COUNT(*) FROM funcionarios")->fetchColumn(),
            'areas' => $this->pdo->query("SELECT COUNT(*) FROM areas")->fetchColumn(),
            'marcas' => $this->pdo->query("SELECT COUNT(*) FROM marcas")->fetchColumn()
        ]);
    }

    public function create() { $this->save(false); }
    public function update() { $this->save(true); }

    private function save($isUpdate) {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        try {
            require_once __DIR__ . '/../includes/functions.php';
            $table = $input['table_target'] ?? 'equipos';
            $id = $input['id'] ?? null;

            $sqlMap = [
                'equipos' => 'equipos_de_computo', 'impresoras' => 'impresoras_escaneres',
                'monitores' => 'monitores', 'otros' => 'otros', 'telefonos' => 'telefonos',
                'funcionarios' => 'funcionarios', 'areas' => 'areas', 'marcas' => 'marcas',
                'tipos' => 'tipos', 'configuraciones' => 'configuraciones'
            ];
            if (!isset($sqlMap[$table])) json_error('Tipo de tabla no válido: ' . htmlspecialchars($table) . '. Por favor seleccione una opción válida.');
            $dbTable = $sqlMap[$table];

            // Validate duplicates
            $this->validateDuplicate($dbTable, $table, $input, $id);

            if ($table === 'equipos') {
                $data = [
                    'nombre_equipo' => sanitize_input($input['nombre_equipo'], 'string', 100),
                    'modelo' => sanitize_input($input['modelo'] ?? '', 'string', 150),
                    'procesador' => sanitize_input($input['procesador'] ?? '', 'string', 100),
                    'serial' => sanitize_input($input['serial'] ?? '', 'serial', 100),
                    'serial_interno' => sanitize_input($input['serial_interno'] ?? '', 'serial', 100),
                    'id_tipo' => !empty($input['id_tipo']) ? (int)$input['id_tipo'] : null,
                    'id_marca' => !empty($input['id_marca']) ? (int)$input['id_marca'] : null,
                    'id_configuracion' => !empty($input['id_configuracion']) ? (int)$input['id_configuracion'] : null,
                    'id_area' => !empty($input['id_area']) ? (int)$input['id_area'] : null,
                    'id_usuario' => !empty($input['id_usuario']) ? (int)$input['id_usuario'] : null,
                    'fecha_compra' => $input['fecha_compra'] ?? null,
                    'precio_compra' => !empty($input['precio_compra']) ? (float)str_replace(['.', ','], ['', '.'], $input['precio_compra']) : null,
                    'nivel_clasificacion' => sanitize_input($input['nivel_clasificacion'] ?? 'Interno', 'string', 50),
                    'prot_cifrado' => !empty($input['prot_cifrado']) ? 1 : 0,
                    'prot_antivirus' => !empty($input['prot_antivirus']) ? 1 : 0,
                    'prot_firewall' => !empty($input['prot_firewall']) ? 1 : 0
                ];
                if ($isUpdate) {
                    $sets = implode('=?, ', array_keys($data)) . '=?';
                    $data['id'] = $id;
                    $this->pdo->prepare("UPDATE $dbTable SET $sets WHERE id=?")->execute(array_values($data));
                } else {
                    $data['creado_por'] = $_SESSION['user_id'];
                    $cols = implode(', ', array_keys($data));
                    $vals = implode(', ', array_fill(0, count($data), '?'));
                    $this->pdo->prepare("INSERT INTO $dbTable ($cols) VALUES ($vals)")->execute(array_values($data));
                }
            } elseif ($table === 'funcionarios') {
                $data = [
                    'nombre' => sanitize_input($input['nombre'], 'string', 100),
                    'apellido' => sanitize_input($input['apellido'], 'string', 100),
                    'celular' => sanitize_input($input['celular'] ?? '', 'string', 50),
                    'id_area' => !empty($input['id_area']) ? (int)$input['id_area'] : null
                ];
                crud_save_pdo($this->pdo, $dbTable, $data, $id);
            } elseif ($table === 'areas') {
                $data = ['nombre_area' => sanitize_input($input['nombre_area'], 'string', 150), 'codigo_area' => sanitize_input($input['codigo_area'] ?? '', 'string', 50)];
                crud_save_pdo($this->pdo, $dbTable, $data, $id);
            } elseif ($table === 'marcas') {
                $data = ['nombre_marca' => sanitize_input($input['nombre_marca'], 'string', 150)];
                crud_save_pdo($this->pdo, $dbTable, $data, $id);
            } elseif ($table === 'tipos') {
                $data = ['tipo' => sanitize_input($input['tipo'], 'string', 150)];
                crud_save_pdo($this->pdo, $dbTable, $data, $id);
            } elseif ($table === 'configuraciones') {
                $data = ['ram_rom' => sanitize_input($input['ram_rom'], 'string', 100), 'descripcion' => sanitize_input($input['descripcion'] ?? '', 'string', 255)];
                crud_save_pdo($this->pdo, $dbTable, $data, $id);
            } elseif (in_array($table, ['impresoras', 'monitores', 'telefonos', 'otros'])) {
                $data = [
                    'serial' => sanitize_input($input['serial'] ?? '', 'serial', 100),
                    'id_marca' => !empty($input['id_marca']) ? (int)$input['id_marca'] : null,
                ];
                if (!in_array($table, ['telefonos', 'otros'])) {
                    $data['serial_interno'] = sanitize_input($input['serial_interno'] ?? '', 'serial', 100);
                }
                if (!in_array($table, ['telefonos'])) {
                    $data['modelo'] = sanitize_input($input['modelo'] ?? '', 'string', 150);
                }
                if ($table === 'impresoras') { $data['id_tipo'] = !empty($input['id_tipo']) ? (int)$input['id_tipo'] : null; $data['id_equipo'] = !empty($input['id_equipo']) ? (int)$input['id_equipo'] : null; }
                if ($table === 'monitores') { $data['id_equipo'] = !empty($input['id_equipo']) ? (int)$input['id_equipo'] : null; }
                if ($table === 'telefonos') { $data['ip'] = sanitize_input($input['ip'] ?? '', 'string', 45); $data['extension'] = sanitize_input($input['extension'] ?? '', 'string', 50); $data['id_usuario'] = !empty($input['id_usuario']) ? (int)$input['id_usuario'] : null; }
                if ($table === 'otros') { $data['id_tipo'] = !empty($input['id_tipo']) ? (int)$input['id_tipo'] : null; $data['id_area'] = !empty($input['id_area']) ? (int)$input['id_area'] : null; }
                crud_save_pdo($this->pdo, $dbTable, $data, $id);
            }
            $nombre_legible = ['equipos' => 'Equipo', 'impresoras' => 'Impresora/Escáner', 'monitores' => 'Monitor', 'telefonos' => 'Teléfono', 'otros' => 'Artículo', 'funcionarios' => 'Funcionario', 'areas' => 'Área', 'marcas' => 'Marca', 'tipos' => 'Tipo', 'configuraciones' => 'Configuración'];
            $tipo = $nombre_legible[$table] ?? 'Registro';

            // Registrar log de auditoría
            $logTable = $table;
            $logMsg = "";
            if ($table === 'equipos') {
                $nombre_equipo = sanitize_input($input['nombre_equipo'] ?? '', 'string', 100);
                $serial_equipo = sanitize_input($input['serial'] ?? '', 'serial', 100);
                $logMsg = ($isUpdate ? "Equipo actualizado: " : "Equipo creado: ") . "$nombre_equipo (Serial: $serial_equipo)";
            } else {
                $identificador = $input['nombre'] ?? $input['nombre_area'] ?? $input['nombre_marca'] ?? $input['tipo'] ?? $input['ram_rom'] ?? $input['serial'] ?? $input['modelo'] ?? 'ID ' . ($id ?? '');
                if ($table === 'funcionarios' && isset($input['apellido'])) {
                    $identificador .= ' ' . ($input['apellido'] ?? '');
                }
                $logMsg = "$tipo " . ($isUpdate ? "actualizado: " : "creado: ") . $identificador;
            }
            registrar_log($this->pdo, $_SESSION['user_id'], $logTable, $logMsg);

            $accion = $isUpdate ? 'actualizado' : 'guardado';            json_success(null, "$tipo $accion exitosamente en el sistema.");
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function delete() {
        Auth::requireLogin();
        Permission::require('inv_eliminar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? 0;
        $table = $input['table_target'] ?? 'equipos';
        $sqlMap = ['equipos' => 'equipos_de_computo', 'impresoras' => 'impresoras_escaneres', 'monitores' => 'monitores', 'otros' => 'otros', 'telefonos' => 'telefonos', 'funcionarios' => 'funcionarios', 'areas' => 'areas', 'marcas' => 'marcas', 'tipos' => 'tipos', 'configuraciones' => 'configuraciones'];
        if (!isset($sqlMap[$table])) json_error('Tipo de tabla no válido: ' . htmlspecialchars($table) . '. Por favor seleccione una opción válida.');

        $nombre_legible = ['equipos' => 'Equipo', 'impresoras' => 'Impresora/Escáner', 'monitores' => 'Monitor', 'telefonos' => 'Teléfono', 'otros' => 'Artículo', 'funcionarios' => 'Funcionario', 'areas' => 'Área', 'marcas' => 'Marca', 'tipos' => 'Tipo', 'configuraciones' => 'Configuración'];
        $tipo = $nombre_legible[$table] ?? 'Registro';

        try {
            // Los equipos de cómputo NO se eliminan físicamente — se marcan como De baja
            // para preservar la hoja de vida y el historial. Usar el módulo de Bajas
            // para registrar la baja formal con motivo.
            if ($table === 'equipos') {
                $this->pdo->beginTransaction();

                // Obtener datos del equipo antes de la baja para el log
                $eqStmt = $this->pdo->prepare("SELECT nombre_equipo, serial FROM equipos_de_computo WHERE id = ?");
                $eqStmt->execute([$id]);
                $eqInfo = $eqStmt->fetch();
                $nombre_eq = $eqInfo ? $eqInfo['nombre_equipo'] : 'ID ' . $id;
                $serial_eq = $eqInfo ? $eqInfo['serial'] : 'Desconocido';

                // Soft-delete: marcar como De baja y desvincular funcionario
                $this->pdo->prepare(
                    "UPDATE equipos_de_computo SET estado='De baja', fecha_baja=CURDATE(), id_usuario=NULL WHERE id=?"
                )->execute([$id]);

                // Desvincular periféricos
                $this->pdo->prepare("UPDATE monitores SET id_equipo=NULL WHERE id_equipo=?")->execute([$id]);
                $this->pdo->prepare("UPDATE impresoras_escaneres SET id_equipo=NULL WHERE id_equipo=?")->execute([$id]);

                // Liberar insumos asignados al equipo
                $asignaciones = $this->pdo->prepare("SELECT id, id_articulo FROM asignaciones WHERE id_equipo=?");
                $asignaciones->execute([$id]);
                foreach ($asignaciones->fetchAll() as $asig) {
                    $this->pdo->prepare(
                        "UPDATE articulos SET cantidad_asignada = GREATEST(0, cantidad_asignada - 1),
                                              cantidad_disponible = cantidad_disponible + 1
                         WHERE id=?"
                    )->execute([$asig['id_articulo']]);
                }
                $this->pdo->prepare("DELETE FROM asignaciones WHERE id_equipo=?")->execute([$id]);

                // Registrar en historial_equipos
                $this->pdo->prepare(
                    "INSERT INTO historial_equipos (id_equipo, tipo_accion, fecha, usuario_id, observaciones)
                     VALUES (?, 'Actualizacion de Datos', CURDATE(), ?, 'Equipo eliminado desde el inventario y dado de baja del sistema.')"
                )->execute([$id, $_SESSION['user_id']]);

                // Registrar log de auditoría
                registrar_log($this->pdo, $_SESSION['user_id'], 'equipos', "Equipo dado de baja (Eliminado): $nombre_eq (Serial: $serial_eq)");

                $this->pdo->commit();
                json_success(null, 'Equipo dado de baja correctamente. La hoja de vida se conserva en el módulo de Mantenimientos para auditoría.');
            }

            // Para el resto de tablas: obtener info del registro antes de eliminar
            $identificador = 'ID ' . $id;
            try {
                $dbTable = $sqlMap[$table];
                $stmtDelInfo = $this->pdo->prepare("SELECT * FROM $dbTable WHERE id = ?");
                $stmtDelInfo->execute([$id]);
                $delInfo = $stmtDelInfo->fetch();
                if ($delInfo) {
                    if (isset($delInfo['nombre_equipo'])) {
                        $identificador = $delInfo['nombre_equipo'] . " (Serial: " . ($delInfo['serial'] ?? '') . ")";
                    } elseif (isset($delInfo['serial'])) {
                        $identificador = "Serial: " . $delInfo['serial'];
                    } elseif (isset($delInfo['nombre_area'])) {
                        $identificador = $delInfo['nombre_area'];
                    } elseif (isset($delInfo['nombre_marca'])) {
                        $identificador = $delInfo['nombre_marca'];
                    } elseif (isset($delInfo['tipo'])) {
                        $identificador = $delInfo['tipo'];
                    } elseif (isset($delInfo['ram_rom'])) {
                        $identificador = $delInfo['ram_rom'];
                    } elseif (isset($delInfo['nombre']) && isset($delInfo['apellido'])) {
                        $identificador = $delInfo['nombre'] . ' ' . $delInfo['apellido'];
                    } elseif (isset($delInfo['nombre'])) {
                        $identificador = $delInfo['nombre'];
                    }
                }
            } catch (Exception $e) {
                // fall back to default
            }

            // Para el resto de tablas: eliminación física normal
            $this->pdo->prepare("DELETE FROM {$sqlMap[$table]} WHERE id = ?")->execute([$id]);

            // Registrar log de auditoría
            registrar_log($this->pdo, $_SESSION['user_id'], $table, "$tipo eliminado: $identificador");

            json_success(null, 'Registro eliminado correctamente del sistema.');
        } catch (PDOException $e) {
            if (isset($this->pdo) && $this->pdo->inTransaction()) $this->pdo->rollBack();
            if ($e->getCode() == '23000') json_error('No se puede eliminar este registro porque está siendo utilizado en otros módulos del sistema. Elimine o modifique los registros relacionados primero.');
            json_error(get_friendly_error($e));
        } catch (Exception $e) {
            if (isset($this->pdo) && $this->pdo->inTransaction()) $this->pdo->rollBack();
            json_error(get_friendly_error($e));
        }
    }

    private function validateDuplicate($dbTable, $table, $input, $id) {
        if (in_array($table, ['equipos', 'impresoras', 'monitores', 'telefonos', 'otros'])) {
            $serial = $input['serial'] ?? '';
            if (!empty($serial)) {
                $sql = "SELECT id FROM $dbTable WHERE serial = ?";
                $params = [$serial];
                if ($id) { $sql .= " AND id != ?"; $params[] = $id; }
                $stmt = $this->pdo->prepare($sql); $stmt->execute($params);
                if ($stmt->fetch()) throw new Exception("El número de serial '$serial' ya está registrado en el sistema. Por favor verifique el serial e intente con uno diferente.");
            }
        } elseif ($table === 'funcionarios') {
            $sql = "SELECT id FROM $dbTable WHERE nombre = ? AND apellido = ?";
            $params = [sanitize_input($input['nombre'] ?? '', 'string', 100), sanitize_input($input['apellido'] ?? '', 'string', 100)];
            if ($id) { $sql .= " AND id != ?"; $params[] = $id; }
            $stmt = $this->pdo->prepare($sql); $stmt->execute($params);
            if ($stmt->fetch()) throw new Exception("El funcionario con nombre '{$input['nombre']} {$input['apellido']}' ya está registrado en el sistema.");
        }
    }
}

function crud_save_pdo($pdo, $table, $data, $id = null) {
    $columns = array_keys($data);
    $values = array_values($data);
    if ($id) {
        $setClause = implode('=?, ', $columns) . '=?';
        $values[] = $id;
        $pdo->prepare("UPDATE $table SET $setClause WHERE id = ?")->execute($values);
    } else {
        $colNames = implode(', ', $columns);
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        $pdo->prepare("INSERT INTO $table ($colNames) VALUES ($placeholders)")->execute($values);
    }
}
