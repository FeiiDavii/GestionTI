<?php
/**
 * DashboardController.php
 * Devuelve exactamente la misma estructura que IAV2/ajax/dashboard_data.php
 * para que el motor del dashboard React sea idéntico al original.
 */
class DashboardController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function data() {
        Auth::requireLogin();
        Auth::checkForceLogout($this->pdo);
        Permission::requireAny(['inv_ver','tk_ver_global','tk_responder','usr_ver','rep_generar','conf_basica']);

        $permisos         = $_SESSION['permisos'] ?? [];
        $mostrarInventario = !empty($permisos['inv_ver']);
        $mostrarSoporte    = !empty($permisos['tk_ver_global']) || !empty($permisos['tk_responder']);
        $mostrarAuditoria  = !empty($permisos['rep_generar']) || !empty($permisos['conf_basica']) || !empty($permisos['usr_ver']);

        $result = [];

        // ── INVENTARIO ────────────────────────────────────────────────────────
        if ($mostrarInventario) {
            try {
                $totalEquipos    = (int)$this->pdo->query("SELECT COUNT(*) FROM equipos_de_computo WHERE estado != 'De baja'")->fetchColumn();
                $totalPCs        = (int)$this->pdo->query("SELECT COUNT(e.id) FROM equipos_de_computo e LEFT JOIN tipos t ON e.id_tipo=t.id WHERE e.estado!='De baja' AND (LOWER(t.tipo) LIKE '%escritorio%' OR LOWER(t.tipo) LIKE '%pc%' OR LOWER(t.tipo) LIKE '%desktop%' OR LOWER(t.tipo) LIKE '%torre%' OR LOWER(t.tipo) LIKE '%all in one%')")->fetchColumn();
                $totalPortatiles = (int)$this->pdo->query("SELECT COUNT(e.id) FROM equipos_de_computo e LEFT JOIN tipos t ON e.id_tipo=t.id WHERE e.estado!='De baja' AND (LOWER(t.tipo) LIKE '%portátil%' OR LOWER(t.tipo) LIKE '%portatil%' OR LOWER(t.tipo) LIKE '%laptop%' OR LOWER(t.tipo) LIKE '%notebook%')")->fetchColumn();
                $totalImpresoras = (int)$this->pdo->query("SELECT COUNT(*) FROM impresoras_escaneres")->fetchColumn();

                $totalLicencias = 0; $licenciasLibres = 0; $dataSoft = []; $dataLicArea = [];
                if (!empty($permisos['inv_licencias'])) {
                    $totalLicencias  = (int)$this->pdo->query("SELECT COUNT(*) FROM licencias")->fetchColumn();
                    $licenciasLibres = (int)$this->pdo->query("SELECT COUNT(*) FROM licencias WHERE id_equipo IS NULL")->fetchColumn();
                    $dataSoft    = $this->pdo->query("SELECT nombre_software as label, COUNT(*) as value FROM licencias GROUP BY nombre_software ORDER BY value DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
                    $dataLicArea = $this->pdo->query("SELECT a.nombre_area as label, COUNT(l.id) as value FROM licencias l JOIN areas a ON l.id_area=a.id GROUP BY a.nombre_area ORDER BY value DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
                }

                $dataArea  = $this->pdo->query("SELECT a.nombre_area as label, COUNT(e.id) as value FROM equipos_de_computo e JOIN areas a ON e.id_area=a.id WHERE e.estado!='De baja' GROUP BY a.nombre_area ORDER BY value DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
                $dataAsign = $this->pdo->query("SELECT a.nombre_area as label, COUNT(e.id) as value FROM equipos_de_computo e JOIN areas a ON e.id_area=a.id WHERE e.estado!='De baja' AND e.id_usuario IS NOT NULL GROUP BY a.nombre_area ORDER BY value DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
                $dataImp   = $this->pdo->query("SELECT COALESCE(m.nombre_marca,'Genérico') as label, COUNT(i.id) as value FROM impresoras_escaneres i LEFT JOIN marcas m ON i.id_marca=m.id GROUP BY m.nombre_marca ORDER BY value DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

                $result['inventory'] = [
                    'totalPCs'        => $totalPCs,
                    'totalPortatiles' => $totalPortatiles,
                    'totalImpresoras' => $totalImpresoras,
                    'totalEquipos'    => $totalEquipos,
                    'totalLicencias'  => $totalLicencias,
                    'licenciasLibres' => $licenciasLibres,
                    'charts'          => [
                        'area'    => $dataArea,
                        'asign'   => $dataAsign,
                        'imp'     => $dataImp,
                        'soft'    => $dataSoft,
                        'licArea' => $dataLicArea,
                    ],
                ];
            } catch (Exception $e) { $result['inventory_error'] = get_friendly_error($e); }
        }

        // ── SOPORTE ───────────────────────────────────────────────────────────
        if ($mostrarSoporte) {
            try {
                $ticketsAbiertos      = (int)$this->pdo->query("SELECT COUNT(*) FROM tickets WHERE estado='Abierto'")->fetchColumn();
                $ticketsProceso       = (int)$this->pdo->query("SELECT COUNT(*) FROM tickets WHERE estado='En Proceso'")->fetchColumn();
                $ticketsHoy           = (int)$this->pdo->query("SELECT COUNT(*) FROM tickets WHERE DATE(fecha_creacion)=CURDATE()")->fetchColumn();
                $promedioSatisfaccion = round((float)$this->pdo->query("SELECT AVG(calificacion) FROM tickets WHERE calificacion>0")->fetchColumn(), 1);

                $ticketStatusLabels = ['Abierto','En Proceso','Resuelto','Cerrado'];
                $ticketStatusData   = [0,0,0,0];
                $rawTickets = $this->pdo->query("SELECT estado, COUNT(*) as cant FROM tickets GROUP BY estado")->fetchAll(PDO::FETCH_KEY_PAIR);
                foreach ($ticketStatusLabels as $i => $status) {
                    if (isset($rawTickets[$status])) $ticketStatusData[$i] = (int)$rawTickets[$status];
                }

                $dataTicketsArea = $this->pdo->query("SELECT a.nombre_area as label, COUNT(t.id) as value FROM tickets t JOIN usuarios u ON t.usuario_id=u.id JOIN funcionarios f ON u.id_funcionario=f.id JOIN areas a ON f.id_area=a.id GROUP BY a.nombre_area ORDER BY value DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

                $result['support'] = [
                    'ticketsAbiertos'      => $ticketsAbiertos,
                    'ticketsProceso'       => $ticketsProceso,
                    'ticketsHoy'           => $ticketsHoy,
                    'promedioSatisfaccion' => $promedioSatisfaccion,
                    'charts'               => [
                        'tickets'     => ['labels' => $ticketStatusLabels, 'data' => $ticketStatusData],
                        'ticketsArea' => $dataTicketsArea,
                    ],
                ];
            } catch (Exception $e) { $result['support_error'] = get_friendly_error($e); }
        }

        // ── AUDITORÍA ─────────────────────────────────────────────────────────
        if ($mostrarAuditoria) {
            try {
                $result['audit'] = $this->pdo->query("SELECT * FROM acciones ORDER BY fecha DESC LIMIT 8")->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) { $result['audit'] = []; }
        }

        json_success($result);
    }

    // ── CONFIG ────────────────────────────────────────────────────────────────
    public function config() {
        Auth::requireLogin();
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $stmt = $this->pdo->prepare("SELECT dashboard_config FROM usuarios WHERE id=?");
            $stmt->execute([$_SESSION['user_id']]);
            $raw = $stmt->fetchColumn();
            if ($raw) {
                $decoded = json_decode($raw, true);
                // Soportar tanto { version, widgets:[...] } como array directo
                if (isset($decoded['widgets'])) {
                    json_success($decoded);
                } else {
                    json_success(['version' => 1, 'widgets' => is_array($decoded) ? $decoded : []]);
                }
            } else {
                json_success(['version' => 1, 'widgets' => []]);
            }
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            // Aceptar tanto { config: {...} } como { widgets: [...] }
            $config = $input['config'] ?? null;
            if (!$config) {
                $config = ['version' => 1, 'widgets' => $input['widgets'] ?? []];
            }
            $this->pdo->prepare("UPDATE usuarios SET dashboard_config=? WHERE id=?")
                ->execute([json_encode($config), $_SESSION['user_id']]);
            json_success(['savedAt' => date('Y-m-d H:i:s')], 'Configuración guardada');
        }
    }

    public function slaStats() {
        Auth::requireLogin();
        try {
            // Marcar SLA vencidos antes de calcular estadísticas
            $this->pdo->exec(
                "UPDATE sla_registros SET estado_respuesta='Incumplido'
                 WHERE estado_respuesta='Pendiente' AND fecha_respuesta_real IS NULL
                 AND fecha_limite_respuesta < NOW()"
            );
            $this->pdo->exec(
                "UPDATE sla_registros SET estado_resolucion='Incumplido'
                 WHERE estado_resolucion='Pendiente' AND fecha_resolucion_real IS NULL
                 AND fecha_limite_resolucion < NOW()"
            );
            $total      = (int)$this->pdo->query("SELECT COUNT(*) FROM sla_registros")->fetchColumn();
            $cumplidos  = (int)$this->pdo->query("SELECT COUNT(*) FROM sla_registros WHERE estado_respuesta='Cumplido' AND estado_resolucion='Cumplido'")->fetchColumn();
            $incumplidos_resolucion = (int)$this->pdo->query("SELECT COUNT(*) FROM sla_registros WHERE estado_resolucion='Incumplido'")->fetchColumn();
            $pendientes = (int)$this->pdo->query("SELECT COUNT(*) FROM tickets WHERE estado NOT IN ('Cerrado','Resuelto') AND fecha_vencimiento_resolucion > NOW()")->fetchColumn();
            $pct        = $total > 0 ? round(($cumplidos / $total) * 100) : 100;

            $por_prioridad = $this->pdo->query("SELECT t.prioridad as prioridad_ticket, COUNT(*) as total FROM sla_registros s JOIN tickets t ON s.ticket_id=t.id GROUP BY t.prioridad")->fetchAll(PDO::FETCH_ASSOC);
            $proximos = $this->pdo->query("SELECT s.*, t.titulo, t.prioridad, s.fecha_limite_resolucion FROM sla_registros s JOIN tickets t ON s.ticket_id=t.id WHERE t.estado NOT IN ('Cerrado','Resuelto') AND s.fecha_limite_resolucion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR) ORDER BY s.fecha_limite_resolucion ASC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);

            json_success([
                'porcentaje_cumplimiento' => $pct,
                'total'                   => $total,
                'cumplidos'               => $cumplidos,
                'incumplidos_resolucion'  => $incumplidos_resolucion,
                'pendientes'              => $pendientes,
                'por_prioridad'           => $por_prioridad,
                'proximos_a_vencer'       => $proximos,
            ]);
        } catch (Exception $e) {
            json_success([
                'porcentaje_cumplimiento' => 100,
                'total' => 0, 'cumplidos' => 0,
                'incumplidos_resolucion' => 0, 'pendientes' => 0,
                'por_prioridad' => [], 'proximos_a_vencer' => []
            ]);
        }
    }
}
