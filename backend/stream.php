<?php
/**
 * stream.php — Endpoint SSE independiente (Server-Sent Events)
 *
 * Corre bajo Apache (multi-proceso), separado del PHP built-in que sirve
 * el API REST. Esto evita que el loop infinito bloquee otras peticiones.
 *
 * Proxy Vite: /api/stream → http://localhost:80/GestionTI/backend/stream.php
 */

// Suprimir notices/warnings en el output (no romper el stream SSE)
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/config/env.php';

// CORS dinámico desde configuración (APP_ORIGINS en .env / variables de entorno)
$corsOrigin = cors_origin();
if ($corsOrigin) {
    header('Access-Control-Allow-Origin: ' . $corsOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Cache-Control');
}

// ── SESIÓN (antes de cualquier header) ───────────────────────────────────
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$userId           = (int)$_SESSION['user_id'];
$permisos         = $_SESSION['permisos'] ?? [];
$puede_ver_global = !empty($permisos['tk_ver_global']);
$puede_responder  = !empty($permisos['tk_responder']);

// Liberar el lock de sesión ANTES del loop para no bloquear
// otras peticiones del mismo usuario
session_write_close();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── DESACTIVAR BUFFERING ──────────────────────────────────────────────────
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', false);
while (ob_get_level() > 0) {
    ob_end_clean();
}

// ── HEADERS SSE ───────────────────────────────────────────────────────────
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

set_time_limit(0);
ignore_user_abort(false);

// ── BASE DE DATOS ─────────────────────────────────────────────────────────
require_once __DIR__ . '/config/db.php';

// ── HELPERS ───────────────────────────────────────────────────────────────
function sseGetTicketState(PDO $pdo, int $userId, bool $vg, bool $resp): string {
    if ($vg || $resp) {
        $s = $pdo->prepare(
            "SELECT BIT_XOR(CRC32(CONCAT(id, estado, IFNULL(tecnico_id,0), prioridad))) FROM tickets"
        );
        $s->execute();
    } else {
        $s = $pdo->prepare(
            "SELECT BIT_XOR(CRC32(CONCAT(id, estado, IFNULL(tecnico_id,0), prioridad)))
             FROM tickets WHERE usuario_id = ?"
        );
        $s->execute([$userId]);
    }
    return (string)($s->fetchColumn() ?: '0');
}

function sseGetChatState(PDO $pdo, int $userId, bool $vg, bool $resp): int {
    if ($vg || $resp) {
        $s = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM tickets_chat");
        $s->execute();
    } else {
        $s = $pdo->prepare(
            "SELECT COALESCE(MAX(tc.id), 0) FROM tickets_chat tc
             JOIN tickets t ON tc.ticket_id = t.id WHERE t.usuario_id = ?"
        );
        $s->execute([$userId]);
    }
    return (int)($s->fetchColumn() ?: 0);
}

// ── ESTADO INICIAL (snapshot al conectar, para no disparar eventos viejos) ─
$lastNotifId        = 0;
$lastTicketChecksum = '';
$lastChatMaxId      = 0;
$lastUnreadCount    = -1;
$lastSystemActionId = 0;

try {
    $s = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM notificaciones");
    $s->execute();
    $lastNotifId = (int)$s->fetchColumn();

    $s = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM acciones");
    $s->execute();
    $lastSystemActionId = (int)$s->fetchColumn();

    $lastTicketChecksum = sseGetTicketState($pdo, $userId, $puede_ver_global, $puede_responder);
    $lastChatMaxId      = sseGetChatState($pdo, $userId, $puede_ver_global, $puede_responder);
} catch (Exception $e) {
    echo "data: " . json_encode(['error' => 'init_failed']) . "\n\n";
    flush();
    exit;
}

// ── LOOP PRINCIPAL ────────────────────────────────────────────────────────
while (true) {
    if (connection_aborted()) break;

    try {
        $updates = [];

        // A. NOTIFICACIONES NUEVAS
        $s = $pdo->prepare(
            "SELECT n.id, n.titulo, n.mensaje, n.tipo, n.fecha, n.leido,
                    n.id_remitente, u.nombre_completo AS remitente_nombre
             FROM notificaciones n
             JOIN usuarios u ON n.id_remitente = u.id
             WHERE n.id > ?
               AND (
                   (n.tipo = 'personal' AND n.id_destinatario = ?)
                   OR (n.tipo = 'global' AND n.id_destinatario = ? AND n.fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY))
               )
             ORDER BY n.id ASC"
        );
        $s->execute([$lastNotifId, $userId, $userId]);
        $newNotifs = $s->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($newNotifs)) {
            $lastNotifId = (int)end($newNotifs)['id'];
            $updates['notifications'] = $newNotifs;
        }

        // Contador de no leídas (solo enviar si cambió)
        $s = $pdo->prepare(
            "SELECT COUNT(*) FROM notificaciones
             WHERE id_destinatario = ? AND leido = 0"
        );
        $s->execute([$userId]);
        $currentUnread = (int)$s->fetchColumn();

        if ($currentUnread !== $lastUnreadCount) {
            $updates['unread_count'] = $currentUnread;
            $lastUnreadCount = $currentUnread;
        }

        // B. TICKETS (checksum de estado)
        $currentChecksum = sseGetTicketState($pdo, $userId, $puede_ver_global, $puede_responder);
        if ($currentChecksum !== $lastTicketChecksum) {
            $lastTicketChecksum = $currentChecksum;
            $updates['tickets_update'] = true;
        }

        // C. CHAT (nuevo mensaje)
        $currentChatId = sseGetChatState($pdo, $userId, $puede_ver_global, $puede_responder);
        if ($currentChatId > $lastChatMaxId) {
            $lastChatMaxId             = $currentChatId;
            $updates['chat_update']    = true;
            $updates['tickets_update'] = true; // El estado del ticket puede haber cambiado
        }

        // D. SISTEMA GLOBAL (inventario, catálogos, configuración)
        $s = $pdo->prepare("SELECT COALESCE(MAX(id), 0) FROM acciones");
        $s->execute();
        $currentActionId = (int)$s->fetchColumn();

        if ($currentActionId > $lastSystemActionId) {
            $lastSystemActionId       = $currentActionId;
            $updates['system_update'] = true;
        }

        // E. FORCE LOGOUT
        $s = $pdo->prepare("SELECT force_logout FROM usuarios WHERE id = ?");
        $s->execute([$userId]);
        $reason = (int)$s->fetchColumn();
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
            // Heartbeat — mantiene la conexión viva y permite detectar desconexión
            echo "event: ping\ndata: {}\n\n";
        }

        flush();

    } catch (PDOException $e) {
        // Error de BD — continuar, la conexión puede recuperarse
    } catch (Exception $e) {
        // Silencioso
    }

    sleep(2);
}
