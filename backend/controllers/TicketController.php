<?php
class TicketController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    // ─── Helper: enviar notificación con link (idéntico al original IAV2) ──────
    // Los links apuntan a las rutas React del nuevo sistema.
    private function enviarNotificacion($destinatarioId, $titulo, $mensaje, $link = null, $ticketId = null) {
        $remitenteId = $_SESSION['user_id'];
        if ($link) {
            $mensaje .= "<br><br><a href='{$link}' style='display:inline-block; padding:6px 12px; background:#4e73df; color:white; text-decoration:none; border-radius:4px; font-size:12px; font-weight:bold;'>Ver Ticket <i class='fa-solid fa-arrow-right'></i></a>";
        }
        $this->pdo->prepare(
            "INSERT INTO notificaciones (parent_id, titulo, mensaje, tipo, id_destinatario, id_remitente, leido, fecha)
             VALUES (?, ?, ?, 'personal', ?, ?, 0, NOW())"
        )->execute([$ticketId, $titulo, $mensaje, $destinatarioId, $remitenteId]);
    }

    // ─── Rutas React (equivalentes a las rutas PHP del original) ─────────────
    // Original: gestion_tickets.php?ticket_id=X  →  React: /gestion-tickets
    // Original: tickets.php?ticket_id=X          →  React: /tickets
    // Nota: el frontend React navega por estado, no por query param en la URL,
    // así que el link lleva al módulo correcto y el usuario abre el ticket desde ahí.
    private function linkAdmin($ticketId) { return "/gestion-tickets?ticket_id={$ticketId}"; }
    private function linkUser($ticketId)  { return "/tickets?ticket_id={$ticketId}"; }

    // ─── Endpoints ────────────────────────────────────────────────────────────

    public function myTickets() {
        Auth::requireLogin();
        $this->actualizarSLAsVencidos();
        $stmt = $this->pdo->prepare(
            "SELECT t.*, u.nombre_completo as tecnico_nombre
             FROM tickets t LEFT JOIN usuarios u ON t.tecnico_id=u.id
             WHERE t.usuario_id=? ORDER BY t.id DESC"
        );
        $stmt->execute([$_SESSION['user_id']]);
        json_success($stmt->fetchAll());
    }

    public function allTickets() {
        Auth::requireLogin();
        Auth::checkForceLogout($this->pdo);
        Permission::requireAny(['tk_ver_global','tk_responder']);
        $this->actualizarSLAsVencidos();
        $tickets = $this->pdo->query(
            "SELECT t.*, u.nombre_completo as solicitante, tec.nombre_completo as tecnico_nombre
             FROM tickets t
             LEFT JOIN usuarios u ON t.usuario_id=u.id
             LEFT JOIN usuarios tec ON t.tecnico_id=tec.id
             ORDER BY t.id DESC"
        )->fetchAll();
        $tecnicos = $this->pdo->query(
            "SELECT u.id, u.nombre_completo FROM usuarios u
             INNER JOIN roles r ON u.id_rol=r.id
             WHERE r.tk_responder=1 AND u.estado=1 ORDER BY u.nombre_completo"
        )->fetchAll();
        $categorias = ['Software','Software Core','Hardware','Usuarios','Otros'];
        json_success(['tickets' => $tickets, 'tecnicos' => $tecnicos, 'categorias' => $categorias]);
    }

    public function detail() {
        Auth::requireLogin();
        $this->actualizarSLAsVencidos();
        $id = $_GET['id'] ?? 0;
        $stmt = $this->pdo->prepare(
            "SELECT t.*, u.nombre_completo as solicitante, tec.nombre_completo as tecnico_nombre
             FROM tickets t
             LEFT JOIN usuarios u ON t.usuario_id=u.id
             LEFT JOIN usuarios tec ON t.tecnico_id=tec.id
             WHERE t.id=?"
        );
        $stmt->execute([$id]);
        $ticket = $stmt->fetch();
        if (!$ticket) json_error('Ticket no encontrado', 404);

        if (!Permission::has('tk_responder') && !Permission::has('tk_ver_global') && $ticket['usuario_id'] != $_SESSION['user_id']) {
            json_error('No tienes permiso para ver este ticket', 403);
        }

        $chat = $this->pdo->prepare(
            "SELECT tc.*, u.nombre_completo as usuario_nombre
             FROM tickets_chat tc LEFT JOIN usuarios u ON tc.usuario_id=u.id
             WHERE tc.ticket_id=? ORDER BY tc.fecha ASC"
        );
        $chat->execute([$id]);

        $timeline = $this->pdo->prepare(
            "SELECT te.*, u.nombre_completo FROM ticket_eventos te
             LEFT JOIN usuarios u ON te.usuario_id=u.id
             WHERE te.ticket_id=? ORDER BY te.fecha ASC"
        );
        $timeline->execute([$id]);

        json_success([
            'ticket'   => $ticket,
            'chat'     => $chat->fetchAll(),
            'timeline' => $timeline->fetchAll()
        ]);
    }

    public function create() {
        Auth::requireLogin();
        Permission::require('tk_crear');

        $input       = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $descripcion = trim($input['descripcion'] ?? '');
        if (strlen($descripcion) < 10) json_error('La descripción debe tener al menos 10 caracteres');

        $prioridad = $this->detectPriority($descripcion);
        $titulo    = mb_substr($descripcion, 0, 100);

        $adjunto = null;
        $fileKey = isset($_FILES['adjunto']) ? 'adjunto' : (isset($_FILES['archivo']) ? 'archivo' : null);
        if ($fileKey && !empty($_FILES[$fileKey]['name'])) {
            $uploadDir = __DIR__ . '/../uploads/tickets/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $ext      = pathinfo($_FILES[$fileKey]['name'], PATHINFO_EXTENSION);
            $filename = 'ticket_' . time() . '_' . $_SESSION['user_id'] . '.' . $ext;
            if (move_uploaded_file($_FILES[$fileKey]['tmp_name'], $uploadDir . $filename)) {
                $adjunto = $filename;
            }
        }

        // Auto-asignar al técnico con menor carga
        $autoAsignar = !empty($input['auto_asignar']) ? (int)$input['auto_asignar'] : 0;
        $tecnico_id  = null;
        if ($autoAsignar && Permission::has('tk_responder')) {
            $tecnico_id = $_SESSION['user_id'];
        } else {
            $tec = $this->pdo->query(
                "SELECT u.id,
                        (SELECT COUNT(*) FROM tickets WHERE tecnico_id=u.id AND estado IN ('Abierto','En Proceso')) as carga
                 FROM usuarios u INNER JOIN roles r ON u.id_rol=r.id
                 WHERE r.tk_responder=1 AND u.estado=1 ORDER BY carga ASC LIMIT 1"
            )->fetch();
            if ($tec) $tecnico_id = $tec['id'];
        }

        try {
            $this->pdo->beginTransaction();

            $stmt = $this->pdo->prepare(
                "INSERT INTO tickets (usuario_id, tecnico_id, titulo, descripcion, categoria, prioridad, estado, archivo_adjunto)
                 VALUES (?,?,?,?,?,?,?,?)"
            );
            $stmt->execute([$_SESSION['user_id'], $tecnico_id, $titulo, $descripcion, 'Otros', $prioridad, 'Abierto', $adjunto]);
            $ticketId = $this->pdo->lastInsertId();

            // SLA
            $this->createSLA($ticketId, $prioridad);

            // Evento de creación
            $this->pdo->prepare(
                "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
            )->execute([$ticketId, 'creacion', 'Ticket creado', $_SESSION['user_id']]);

            // Registrar en acciones (para SSE system_update)
            $this->pdo->prepare(
                "INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('tickets', ?, ?)"
            )->execute(["Creó ticket #$ticketId", $_SESSION['user_id']]);

            // Notificar a TODOS los técnicos/admins (igual que el original)
            $admins = $this->pdo->query(
                "SELECT u.id FROM usuarios u INNER JOIN roles r ON u.id_rol=r.id
                 WHERE (r.tk_responder=1 OR r.tk_ver_global=1) AND u.estado=1"
            )->fetchAll(PDO::FETCH_COLUMN);

            foreach ($admins as $adminId) {
                if ($adminId == $_SESSION['user_id']) continue;
                $autoMsg = ($tecnico_id == $_SESSION['user_id'])
                    ? "Nuevo Ticket #$ticketId (Auto-asignado). Prioridad: <b>$prioridad</b>."
                    : "Nuevo Ticket #$ticketId. Prioridad: <b>$prioridad</b>. Creado por usuario.";
                $this->enviarNotificacion(
                    $adminId,
                    "Nuevo Ticket #$ticketId",
                    $autoMsg,
                    $this->linkAdmin($ticketId),
                    $ticketId
                );
            }

            $this->pdo->commit();
            json_success(['id' => $ticketId], 'Ticket creado exitosamente');
        } catch (Exception $e) {
            $this->pdo->rollBack();
            json_error(get_friendly_error($e));
        }
    }

    public function reply() {
        Auth::requireLogin();
        $input     = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticket_id = (int)($input['ticket_id'] ?? 0);
        $mensaje   = trim($input['mensaje'] ?? '');
        $esTecnico = !empty($input['es_tecnico']) ? 1 : 0;

        if (strlen($mensaje) < 6) json_error('El mensaje debe tener al menos 6 caracteres');

        $stmt = $this->pdo->prepare("SELECT estado, tecnico_id, usuario_id FROM tickets WHERE id=?");
        $stmt->execute([$ticket_id]);
        $ticket = $stmt->fetch();
        if (!$ticket) json_error('Ticket no encontrado');
        if ($ticket['estado'] === 'Cerrado') json_error('El ticket está cerrado');

        // Permitir si es técnico con permiso OR si es el creador del ticket
        if (!Permission::has('tk_responder') && $ticket['usuario_id'] != $_SESSION['user_id']) {
            json_error('No tienes permiso para responder a este ticket', 403);
        }

        try {
            $this->pdo->prepare(
                "INSERT INTO tickets_chat (ticket_id, usuario_id, mensaje, es_tecnico) VALUES (?,?,?,?)"
            )->execute([$ticket_id, $_SESSION['user_id'], $mensaje, $esTecnico]);

            // Cambiar estado a En Proceso si estaba Abierto
            if ($esTecnico && $ticket['estado'] === 'Abierto') {
                $this->pdo->prepare("UPDATE tickets SET estado='En Proceso' WHERE id=?")->execute([$ticket_id]);
                $this->pdo->prepare(
                    "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
                )->execute([$ticket_id, 'estado', 'Estado cambiado a: En Proceso', $_SESSION['user_id']]);
                $this->pdo->prepare(
                    "INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('tickets', ?, ?)"
                )->execute(["Ticket #$ticket_id pasó a En Proceso", $_SESSION['user_id']]);

                // Notificar al usuario que su ticket está en proceso
                $this->enviarNotificacion(
                    $ticket['usuario_id'],
                    "Actualización Ticket #$ticket_id",
                    "Estado actualizado a <b>En Proceso</b>.",
                    $this->linkUser($ticket_id),
                    $ticket_id
                );
            }

            // SLA: marcar primera respuesta si es técnico
            if ($esTecnico) {
                $slaStmt = $this->pdo->prepare(
                    "SELECT id, fecha_limite_respuesta FROM sla_registros WHERE ticket_id=? AND fecha_respuesta_real IS NULL LIMIT 1"
                );
                $slaStmt->execute([$ticket_id]);
                $slaRow = $slaStmt->fetch();
                if ($slaRow) {
                    $dentroPlazo = strtotime(date('Y-m-d H:i:s')) <= strtotime($slaRow['fecha_limite_respuesta']);
                    $estadoResp = $dentroPlazo ? 'Cumplido' : 'Incumplido';
                    $this->pdo->prepare(
                        "UPDATE sla_registros SET fecha_respuesta_real=NOW(), estado_respuesta=? WHERE id=?"
                    )->execute([$estadoResp, $slaRow['id']]);
                    $this->pdo->prepare(
                        "UPDATE tickets SET fecha_primera_respuesta=NOW(), sla_respuesta_cumplido=? WHERE id=?"
                    )->execute([$dentroPlazo ? 1 : 0, $ticket_id]);
                }
            }

            // Notificar según quién responde
            if ($esTecnico) {
                // Técnico responde → notificar al usuario
                if ($ticket['usuario_id'] != $_SESSION['user_id']) {
                    $this->enviarNotificacion(
                        $ticket['usuario_id'],
                        "Nueva respuesta Ticket #$ticket_id",
                        "Soporte respondió a tu solicitud.",
                        $this->linkUser($ticket_id),
                        $ticket_id
                    );
                }
            } else {
                // Usuario responde → notificar al técnico asignado
                if ($ticket['tecnico_id'] && $ticket['tecnico_id'] != $_SESSION['user_id']) {
                    $this->enviarNotificacion(
                        $ticket['tecnico_id'],
                        "Respuesta Ticket #$ticket_id",
                        "El usuario respondió en el ticket.",
                        $this->linkAdmin($ticket_id),
                        $ticket_id
                    );
                }
            }

            json_success(null, 'Mensaje enviado');
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function update() {
        Auth::requireLogin();
        Permission::requireAny(['tk_responder','tk_asignar_otros']);
        $input     = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticket_id = (int)($input['ticket_id'] ?? 0);
        $estado    = $input['estado']    ?? '';
        $categoria = $input['categoria'] ?? '';
        $tecnico_id = isset($input['tecnico_id']) && $input['tecnico_id'] !== '' && $input['tecnico_id'] !== 'null'
            ? (int)$input['tecnico_id'] : null;

        $categoriasValidas = ['Software','Software Core','Hardware','Usuarios','Otros'];
        if ($categoria && !in_array($categoria, $categoriasValidas)) $categoria = '';

        // Obtener estado actual
        $stmt = $this->pdo->prepare("SELECT estado, tecnico_id, usuario_id FROM tickets WHERE id=?");
        $stmt->execute([$ticket_id]);
        $actual = $stmt->fetch();
        if (!$actual) json_error('Ticket no encontrado');

        $updates = []; $params = [];
        if ($estado)    { $updates[] = 'estado=?';    $params[] = $estado; }
        if ($categoria) { $updates[] = 'categoria=?'; $params[] = $categoria; }
        if ($tecnico_id !== null) { $updates[] = 'tecnico_id=?'; $params[] = $tecnico_id; }

        if (!empty($updates)) {
            $params[] = $ticket_id;
            $this->pdo->prepare("UPDATE tickets SET " . implode(', ', $updates) . " WHERE id=?")->execute($params);

            // SLA: si se resuelve o cierra, marcar resolución SLA
            $esResolucion = in_array($estado, ['Resuelto', 'Cerrado']);

            // Eventos y notificaciones
            if ($estado && $estado !== $actual['estado']) {
                $this->pdo->prepare(
                    "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
                )->execute([$ticket_id, 'estado', "Estado cambiado a: $estado", $_SESSION['user_id']]);

                $this->pdo->prepare(
                    "INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('tickets', ?, ?)"
                )->execute(["Actualizó ticket #$ticket_id a $estado", $_SESSION['user_id']]);

                // Notificar al usuario del ticket
                $this->enviarNotificacion(
                    $actual['usuario_id'],
                    "Actualización Ticket #$ticket_id",
                    "Estado cambiado a: <b>$estado</b>.",
                    $this->linkUser($ticket_id),
                    $ticket_id
                );

                // SLA: marcar resolución si corresponde
                if ($esResolucion) {
                    $this->actualizarSLAResolucion($ticket_id);
                }
            }

            if ($tecnico_id !== null && $tecnico_id != $actual['tecnico_id']) {
                $nombreTec = $this->pdo->prepare("SELECT nombre_completo FROM usuarios WHERE id=?");
                $nombreTec->execute([$tecnico_id]);
                $nombre = $nombreTec->fetchColumn() ?: "ID $tecnico_id";

                $this->pdo->prepare(
                    "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
                )->execute([$ticket_id, 'asignacion', "Asignado a: $nombre", $_SESSION['user_id']]);

                // Notificar al nuevo técnico
                $this->enviarNotificacion(
                    $tecnico_id,
                    "Ticket Asignado #$ticket_id",
                    "Se te ha asignado el caso.",
                    $this->linkAdmin($ticket_id),
                    $ticket_id
                );
            }
        }

        json_success(null, 'Ticket actualizado');
    }

    public function escalate() {
        Auth::requireLogin();
        Permission::requireAny(['tk_responder','tk_asignar_otros']);
        $input     = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticket_id = (int)($input['ticket_id'] ?? 0);
        $tecnico_id = (int)($input['tecnico_id'] ?? 0);
        $motivo    = trim($input['motivo'] ?? '');

        if (!$tecnico_id) json_error('Debe seleccionar un técnico');
        if (strlen($motivo) < 5) json_error('El motivo debe ser más descriptivo');

        $stmt = $this->pdo->prepare("SELECT tecnico_id, usuario_id FROM tickets WHERE id=?");
        $stmt->execute([$ticket_id]);
        $ticket = $stmt->fetch();
        if (!$ticket) json_error('Ticket no encontrado');

        $nombreTec = $this->pdo->prepare("SELECT nombre_completo FROM usuarios WHERE id=?");
        $nombreTec->execute([$tecnico_id]);
        $nombre = $nombreTec->fetchColumn();
        if (!$nombre) json_error('Técnico no encontrado');

        $this->pdo->prepare("UPDATE tickets SET tecnico_id=?, estado='En Proceso' WHERE id=?")->execute([$tecnico_id, $ticket_id]);

        $desc = "Escalado a: $nombre" . ($motivo ? " — Motivo: $motivo" : '');
        $this->pdo->prepare(
            "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
        )->execute([$ticket_id, 'escalacion', $desc, $_SESSION['user_id']]);

        $this->pdo->prepare(
            "INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('tickets', ?, ?)"
        )->execute(["Escaló ticket #$ticket_id a $nombre", $_SESSION['user_id']]);

        // Notificar al técnico destino
        $this->enviarNotificacion(
            $tecnico_id,
            "Ticket Escalado #$ticket_id",
            "Se te ha escalado un caso." . ($motivo ? " Motivo: $motivo" : ''),
            $this->linkAdmin($ticket_id),
            $ticket_id
        );

        // Notificar al usuario solicitante
        $this->enviarNotificacion(
            $ticket['usuario_id'],
            "Ticket Escalado #$ticket_id",
            "Tu caso fue escalado para atención especializada.",
            $this->linkUser($ticket_id),
            $ticket_id
        );

        json_success(null, 'Ticket escalado exitosamente');
    }

    public function rate() {
        Auth::requireLogin();
        $input     = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticket_id = (int)($input['ticket_id'] ?? 0);
        $rating    = (int)($input['rating'] ?? $input['calificacion'] ?? 0);
        $feedback  = trim($input['feedback'] ?? '');

        $this->pdo->prepare(
            "UPDATE tickets SET calificacion=?, feedback_usuario=?, fecha_calificacion=NOW(), estado='Cerrado'
             WHERE id=? AND usuario_id=?"
        )->execute([$rating, $feedback, $ticket_id, $_SESSION['user_id']]);

        $this->pdo->prepare(
            "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
        )->execute([$ticket_id, 'calificacion', "Calificado con $rating estrellas", $_SESSION['user_id']]);

        $this->pdo->prepare(
            "INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('tickets', ?, ?)"
        )->execute(["Calificó y cerró ticket #$ticket_id", $_SESSION['user_id']]);

        json_success(null, 'Gracias por tu calificación');
    }

    public function reopen() {
        Auth::requireLogin();
        $input     = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $ticket_id = (int)($input['ticket_id'] ?? 0);
        $motivo    = trim($input['motivo'] ?? '');

        if (strlen($motivo) < 10) json_error('El motivo debe tener al menos 10 caracteres');

        $stmt = $this->pdo->prepare("SELECT tecnico_id FROM tickets WHERE id=? AND usuario_id=?");
        $stmt->execute([$ticket_id, $_SESSION['user_id']]);
        $ticket = $stmt->fetch();
        if (!$ticket) json_error('Ticket no encontrado');

        $this->pdo->prepare(
            "UPDATE tickets SET estado='Abierto', fecha_cierre=NULL WHERE id=? AND usuario_id=?"
        )->execute([$ticket_id, $_SESSION['user_id']]);

        $this->pdo->prepare(
            "INSERT INTO ticket_eventos (ticket_id, tipo, descripcion, usuario_id) VALUES (?,?,?,?)"
        )->execute([$ticket_id, 'reapertura', "Reabierto: $motivo", $_SESSION['user_id']]);

        // Mensaje en el chat
        $this->pdo->prepare(
            "INSERT INTO tickets_chat (ticket_id, usuario_id, mensaje, es_tecnico) VALUES (?,?,?,0)"
        )->execute([$ticket_id, $_SESSION['user_id'], "[SISTEMA] Caso reabierto por el usuario. Motivo: $motivo"]);

        $this->pdo->prepare(
            "INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES ('tickets', ?, ?)"
        )->execute(["Reabrió ticket #$ticket_id", $_SESSION['user_id']]);

        // Notificar al técnico asignado
        if ($ticket['tecnico_id']) {
            $this->enviarNotificacion(
                $ticket['tecnico_id'],
                "Ticket Reabierto #$ticket_id",
                "El usuario reabrió el caso.",
                $this->linkAdmin($ticket_id),
                $ticket_id
            );
        }

        json_success(null, 'Ticket reabierto');
    }

    public function timeline() {
        Auth::requireLogin();
        $id   = $_GET['id'] ?? 0;

        $stmt = $this->pdo->prepare("SELECT usuario_id FROM tickets WHERE id=?");
        $stmt->execute([$id]);
        $ticket = $stmt->fetch();
        if (!$ticket) json_error('Ticket no encontrado', 404);

        if (!Permission::has('tk_responder') && !Permission::has('tk_ver_global') && $ticket['usuario_id'] != $_SESSION['user_id']) {
            json_error('No tienes permiso para ver este timeline', 403);
        }

        $stmt = $this->pdo->prepare(
            "SELECT te.*, u.nombre_completo FROM ticket_eventos te
             LEFT JOIN usuarios u ON te.usuario_id=u.id
             WHERE te.ticket_id=? ORDER BY te.fecha ASC"
        );
        $stmt->execute([$id]);
        json_success($stmt->fetchAll());
    }

    public function chatUsers() {
        Auth::requireLogin();
        Permission::requireAny(['tk_ver_global','tk_responder']);
        $users = $this->pdo->query(
            "SELECT u.id, u.nombre_completo FROM usuarios u
             INNER JOIN roles r ON u.id_rol=r.id
             WHERE r.tk_responder=1 AND u.estado=1 ORDER BY u.nombre_completo"
        )->fetchAll();
        json_success(['users' => $users]);
    }

    // ─── Privados ─────────────────────────────────────────────────────────────

    private function detectPriority($text) {
        $text     = strtolower($text);
        $keywords = $this->pdo->query(
            "SELECT palabra_clave, prioridad_asignada FROM config_prioridades"
        )->fetchAll();
        $scores   = ['Crítica' => 0, 'Alta' => 0, 'Media' => 0, 'Baja' => 0];
        foreach ($keywords as $kw) {
            if (strpos($text, strtolower($kw['palabra_clave'])) !== false) {
                $scores[$kw['prioridad_asignada']]++;
            }
        }
        if ($scores['Crítica'] > 0) return 'Crítica';
        if ($scores['Alta']    > 0) return 'Alta';
        if ($scores['Media']   > 0) return 'Media';
        return 'Baja';
    }

    private function createSLA($ticketId, $prioridad) {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM sla_config WHERE prioridad_ticket=? AND activo=1 LIMIT 1"
        );
        $stmt->execute([$prioridad]);
        $config = $stmt->fetch();
        if ($config) {
            $respLimite  = date('Y-m-d H:i:s', strtotime("+{$config['tiempo_respuesta_minutos']} minutes"));
            $resolLimite = date('Y-m-d H:i:s', strtotime("+{$config['tiempo_resolucion_minutos']} minutes"));
            $this->pdo->prepare(
                "INSERT INTO sla_registros (ticket_id, sla_config_id, fecha_inicio, fecha_limite_respuesta, fecha_limite_resolucion, estado_respuesta, estado_resolucion)
                 VALUES (?,?,NOW(),?,?,?,?)"
            )->execute([$ticketId, $config['id'], $respLimite, $resolLimite, 'Pendiente', 'Pendiente']);
            $this->pdo->prepare(
                "UPDATE tickets SET fecha_vencimiento_respuesta=?, fecha_vencimiento_resolucion=? WHERE id=?"
            )->execute([$respLimite, $resolLimite, $ticketId]);
        }
    }

    private function actualizarSLAResolucion($ticketId) {
        $slaStmt = $this->pdo->prepare(
            "SELECT id, fecha_limite_resolucion FROM sla_registros WHERE ticket_id=? AND fecha_resolucion_real IS NULL LIMIT 1"
        );
        $slaStmt->execute([$ticketId]);
        $slaRow = $slaStmt->fetch();
        if ($slaRow) {
            $dentroPlazo = strtotime(date('Y-m-d H:i:s')) <= strtotime($slaRow['fecha_limite_resolucion']);
            $estadoResol = $dentroPlazo ? 'Cumplido' : 'Incumplido';
            $this->pdo->prepare(
                "UPDATE sla_registros SET fecha_resolucion_real=NOW(), estado_resolucion=? WHERE id=?"
            )->execute([$estadoResol, $slaRow['id']]);
            $this->pdo->prepare(
                "UPDATE tickets SET fecha_cierre=NOW(), sla_resolucion_cumplido=? WHERE id=?"
            )->execute([$dentroPlazo ? 1 : 0, $ticketId]);
        }
    }

    private function actualizarSLAsVencidos() {
        // Marcar como incumplidas las respuestas vencidas
        $this->pdo->exec(
            "UPDATE sla_registros SET estado_respuesta='Incumplido'
             WHERE estado_respuesta='Pendiente' AND fecha_respuesta_real IS NULL
             AND fecha_limite_respuesta < NOW()"
        );
        // Marcar como incumplidas las resoluciones vencidas
        $this->pdo->exec(
            "UPDATE sla_registros SET estado_resolucion='Incumplido'
             WHERE estado_resolucion='Pendiente' AND fecha_resolucion_real IS NULL
             AND fecha_limite_resolucion < NOW()"
        );
    }
}
