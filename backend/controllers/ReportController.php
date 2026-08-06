<?php
class ReportController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    /** GET /reports/listas - dynamic options for filter dropdowns */
    public function listas() {
        Auth::requireLogin();
        $areas    = $this->pdo->query("SELECT id, nombre_area FROM areas ORDER BY nombre_area")->fetchAll();
        $marcas   = $this->pdo->query("SELECT id, nombre_marca FROM marcas ORDER BY nombre_marca")->fetchAll();
        $tecnicos = $this->pdo->query(
            "SELECT u.id, u.nombre_completo FROM usuarios u
             INNER JOIN roles r ON u.id_rol = r.id
             WHERE r.tk_responder = 1 AND u.estado = 1
             ORDER BY u.nombre_completo"
        )->fetchAll();
        $usuarios = $this->pdo->query("SELECT id, nombre_completo FROM usuarios WHERE estado = 1 ORDER BY nombre_completo")->fetchAll();
        json_success(compact('areas', 'marcas', 'tecnicos', 'usuarios'));
    }

    /** POST /reports/generate */
    public function generate() {
        Auth::requireLogin();
        Permission::require('rep_generar');
        $input   = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $type    = $input['tipo']    ?? ($input['report_type'] ?? 'equipos');
        $filters = $input['filtros'] ?? ($input['filters']    ?? []);
        $page    = (int)($input['page']  ?? 1);
        $limit   = (int)($input['limit'] ?? 50);
        $offset  = ($page - 1) * $limit;

        $data  = [];
        $total = 0;

        try {
            switch ($type) {

                /* ─────────────────────── EQUIPOS ─────────────────────── */
                case 'equipos':
                    $baseSelect = "SELECT * FROM (
                        SELECT e.id, e.nombre_equipo, e.modelo, e.serial, e.serial_interno, COALESCE(tp.tipo, 'PC') AS tipo, m.nombre_marca AS marca, a.nombre_area AS area, e.procesador, c.ram_rom AS configuracion, e.sistema_operativo AS so, e.estado, e.nivel_clasificacion AS clasificacion, e.fecha_compra, e.fecha_baja, e.precio_compra, CONCAT(f.nombre,' ',f.apellido) AS responsable, CONCAT_WS(', ', IF(e.prot_cifrado=1, 'Cifrado', NULL), IF(e.prot_antivirus=1, 'Antivirus', NULL), IF(e.prot_firewall=1, 'Firewall', NULL)) AS protecciones, e.id_area, e.id_marca, 'Computador' AS categoria_hardware
                        FROM equipos_de_computo e
                        LEFT JOIN marcas m ON e.id_marca = m.id
                        LEFT JOIN areas a ON e.id_area = a.id
                        LEFT JOIN tipos tp ON e.id_tipo = tp.id
                        LEFT JOIN configuraciones c ON e.id_configuracion = c.id
                        LEFT JOIN funcionarios f ON e.id_usuario = f.id

                        UNION ALL

                        SELECT i.id, e.nombre_equipo AS nombre_equipo, i.modelo, i.serial, i.serial_interno, COALESCE(tpi.tipo, 'Impresora/Escáner') AS tipo, mi.nombre_marca AS marca, a.nombre_area AS area, NULL AS procesador, NULL AS configuracion, NULL AS so, 'Activo' AS estado, NULL AS clasificacion, NULL AS fecha_compra, NULL AS fecha_baja, NULL AS precio_compra, CONCAT(f.nombre,' ',f.apellido) AS responsable, NULL AS protecciones, e.id_area, i.id_marca, 'Impresora/Escaner' AS categoria_hardware
                        FROM impresoras_escaneres i
                        LEFT JOIN marcas mi ON i.id_marca = mi.id
                        LEFT JOIN tipos tpi ON i.id_tipo = tpi.id
                        LEFT JOIN equipos_de_computo e ON i.id_equipo = e.id
                        LEFT JOIN areas a ON e.id_area = a.id
                        LEFT JOIN funcionarios f ON e.id_usuario = f.id

                        UNION ALL

                        SELECT mn.id, e.nombre_equipo AS nombre_equipo, mn.modelo, mn.serial, mn.serial_interno, 'Monitor' AS tipo, mmn.nombre_marca AS marca, a.nombre_area AS area, NULL AS procesador, NULL AS configuracion, NULL AS so, 'Activo' AS estado, NULL AS clasificacion, NULL AS fecha_compra, NULL AS fecha_baja, NULL AS precio_compra, CONCAT(f.nombre,' ',f.apellido) AS responsable, NULL AS protecciones, e.id_area, mn.id_marca, 'Monitor' AS categoria_hardware
                        FROM monitores mn
                        LEFT JOIN marcas mmn ON mn.id_marca = mmn.id
                        LEFT JOIN equipos_de_computo e ON mn.id_equipo = e.id
                        LEFT JOIN areas a ON e.id_area = a.id
                        LEFT JOIN funcionarios f ON e.id_usuario = f.id

                        UNION ALL

                        SELECT t.id, CONCAT('Ext: ', IFNULL(t.extension, '-')) AS nombre_equipo, NULL AS modelo, t.serial, t.ip AS serial_interno, 'Teléfono' AS tipo, mt.nombre_marca AS marca, at.nombre_area AS area, NULL AS procesador, NULL AS configuracion, NULL AS so, 'Activo' AS estado, NULL AS clasificacion, NULL AS fecha_compra, NULL AS fecha_baja, NULL AS precio_compra, CONCAT(ft.nombre,' ',ft.apellido) AS responsable, NULL AS protecciones, ft.id_area, t.id_marca, 'Teléfono' AS categoria_hardware
                        FROM telefonos t
                        LEFT JOIN marcas mt ON t.id_marca = mt.id
                        LEFT JOIN funcionarios ft ON t.id_usuario = ft.id
                        LEFT JOIN areas at ON ft.id_area = at.id

                        UNION ALL

                        SELECT o.id, NULL AS nombre_equipo, o.modelo, o.serial, NULL AS serial_interno, COALESCE(tpo.tipo, 'Otro') AS tipo, mo.nombre_marca AS marca, ao.nombre_area AS area, NULL AS procesador, NULL AS configuracion, NULL AS so, 'Activo' AS estado, NULL AS clasificacion, NULL AS fecha_compra, NULL AS fecha_baja, NULL AS precio_compra, NULL AS responsable, NULL AS protecciones, o.id_area, o.id_marca, 'Otro' AS categoria_hardware
                        FROM otros o
                        LEFT JOIN marcas mo ON o.id_marca = mo.id
                        LEFT JOIN tipos tpo ON o.id_tipo = tpo.id
                        LEFT JOIN areas ao ON o.id_area = ao.id
                    ) AS all_equipments WHERE 1=1";

                    $sql = $baseSelect;
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%' . $filters['search'] . '%';
                        $sql .= " AND (nombre_equipo LIKE ? OR serial LIKE ?)";
                        array_push($params, $s, $s);
                    }
                    if (!empty($filters['estado'])) {
                        $est = strtolower($filters['estado']);
                        if ($est === 'activo') {
                            $sql .= " AND estado = 'Activo'";
                        } elseif ($est === 'mantenimiento') {
                            $sql .= " AND estado = 'En mantenimiento'";
                        } elseif ($est === 'baja') {
                            $sql .= " AND estado = 'De baja'";
                        } elseif ($est === 'reserva') {
                            $sql .= " AND estado = 'Reserva'";
                        } else {
                            $sql .= " AND estado = ?"; $params[] = $filters['estado'];
                        }
                    }
                    if (!empty($filters['id_area'])) {
                        $sql .= " AND id_area = ?";    $params[] = (int)$filters['id_area'];
                    }
                    if (!empty($filters['id_marca'])) {
                        $sql .= " AND id_marca = ?";   $params[] = (int)$filters['id_marca'];
                    }
                    if (!empty($filters['clasificacion'])) {
                        $sql .= " AND categoria_hardware = ?"; $params[] = $filters['clasificacion'];
                    }

                    $totalSql = str_replace("SELECT * FROM (", "SELECT COUNT(*) FROM (", $baseSelect);
                    $total = $this->doCount($totalSql, $filters, 'equipos');
                    $sql .= " ORDER BY nombre_equipo LIMIT $limit OFFSET $offset";
                    $stmt = $this->pdo->prepare($sql); $stmt->execute($params); $data = $stmt->fetchAll();
                    break;

                /* ─────────────────────── REPUESTOS ─────────────────────── */
                case 'repuestos':
                    $sql = "SELECT a.id,
                                   a.nombre,
                                   a.modelo,
                                   m.nombre_marca AS marca,
                                   a.caracteristicas,
                                   a.cantidad_total    AS total,
                                   a.cantidad_asignada AS asignado,
                                   a.cantidad_disponible AS disponible
                            FROM articulos a
                            LEFT JOIN marcas m ON a.id_marca = m.id
                            WHERE 1=1";
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%'.$filters['search'].'%';
                        $sql .= " AND (a.nombre LIKE ? OR a.modelo LIKE ?)";
                        array_push($params, $s, $s);
                    }
                    if (!empty($filters['id_marca'])) {
                        $sql .= " AND a.id_marca = ?"; $params[] = (int)$filters['id_marca'];
                    }
                    if (isset($filters['stock_min']) && $filters['stock_min'] !== '') {
                        $sql .= " AND a.cantidad_disponible <= ?"; $params[] = (int)$filters['stock_min'];
                    }

                    $total = $this->doCount("SELECT COUNT(*) FROM articulos a WHERE 1=1", $filters, 'repuestos');
                    $sql .= " ORDER BY a.nombre LIMIT $limit OFFSET $offset";
                    $stmt = $this->pdo->prepare($sql); $stmt->execute($params); $data = $stmt->fetchAll();
                    break;

                /* ─────────────────────── LICENCIAS ─────────────────────── */
                case 'licencias':
                    $sql = "SELECT l.id,
                                   l.nombre_software AS software,
                                   l.tipo_edicion,
                                   l.serial_key      AS serial,
                                   a.nombre_area     AS area,
                                   e.nombre_equipo   AS equipo_asignado,
                                   l.fecha_creacion
                            FROM licencias l
                            LEFT JOIN areas a            ON l.id_area  = a.id
                            LEFT JOIN equipos_de_computo e ON l.id_equipo = e.id
                            WHERE 1=1";
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%'.$filters['search'].'%';
                        $sql .= " AND (l.nombre_software LIKE ? OR l.serial_key LIKE ?)";
                        array_push($params, $s, $s);
                    }
                    if (!empty($filters['id_area'])) {
                        $sql .= " AND l.id_area = ?"; $params[] = (int)$filters['id_area'];
                    }
                    if (!empty($filters['software'])) {
                        $sql .= " AND l.nombre_software LIKE ?"; $params[] = '%'.$filters['software'].'%';
                    }

                    $total = $this->doCount("SELECT COUNT(*) FROM licencias l WHERE 1=1", $filters, 'licencias');
                    $sql .= " ORDER BY l.nombre_software LIMIT $limit OFFSET $offset";
                    $stmt = $this->pdo->prepare($sql); $stmt->execute($params); $data = $stmt->fetchAll();
                    break;

                /* ─────────────────────── TICKETS ─────────────────────── */
                case 'tickets':
                    $sql = "SELECT t.id,
                                   t.titulo,
                                   u.nombre_completo AS solicitante,
                                   COALESCE(a.nombre_area, 'Sin Área') AS area,
                                   t.prioridad,
                                   t.estado,
                                   COALESCE(tec.nombre_completo, 'Sin asignar') AS asignado_a,
                                   COALESCE(t.calificacion, 'N/A') AS calificacion,
                                   DATE_FORMAT(t.fecha_creacion,'%d/%m/%Y %H:%i') AS fecha_creacion,
                                   COALESCE(DATE_FORMAT(t.fecha_cierre,'%d/%m/%Y %H:%i'), '-') AS fecha_cierre,
                                   t.concepto_tecnico
                            FROM tickets t
                            LEFT JOIN usuarios u   ON t.usuario_id  = u.id
                            LEFT JOIN usuarios tec ON t.tecnico_id  = tec.id
                            LEFT JOIN funcionarios f ON u.id_funcionario = f.id
                            LEFT JOIN areas a      ON f.id_area     = a.id
                            WHERE 1=1";
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%'.$filters['search'].'%';
                        $sql .= " AND (t.titulo LIKE ? OR u.nombre_completo LIKE ? OR t.descripcion LIKE ?)";
                        array_push($params, $s, $s, $s);
                    }
                    if (!empty($filters['estado'])) {
                        $sql .= " AND t.estado = ?"; $params[] = $filters['estado'];
                    }
                    if (!empty($filters['prioridad'])) {
                        $sql .= " AND t.prioridad = ?"; $params[] = $filters['prioridad'];
                    }
                    if (!empty($filters['id_tecnico'])) {
                        $sql .= " AND t.tecnico_id = ?"; $params[] = (int)$filters['id_tecnico'];
                    }
                    if (!empty($filters['id_area'])) {
                        $sql .= " AND f.id_area = ?"; $params[] = (int)$filters['id_area'];
                    }
                    if (!empty($filters['calificacion'])) {
                        if ($filters['calificacion'] === 'unrated') {
                            $sql .= " AND t.calificacion IS NULL";
                        } else {
                            $sql .= " AND t.calificacion = ?"; $params[] = (int)$filters['calificacion'];
                        }
                    }
                    if (!empty($filters['desde'])) {
                        $sql .= " AND DATE(t.fecha_creacion) >= ?"; $params[] = $filters['desde'];
                    }
                    if (!empty($filters['hasta'])) {
                        $sql .= " AND DATE(t.fecha_creacion) <= ?"; $params[] = $filters['hasta'];
                    }

                    $total = $this->doCount("SELECT COUNT(*) FROM tickets t WHERE 1=1", $filters, 'tickets');
                    $sql .= " ORDER BY t.id DESC LIMIT $limit OFFSET $offset";
                    $stmt = $this->pdo->prepare($sql); $stmt->execute($params); $data = $stmt->fetchAll();
                    break;

                /* ─────────────────────── BAJAS ─────────────────────── */
                case 'bajas':
                    $sql = "SELECT b.id,
                                   DATE_FORMAT(b.fecha_baja,'%d/%m/%Y') AS fecha,
                                   b.tipo_activo,
                                   b.categoria,
                                   b.marca,
                                   b.modelo,
                                   b.serial,
                                   b.motivo,
                                   b.cantidad,
                                   u.nombre_completo AS responsable
                            FROM bajas b
                            LEFT JOIN usuarios u ON b.usuario_responsable_id = u.id
                            WHERE 1=1";
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%'.$filters['search'].'%';
                        $sql .= " AND (b.marca LIKE ? OR b.serial LIKE ? OR b.categoria LIKE ? OR b.motivo LIKE ?)";
                        array_push($params, $s, $s, $s, $s);
                    }
                    if (!empty($filters['tipo_activo'])) {
                        $sql .= " AND b.tipo_activo = ?"; $params[] = $filters['tipo_activo'];
                    }
                    if (!empty($filters['desde'])) {
                        $sql .= " AND DATE(b.fecha_baja) >= ?"; $params[] = $filters['desde'];
                    }
                    if (!empty($filters['hasta'])) {
                        $sql .= " AND DATE(b.fecha_baja) <= ?"; $params[] = $filters['hasta'];
                    }

                    $total = $this->doCount("SELECT COUNT(*) FROM bajas b WHERE 1=1", $filters, 'bajas');
                    $sql .= " ORDER BY b.fecha_baja DESC LIMIT $limit OFFSET $offset";
                    $stmt = $this->pdo->prepare($sql); $stmt->execute($params); $data = $stmt->fetchAll();
                    break;

                /* ─────────────────────── LOGS / AUDITORÍA ─────────────────────── */
                case 'logs':
                    $sql = "SELECT a.id,
                                   DATE_FORMAT(a.fecha,'%d/%m/%Y %H:%i:%s') AS fecha,
                                   COALESCE(u.nombre_completo, 'Sistema') AS usuario,
                                   a.tabla,
                                   a.descripcion AS detalle
                            FROM acciones a
                            LEFT JOIN usuarios u ON a.usuario_id = u.id
                            WHERE 1=1";
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%'.$filters['search'].'%';
                        $sql .= " AND (a.descripcion LIKE ? OR a.tabla LIKE ?)";
                        array_push($params, $s, $s);
                    }
                    if (!empty($filters['tabla'])) {
                        $sql .= " AND a.tabla LIKE ?"; $params[] = '%'.$filters['tabla'].'%';
                    }
                    if (!empty($filters['id_usuario'])) {
                        $sql .= " AND a.usuario_id = ?"; $params[] = (int)$filters['id_usuario'];
                    }
                    if (!empty($filters['accion'])) {
                        $sql .= " AND a.descripcion LIKE ?"; $params[] = '%'.$filters['accion'].'%';
                    }
                    if (!empty($filters['desde'])) {
                        $sql .= " AND DATE(a.fecha) >= ?"; $params[] = $filters['desde'];
                    }
                    if (!empty($filters['hasta'])) {
                        $sql .= " AND DATE(a.fecha) <= ?"; $params[] = $filters['hasta'];
                    }

                    $total = $this->doCount("SELECT COUNT(*) FROM acciones a WHERE 1=1", $filters, 'logs');
                    $sql .= " ORDER BY a.fecha DESC LIMIT $limit OFFSET $offset";
                    $stmt = $this->pdo->prepare($sql); $stmt->execute($params); $data = $stmt->fetchAll();
                    break;

                default:
                    json_error('Tipo de reporte no válido');
            }
        } catch (Exception $e) {
            json_error('Error al generar reporte: ' . get_friendly_error($e));
        }

        // Registrar log de descarga/generación de reporte
        $tipoLabels = [
            'equipos'   => 'Inventario de Equipos',
            'repuestos' => 'Inventario de Repuestos',
            'licencias' => 'Licencias de Software',
            'tickets'   => 'Tickets de Soporte',
            'bajas'     => 'Bajas de Activos',
            'logs'      => 'Auditoría / Logs',
        ];
        $tipoLabel = $tipoLabels[$type] ?? $type;
        $filtrosDesc = '';
        if (!empty($filters['desde']) || !empty($filters['hasta'])) {
            $filtrosDesc = ' (Rango: ' . ($filters['desde'] ?? '') . ' al ' . ($filters['hasta'] ?? 'hoy') . ')';
        }
        registrar_log($this->pdo, $_SESSION['user_id'], 'reportes', "Reporte generado: $tipoLabel$filtrosDesc ($total registros)");

        // For equipos, include category breakdown so the frontend can show a summary
        $extra = [];
        if ($type === 'equipos') {            try {
                $catSql = str_replace("SELECT * FROM (", "SELECT categoria_hardware, COUNT(*) as cnt FROM (", $baseSelect);
                $catSql .= " GROUP BY categoria_hardware";
                $catParams = [];
                // Apply same filters for accurate count
                if (!empty($filters['estado'])) {
                    $est = strtolower($filters['estado']);
                    if ($est === 'activo') { $catSql = str_replace("WHERE 1=1 GROUP BY", "WHERE 1=1 AND estado = 'Activo' GROUP BY", $catSql); }
                    elseif ($est === 'mantenimiento') { $catSql = str_replace("WHERE 1=1 GROUP BY", "WHERE 1=1 AND estado = 'En mantenimiento' GROUP BY", $catSql); }
                    elseif ($est === 'baja') { $catSql = str_replace("WHERE 1=1 GROUP BY", "WHERE 1=1 AND estado = 'De baja' GROUP BY", $catSql); }
                    elseif ($est === 'reserva') { $catSql = str_replace("WHERE 1=1 GROUP BY", "WHERE 1=1 AND estado = 'Reserva' GROUP BY", $catSql); }
                }
                if (!empty($filters['id_area'])) { $catSql = str_replace("WHERE 1=1 GROUP BY", "WHERE 1=1 AND id_area = ? GROUP BY", $catSql); $catParams[] = (int)$filters['id_area']; }
                if (!empty($filters['id_marca'])) { $catSql = str_replace("WHERE 1=1 GROUP BY", "WHERE 1=1 AND id_marca = ? GROUP BY", $catSql); $catParams[] = (int)$filters['id_marca']; }
                $catStmt = $this->pdo->prepare($catSql);
                $catStmt->execute($catParams);
                $cats = $catStmt->fetchAll();
                $extra['categoryCounts'] = [];
                foreach ($cats as $c) {
                    $extra['categoryCounts'][$c['categoria_hardware']] = (int)$c['cnt'];
                }
            } catch (Exception $e) {
                // Non-critical, ignore silently
            }
        }

        json_success(array_merge([
            'data'       => $data,
            'total'      => $total,
            'page'       => $page,
            'limit'      => $limit,
            'totalPages' => $limit > 0 ? (int)ceil($total / $limit) : 1
        ], $extra));
    }

    /**
     * Helper para hacer COUNT con filtros básicos
     * (reutiliza la misma lógica de filtros que la query principal)
     */
    private function doCount($baseSql, $filters, $type) {
        $params = [];
        $sql = $baseSql;

        switch ($type) {
            case 'equipos':
                if (!empty($filters['estado'])) {
                    $est = strtolower($filters['estado']);
                    if ($est === 'activo') { $sql .= " AND estado = 'Activo'"; }
                    elseif ($est === 'mantenimiento') { $sql .= " AND estado = 'En mantenimiento'"; }
                    elseif ($est === 'baja') { $sql .= " AND estado = 'De baja'"; }
                    elseif ($est === 'reserva') { $sql .= " AND estado = 'Reserva'"; }
                    else { $sql .= " AND estado = ?"; $params[] = $filters['estado']; }
                }
                if (!empty($filters['id_area'])) { $sql .= " AND id_area = ?"; $params[] = (int)$filters['id_area']; }
                if (!empty($filters['id_marca'])) { $sql .= " AND id_marca = ?"; $params[] = (int)$filters['id_marca']; }
                if (!empty($filters['clasificacion'])) { $sql .= " AND categoria_hardware = ?"; $params[] = $filters['clasificacion']; }
                if (!empty($filters['search'])) {
                    $s = '%'.$filters['search'].'%';
                    $sql .= " AND (nombre_equipo LIKE ? OR serial LIKE ?)";
                    array_push($params, $s, $s);
                }
                break;

            case 'repuestos':
                if (!empty($filters['id_marca'])) { $sql .= " AND id_marca = ?"; $params[] = (int)$filters['id_marca']; }
                if (!empty($filters['stock_min']) && $filters['stock_min'] !== '') { $sql .= " AND cantidad_disponible <= ?"; $params[] = (int)$filters['stock_min']; }
                if (!empty($filters['search'])) {
                    $s = '%'.$filters['search'].'%';
                    $sql .= " AND (nombre LIKE ? OR modelo LIKE ?)";
                    array_push($params, $s, $s);
                }
                break;

            case 'licencias':
                if (!empty($filters['id_area'])) { $sql .= " AND id_area = ?"; $params[] = (int)$filters['id_area']; }
                if (!empty($filters['software'])) { $sql .= " AND nombre_software LIKE ?"; $params[] = '%'.$filters['software'].'%'; }
                if (!empty($filters['search'])) {
                    $s = '%'.$filters['search'].'%';
                    $sql .= " AND (nombre_software LIKE ? OR serial_key LIKE ?)";
                    array_push($params, $s, $s);
                }
                break;

            case 'tickets':
                if (!empty($filters['estado'])) { $sql .= " AND estado = ?"; $params[] = $filters['estado']; }
                if (!empty($filters['prioridad'])) { $sql .= " AND prioridad = ?"; $params[] = $filters['prioridad']; }
                if (!empty($filters['id_tecnico'])) { $sql .= " AND tecnico_id = ?"; $params[] = (int)$filters['id_tecnico']; }
                if (!empty($filters['calificacion'])) {
                    if ($filters['calificacion'] === 'unrated') { $sql .= " AND calificacion IS NULL"; }
                    else { $sql .= " AND calificacion = ?"; $params[] = (int)$filters['calificacion']; }
                }
                if (!empty($filters['desde'])) { $sql .= " AND DATE(fecha_creacion) >= ?"; $params[] = $filters['desde']; }
                if (!empty($filters['hasta'])) { $sql .= " AND DATE(fecha_creacion) <= ?"; $params[] = $filters['hasta']; }
                if (!empty($filters['search'])) {
                    $s = '%'.$filters['search'].'%';
                    $sql .= " AND (titulo LIKE ? OR descripcion LIKE ?)";
                    array_push($params, $s, $s);
                }
                break;

            case 'bajas':
                if (!empty($filters['tipo_activo'])) { $sql .= " AND tipo_activo = ?"; $params[] = $filters['tipo_activo']; }
                if (!empty($filters['desde'])) { $sql .= " AND DATE(fecha_baja) >= ?"; $params[] = $filters['desde']; }
                if (!empty($filters['hasta'])) { $sql .= " AND DATE(fecha_baja) <= ?"; $params[] = $filters['hasta']; }
                if (!empty($filters['search'])) {
                    $s = '%'.$filters['search'].'%';
                    $sql .= " AND (marca LIKE ? OR serial LIKE ? OR categoria LIKE ? OR motivo LIKE ?)";
                    array_push($params, $s, $s, $s, $s);
                }
                break;

            case 'logs':
                if (!empty($filters['tabla'])) { $sql .= " AND tabla LIKE ?"; $params[] = '%'.$filters['tabla'].'%'; }
                if (!empty($filters['id_usuario'])) { $sql .= " AND usuario_id = ?"; $params[] = (int)$filters['id_usuario']; }
                if (!empty($filters['accion'])) { $sql .= " AND descripcion LIKE ?"; $params[] = '%'.$filters['accion'].'%'; }
                if (!empty($filters['desde'])) { $sql .= " AND DATE(fecha) >= ?"; $params[] = $filters['desde']; }
                if (!empty($filters['hasta'])) { $sql .= " AND DATE(fecha) <= ?"; $params[] = $filters['hasta']; }
                if (!empty($filters['search'])) {
                    $s = '%'.$filters['search'].'%';
                    $sql .= " AND (descripcion LIKE ? OR tabla LIKE ?)";
                    array_push($params, $s, $s);
                }
                break;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn();
    }
}
