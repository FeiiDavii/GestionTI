<?php
class NotificationController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function list() {
        Auth::requireLogin();
        $stmt = $this->pdo->prepare("SELECT n.*, u.nombre_completo as remitente_nombre FROM notificaciones n LEFT JOIN usuarios u ON n.id_remitente=u.id WHERE (n.id_destinatario=? OR n.tipo='global') ORDER BY n.fecha DESC LIMIT 20");
        $stmt->execute([$_SESSION['user_id']]);
        $notificaciones = $stmt->fetchAll();
        $unread = $this->pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE id_destinatario=? AND leido=0");
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
        $this->pdo->prepare("UPDATE notificaciones SET leido=1 WHERE id=? AND id_destinatario=?")
            ->execute([$input['id'] ?? 0, $_SESSION['user_id']]);
        json_success(null, 'Marcada como leída');
    }

    public function markReadByRelated() {
        Auth::requireLogin();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticketId = $input['ticket_id'] ?? $input['related'] ?? null;
        if ($ticketId) {
            $this->pdo->prepare(
                "UPDATE notificaciones SET leido = 1
                 WHERE parent_id = ? AND id_destinatario = ? AND leido = 0"
            )->execute([$ticketId, $_SESSION['user_id']]);
        }
        json_success(null, 'Marcadas como leídas');
    }
}
