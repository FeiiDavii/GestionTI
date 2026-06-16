<?php
/**
 * StreamController.php
 * Sistema de Tiempo Real via Server-Sent Events (SSE)
 * Monitorea: Notificaciones, Tickets, Chat, Sistema y Force Logout
 *
 * NOTA: session_write_close() se llama en index.php ANTES de llegar aquí,
 * por lo que la sesión ya está liberada y no bloquea otras peticiones.
 * Los datos de sesión ($userId, $permisos) se pasan como parámetros.
 */
class StreamController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function stream() {
        // La sesión ya fue cerrada en index.php; leer datos antes de eso
        // Si llegamos aquí sin user_id en sesión, rechazar
        // (index.php llama session_write_close() pero los datos siguen disponibles
        //  porque session_write_close() solo libera el lock, no destruye $_SESSION)
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'No autorizado']);
            exit;
        }

        $userId          = (int)$_SESSION['user_id'];
        $permisos        = $_SESSION['permisos'] ?? [];
        $puede_ver_global = !empty($permisos['tk_ver_global']);
        $puede_responder  = !empty($permisos['tk_responder']);

        // ── Desactivar todo buffering ─────────────────────────────────────
        @ini_set('output_buffering', 'off');
        @ini_set('zlib.output_compression', false);
        // Vaciar y cerrar todos los niveles de buffer de PHP
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        // ── Headers SSE ───────────────────────────────────────────────────
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');   // Desactiva buffering en nginx/proxy

        set_time_limit(0);
        ignore_user_abort(false);

        $pdo = $this->pdo;

        // ── Estado inicial (snapshot al conectar) ─────────────────────────
        $lastNotifId        = 0;
        $lastTicketChecksum = '';
        $lastChatMaxId      = 0;
        $lastUnreadCount    = -1;
        $lastSystemActionId = 0;

        try {
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM notificaciones");
            $stmt->execute();
            $lastNotifId = (int)$stmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM acciones");
            $stmt->execute();
            $lastSystemActionId = (int)$stmt->fetchColumn();

            $lastTicketChecksum = $this->getTicketState($pdo, $userId, $puede_ver_global, $puede_responder);
            $lastChatMaxId      = (int)$this->getChatState($pdo, $userId, $puede_ver_global, $puede_responder);
        } catch (Exception $e) {
            // Si falla la inicialización, salir limpiamente
            echo "data: " . json_encode(['error' => 'init_failed']) . "\n\n";
            flush();
            exit;
        }

        // ── Loop principal ────────────────────────────────────────────────
        while (true) {
            if (connection_aborted()) break;

            try {
                $updates = [];

                // A. NOTIFICACIONES NUEVAS
                $stmt = $pdo->prepare(
                    "SELECT n.id, n.titulo, n.mensaje, n.tipo, n.fecha, n.leido,
                            n.id_remitente, u.nombre_completo AS remitente_nombre
                     FROM notificaciones n
                     JOIN usuarios u ON n.id_remitente = u.id
                     WHERE n.id > ?
                       AND (
                           (n.tipo = 'personal' AND n.id_destinatario = ?)
                           OR (n.tipo = 'global' AND n.fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY))
                       )
                     ORDER BY n.id ASC"
                );
                $stmt->execute([$lastNotifId, $userId]);
                $newNotifs = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($newNotifs)) {
                    $lastNotifId = (int)end($newNotifs)['id'];
                    $updates['notifications'] = $newNotifs;
                }

                // Contador de no leídas (solo si cambió)
                $stmt = $pdo->prepare(
                    "SELECT COUNT(*) FROM notificaciones
                     WHERE tipo = 'personal' AND id_destinatario = ? AND leido = 0"
                );
                $stmt->execute([$userId]);
                $currentUnread = (int)$stmt->fetchColumn();

                if ($currentUnread !== $lastUnreadCount) {
                    $updates['unread_count'] = $currentUnread;
                    $lastUnreadCount = $currentUnread;
                }

                // B. TICKETS (checksum de estado)
                $currentChecksum = $this->getTicketState($pdo, $userId, $puede_ver_global, $puede_responder);
                if ($currentChecksum !== $lastTicketChecksum) {
                    $lastTicketChecksum = $currentChecksum;
                    $updates['tickets_update'] = true;
                }

                // C. CHAT (nuevo mensaje)
                $currentChatId = (int)$this->getChatState($pdo, $userId, $puede_ver_global, $puede_responder);
                if ($currentChatId > $lastChatMaxId) {
                    $lastChatMaxId = $currentChatId;
                    $updates['chat_update']    = true;
                    $updates['tickets_update'] = true;
                }

                // D. SISTEMA GLOBAL (inventario, catálogos)
                $stmt = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM acciones");
                $stmt->execute();
                $currentActionId = (int)$stmt->fetchColumn();

                if ($currentActionId > $lastSystemActionId) {
                    $lastSystemActionId = $currentActionId;
                    $updates['system_update'] = true;
                }

                // E. FORCE LOGOUT
                $stmt = $pdo->prepare("SELECT force_logout FROM usuarios WHERE id = ?");
                $stmt->execute([$userId]);
                $reason = (int)$stmt->fetchColumn();
                if ($reason > 0) {
                    $pdo->prepare("UPDATE usuarios SET force_logout = 0 WHERE id = ?")->execute([$userId]);
                    $updates['force_logout'] = true;
                    $updates['force_logout_reason'] = $reason;
                }

                // F. ENVIAR AL CLIENTE
                if (!empty($updates)) {
                    $updates['type'] = 'update';
                    echo "data: " . json_encode($updates) . "\n\n";
                } else {
                    echo "event: ping\ndata: {}\n\n";
                }

                // flush() es suficiente cuando no hay output buffer de PHP activo
                flush();

            } catch (PDOException $e) {
                // Error de BD — intentar reconectar en el siguiente ciclo
            } catch (Exception $e) {
                // Silencioso
            }

            sleep(2);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function getTicketState($pdo, $userId, $puedeVG, $puedeResp) {
        if ($puedeVG || $puedeResp) {
            $stmt = $pdo->prepare(
                "SELECT BIT_XOR(CRC32(CONCAT(id, estado, IFNULL(tecnico_id,0), prioridad)))
                 FROM tickets"
            );
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare(
                "SELECT BIT_XOR(CRC32(CONCAT(id, estado, IFNULL(tecnico_id,0), prioridad)))
                 FROM tickets WHERE usuario_id = ?"
            );
            $stmt->execute([$userId]);
        }
        return (string)($stmt->fetchColumn() ?: '0');
    }

    private function getChatState($pdo, $userId, $puedeVG, $puedeResp) {
        if ($puedeVG || $puedeResp) {
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM tickets_chat");
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare(
                "SELECT COALESCE(MAX(tc.id), 0)
                 FROM tickets_chat tc
                 JOIN tickets t ON tc.ticket_id = t.id
                 WHERE t.usuario_id = ?"
            );
            $stmt->execute([$userId]);
        }
        return (int)($stmt->fetchColumn() ?: 0);
    }
}
