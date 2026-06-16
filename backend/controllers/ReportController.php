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
                    $sql = "SELECT e.id,
                                   e.nombre_equipo,
                                   e.serial,
                                   e.serial_interno,
                                   COALESCE(tp.tipo, 'PC') AS tipo,
                                   m.nombre_marca AS marca,
                                   a.nombre_area  AS area,
                                   e.procesador,
                                   c.ram_rom       AS configuracion,
                                   e.sistema_operativo AS so,
                                   e.estado,
                                   e.nivel_clasificacion AS clasificacion,
                                   e.fecha_compra,
                                   e.fecha_baja,
                                   e.precio_compra,
                                   CONCAT(f.nombre,' ',f.apellido) AS responsable,
                                   CONCAT_WS(', ', IF(e.prot_cifrado=1, 'Cifrado', NULL), IF(e.prot_antivirus=1, 'Antivirus', NULL), IF(e.prot_firewall=1, 'Firewall', NULL)) AS protecciones
                            FROM equipos_de_computo e
                            LEFT JOIN marcas m       ON e.id_marca = m.id
                            LEFT JOIN areas a        ON e.id_area  = a.id
                            LEFT JOIN tipos tp       ON e.id_tipo  = tp.id
                            LEFT JOIN configuraciones c ON e.id_configuracion = c.id
                            LEFT JOIN funcionarios f ON e.id_usuario = f.id
                            WHERE e.estado != 'De baja'";
                    $params = [];

                    if (!empty($filters['search'])) {
                        $s = '%' . $filters['search'] . '%';
                        $sql .= " AND (e.nombre_equipo LIKE ? OR e.serial LIKE ?)";
                        array_push($params, $s, $s);
                    }
                    if (!empty($filters['estado'])) {
                        $sql .= " AND e.estado = ?";    $params[] = $filters['estado'];
                    }
                    if (!empty($filters['id_area'])) {
                        $sql .= " AND e.id_area = ?";    $params[] = (int)$filters['id_area'];
                    }
                    if (!empty($filters['id_marca'])) {
                        $sql .= " AND e.id_marca = ?";   $params[] = (int)$filters['id_marca'];
                    }
                    if (!empty($filters['clasificacion'])) {
                        $sql .= " AND e.nivel_clasificacion = ?"; $params[] = $filters['clasificacion'];
                    }

                    $total = $this->doCount("SELECT COUNT(*) FROM equipos_de_computo e WHERE e.estado != 'De baja'", $filters, 'equipos');
                    $sql .= " ORDER BY e.id DESC LIMIT $limit OFFSET $offset";
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
                                   COALESCE(DATE_FORMAT(t.fecha_cierre,'%d/%m/%Y %H:%i'), '-') AS fecha_cierre
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
            json_error('Error al generar reporte: ' . $e->getMessage());
        }

        json_success([
            'data'       => $data,
            'total'      => $total,
            'page'       => $page,
            'limit'      => $limit,
            'totalPages' => $limit > 0 ? (int)ceil($total / $limit) : 1
        ]);
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
                if (!empty($filters['estado'])) { $sql .= " AND estado = ?"; $params[] = $filters['estado']; }
                if (!empty($filters['id_area'])) { $sql .= " AND id_area = ?"; $params[] = (int)$filters['id_area']; }
                if (!empty($filters['id_marca'])) { $sql .= " AND id_marca = ?"; $params[] = (int)$filters['id_marca']; }
                if (!empty($filters['clasificacion'])) { $sql .= " AND nivel_clasificacion = ?"; $params[] = $filters['clasificacion']; }
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
