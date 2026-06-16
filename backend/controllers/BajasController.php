<?php
class BajasController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function search() {
        Auth::requireLogin();
        Permission::require('inv_bajas');
        $q = $_GET['q'] ?? '';
        $param = "%$q%";
        $res = [];
        
        $queries = [
            "SELECT id, nombre_equipo as nombre, serial, serial_interno, modelo, id_marca, 'equipos_de_computo' as source FROM equipos_de_computo WHERE (serial LIKE ? OR nombre_equipo LIKE ? OR modelo LIKE ?) AND estado != 'De baja' LIMIT 10",
            "SELECT id, 'Monitor' as nombre, serial, serial_interno, modelo, id_marca, 'monitores' as source FROM monitores WHERE serial LIKE ? LIMIT 10",
            "SELECT id, 'Impresora' as nombre, serial, serial_interno, modelo, id_marca, 'impresoras_escaneres' as source FROM impresoras_escaneres WHERE serial LIKE ? LIMIT 10",
            "SELECT id, 'Otro' as nombre, serial, '' as serial_interno, modelo, id_marca, 'otros' as source FROM otros WHERE serial LIKE ? LIMIT 10"
        ];
        
        foreach ($queries as $sql) {
            $params = substr_count($sql, '?') == 3 ? [$param, $param, $param] : [$param];
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$r) {
                if ($r['id_marca']) {
                    $r['nombre_marca'] = $this->pdo->query("SELECT nombre_marca FROM marcas WHERE id=" . (int)$r['id_marca'])->fetchColumn();
                } else {
                    $r['nombre_marca'] = 'Genérico';
                }
            }
            $res = array_merge($res, $rows);
        }
        json_success($res);
    }

    public function save() {
        Auth::requireLogin();
        Permission::require('inv_eliminar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        try {
            $this->pdo->beginTransaction();

            $motivo = sanitize_input($input['motivo'] ?? '', 'string', 1000);
            if (strlen($motivo) < 10) json_error('El motivo debe tener al menos 10 caracteres.');

            if (($input['tipo_form'] ?? '') === 'insumo') {
                $categoria_insumo = $input['categoria_insumo'] ?? 'OTRO';
                $cantidad = (int)($input['cantidad'] ?? 1);
                $this->pdo->prepare("INSERT INTO bajas (tipo_activo, categoria, marca, motivo, cantidad, usuario_responsable_id) VALUES (?,?,?,?,?,?)")
                    ->execute(['Insumo/Generico', $categoria_insumo, $input['marca_insumo'] ?? 'Genérico', $motivo, $cantidad, $_SESSION['user_id']]);
                
                registrar_log($this->pdo, $_SESSION['user_id'], 'bajas', "Baja registrada (Insumo): $categoria_insumo - Cantidad: $cantidad (Motivo: $motivo)");
            } else {
                $origen_tabla = $input['origen_tabla'] ?? '';
                $id_origen = $input['origen_id'] ?? 0;
                $categoria = $input['categoria'] ?? '';
                $marca = $input['marca'] ?? '';
                $modelo = $input['modelo'] ?? '';
                $serial = $input['serial'] ?? '';
                $serial_interno = $input['serial_interno'] ?? '';

                // Si viene de inventario, hacer soft-delete
                if ($origen_tabla === 'equipos_de_computo' && $id_origen) {
                    // 1. Marcar equipo como De baja y quitar asignación de funcionario
                    $this->pdo->prepare(
                        "UPDATE equipos_de_computo SET estado='De baja', fecha_baja=CURDATE(), id_usuario=NULL WHERE id=?"
                    )->execute([$id_origen]);

                    // 2. Desvincular periféricos (monitores e impresoras quedan libres)
                    $this->pdo->prepare("UPDATE monitores SET id_equipo=NULL WHERE id_equipo=?")->execute([$id_origen]);
                    $this->pdo->prepare("UPDATE impresoras_escaneres SET id_equipo=NULL WHERE id_equipo=?")->execute([$id_origen]);

                    // 3. Liberar insumos asignados a este equipo (devolver al stock disponible)
                    $asignaciones = $this->pdo->prepare(
                        "SELECT id, id_articulo FROM asignaciones WHERE id_equipo=?"
                    );
                    $asignaciones->execute([$id_origen]);
                    foreach ($asignaciones->fetchAll() as $asig) {
                        $this->pdo->prepare(
                            "UPDATE articulos SET cantidad_asignada = GREATEST(0, cantidad_asignada - 1),
                                                  cantidad_disponible = cantidad_disponible + 1
                             WHERE id=?"
                        )->execute([$asig['id_articulo']]);
                    }
                    $this->pdo->prepare("DELETE FROM asignaciones WHERE id_equipo=?")->execute([$id_origen]);

                    // 4. Registrar en historial_equipos que fue dado de baja
                    $this->pdo->prepare(
                        "INSERT INTO historial_equipos (id_equipo, tipo_accion, fecha, usuario_id, observaciones)
                         VALUES (?, 'Actualizacion de Datos', CURDATE(), ?, ?)"
                    )->execute([$id_origen, $_SESSION['user_id'], 'Equipo dado de baja del inventario. Motivo: ' . $motivo]);
                }

                $this->pdo->prepare("INSERT INTO bajas (tipo_activo, categoria, marca, modelo, serial, serial_interno, motivo, origen_tabla, id_origen, usuario_responsable_id) VALUES (?,?,?,?,?,?,?,?,?,?)")
                    ->execute(['Activo Fijo', $categoria, $marca, $modelo, $serial, $serial_interno, $motivo, $origen_tabla, $id_origen ?: null, $_SESSION['user_id']]);
                
                registrar_log($this->pdo, $_SESSION['user_id'], 'bajas', "Baja registrada (Activo Fijo): $categoria $marca $modelo (Serial: $serial, Motivo: $motivo)");
            }

            $this->pdo->commit();
            json_success(null, 'Baja registrada exitosamente');
        } catch (Exception $e) {
            $this->pdo->rollBack();
            json_error(get_friendly_error($e));
        }
    }

    public function list() {
        Auth::requireLogin();
        $stmt = $this->pdo->query("SELECT b.*, u.username FROM bajas b LEFT JOIN usuarios u ON b.usuario_responsable_id = u.id WHERE b.tipo_activo='Activo Fijo' ORDER BY b.fecha_baja DESC");
        json_success($stmt->fetchAll());
    }

    public function consolidated() {
        Auth::requireLogin();
        $stmt = $this->pdo->query("SELECT categoria, marca, COUNT(*) as total, MAX(fecha_baja) as ultimo FROM bajas WHERE tipo_activo='Insumo/Generico' GROUP BY categoria, marca ORDER BY total DESC");
        json_success($stmt->fetchAll());
    }
}
