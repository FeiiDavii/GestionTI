<?php
class NotificationController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function list() {
        Auth::requireLogin();
        $archived = isset($_GET['archived']) && ($_GET['archived'] === '1' || $_GET['archived'] === 'true');
        $archivedVal = $archived ? 1 : 0;

        $stmt = $this->pdo->prepare("SELECT n.*, u.nombre_completo as remitente_nombre FROM notificaciones n LEFT JOIN usuarios u ON n.id_remitente=u.id WHERE (n.id_destinatario=? OR (n.tipo='global' AND n.id_destinatario IS NULL)) AND COALESCE(n.archivado, 0)=? ORDER BY n.fecha DESC LIMIT 50");
        $stmt->execute([$_SESSION['user_id'], $archivedVal]);
        $notificaciones = $stmt->fetchAll();

        $unread = $this->pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND leido=0 AND COALESCE(archivado, 0)=0");
        $unread->execute([$_SESSION['user_id']]);
        json_success(['data' => $notificaciones, 'unread' => (int)$unread->fetchColumn()]);
    }

    public function send() {
        Auth::requireLogin();
        Permission::requireAny(['conf_basica', 'conf_roles']);
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $titulo = sanitize_input($input['titulo'] ?? '', 'string', 255);
        $mensaje = sanitize_input($input['mensaje'] ?? '', 'text', 1000);
        $tipo = $input['tipo'] ?? 'personal';
        $id_destinatario = $input['id_destinatario'] ?? null;

        if (empty($titulo) || empty($mensaje)) json_error('Título y mensaje son obligatorios.');

        if ($tipo === 'global' && Permission::isAdmin()) {
            $usuarios = $this->pdo->query("SELECT id FROM usuarios WHERE estado=1")->fetchAll();
            foreach ($usuarios as $u) {
                $this->pdo->prepare("INSERT INTO notificaciones (id_destinatario, id_remitente, titulo, mensaje, tipo) VALUES (?,?,?,?,?)")
                    ->execute([$u['id'], $_SESSION['user_id'], $titulo, $mensaje, 'global']);
            }
        } elseif ($id_destinatario) {
            $this->pdo->prepare("INSERT INTO notificaciones (id_destinatario, id_remitente, titulo, mensaje, tipo) VALUES (?,?,?,?,?)")
                ->execute([$id_destinatario, $_SESSION['user_id'], $titulo, $mensaje, 'personal']);
        }
        json_success(null, 'Notificación enviada');
    }

    public function markRead() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        if (!empty($input['all'])) {
            $this->pdo->prepare("UPDATE notificaciones SET leido=1 WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND leido=0")
                ->execute([$_SESSION['user_id']]);
            json_success(null, 'Todas las notificaciones marcadas como leídas');
        }

        $ids = $input['ids'] ?? (!empty($input['id']) ? [$input['id']] : []);
        if (!empty($ids) && is_array($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$_SESSION['user_id']], $ids);
            $this->pdo->prepare("UPDATE notificaciones SET leido=1 WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND id IN ($placeholders)")
                ->execute($params);
            json_success(null, 'Notificaciones marcadas como leídas');
        }

        $id = $input['id'] ?? 0;
        $this->pdo->prepare("UPDATE notificaciones SET leido=1 WHERE id=? AND (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL))")
            ->execute([$id, $_SESSION['user_id']]);
        json_success(null, 'Marcada como leída');
    }

    public function markUnread() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ids = $input['ids'] ?? (!empty($input['id']) ? [$input['id']] : []);
        if (!empty($ids) && is_array($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$_SESSION['user_id']], $ids);
            $this->pdo->prepare("UPDATE notificaciones SET leido=0 WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND id IN ($placeholders)")
                ->execute($params);
            json_success(null, 'Notificaciones marcadas como no leídas');
        }

        $id = $input['id'] ?? 0;
        $this->pdo->prepare("UPDATE notificaciones SET leido=0 WHERE id=? AND (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL))")
            ->execute([$id, $_SESSION['user_id']]);
        json_success(null, 'Marcada como no leída');
    }

    public function markAllRead() {
        Auth::requireLogin();
        $this->pdo->prepare("UPDATE notificaciones SET leido=1 WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND leido=0")
            ->execute([$_SESSION['user_id']]);
        json_success(null, 'Todas las notificaciones marcadas como leídas');
    }

    public function archive() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $unarchive = !empty($input['unarchive']);
        $archivadoVal = $unarchive ? 0 : 1;

        $ids = $input['ids'] ?? (!empty($input['id']) ? [$input['id']] : []);
        if (!empty($ids) && is_array($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$archivadoVal, $_SESSION['user_id']], $ids);
            $this->pdo->prepare("UPDATE notificaciones SET archivado=? WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND id IN ($placeholders)")
                ->execute($params);
            json_success(null, $unarchive ? 'Notificaciones desarchivadas' : 'Notificaciones archivadas');
        }

        $id = $input['id'] ?? 0;
        $this->pdo->prepare("UPDATE notificaciones SET archivado=? WHERE id=? AND (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL))")
            ->execute([$archivadoVal, $id, $_SESSION['user_id']]);
        json_success(null, $unarchive ? 'Notificación desarchivada' : 'Notificación archivada');
    }

    public function delete() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        if (!empty($input['all_archived'])) {
            $this->pdo->prepare("DELETE FROM notificaciones WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND archivado=1")
                ->execute([$_SESSION['user_id']]);
            json_success(null, 'Notificaciones archivadas eliminadas');
        }

        $ids = $input['ids'] ?? (!empty($input['id']) ? [$input['id']] : []);
        if (!empty($ids) && is_array($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$_SESSION['user_id']], $ids);
            $this->pdo->prepare("DELETE FROM notificaciones WHERE (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL)) AND id IN ($placeholders)")
                ->execute($params);
            json_success(null, 'Notificaciones eliminadas');
        }

        $id = $input['id'] ?? 0;
        $this->pdo->prepare("DELETE FROM notificaciones WHERE id=? AND (id_destinatario=? OR (tipo='global' AND id_destinatario IS NULL))")
            ->execute([$id, $_SESSION['user_id']]);
        json_success(null, 'Notificación eliminada');
    }

    public function markReadByRelated() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticketId = $input['ticket_id'] ?? $input['related'] ?? null;
        if ($ticketId) {
            $this->pdo->prepare(
                "UPDATE notificaciones SET leido = 1
                 WHERE parent_id = ? AND (id_destinatario = ? OR (tipo='global' AND id_destinatario IS NULL)) AND leido = 0"
            )->execute([$ticketId, $_SESSION['user_id']]);
        }
        json_success(null, 'Marcadas como leídas');
    }
}
