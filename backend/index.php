<?php
/**
 * Router principal del API REST
 * GestionTI - Sistema de Gestión de Inventario TI
 */

// CORS: solo aplicar desde PHP cuando no viene de Apache (que ya los pone via .htaccess)
if (empty($_SERVER['SERVER_SOFTWARE']) || strpos($_SERVER['SERVER_SOFTWARE'], 'Apache') === false) {
    header('Access-Control-Allow-Origin: http://localhost:5173');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Cache-Control');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    // Asegurar que la cookie de sesión sea accesible desde cualquier path
    // y no tenga restricción de dominio (para funcionar via proxy de Vite)
    ini_set('session.cookie_path', '/');
    ini_set('session.cookie_samesite', 'Lax');
    session_name('PHPSESSID');
    session_start();
}

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/middleware/Auth.php';
require_once __DIR__ . '/middleware/Permission.php';
require_once __DIR__ . '/includes/functions.php';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Strip base path (/api o /GestionTI/backend/index.php)
$basePath = '/api';
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}

// Normalizar: quitar path físico si Apache no usa mod_rewrite limpio
// Ej: /GestionTI/backend/index.php/auth/login → /auth/login
if (preg_match('#/index\.php(.*)$#', $uri, $m)) {
    $uri = $m[1] ?: '/';
}

// Normalizar: cuando Apache sirve desde /GestionTI/backend/
// Ej: /GestionTI/backend/tickets/create → /tickets/create
$apacheBase = '/GestionTI/backend';
if (strpos($uri, $apacheBase) === 0) {
    $uri = substr($uri, strlen($apacheBase));
}

// Serve uploads dynamically
if (strpos($uri, '/uploads/tickets/') === 0) {
    $filename = basename($uri);
    $paths = [
        __DIR__ . '/uploads/tickets/' . $filename,
        __DIR__ . '/../IAV2/uploads/tickets/' . $filename
    ];
    foreach ($paths as $filePath) {
        if (file_exists($filePath)) {
            $mime = mime_content_type($filePath);
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . filesize($filePath));
            readfile($filePath);
            exit;
        }
    }
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Archivo no encontrado']);
    exit;
}

if (empty($uri) || $uri === '/') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'GestionTI API v3.8.0']);
    exit;
}

// ── Ruta SSE: liberar sesión ANTES de entrar al loop infinito ────────────────
if ($uri === '/stream') {
    // Liberar el lock de sesión para no bloquear otras peticiones del usuario
    session_write_close();
    require_once __DIR__ . '/controllers/StreamController.php';
    $controller = new StreamController($pdo);
    $controller->stream();
    exit;
}

// Para todas las demás rutas: respuesta JSON
header('Content-Type: application/json');

// Route mapping
$routes = [
    '/auth/login'              => ['AuthController', 'login'],
    '/auth/logout'             => ['AuthController', 'logout'],
    '/auth/me'                => ['AuthController', 'me'],
    '/auth/permisos'          => ['AuthController', 'permisos'],
    '/auth/recovery'          => ['AuthController', 'recovery'],
    '/auth/change-password'   => ['AuthController', 'changePassword'],
    '/auth/profile-stats'     => ['AuthController', 'profileStats'],
    '/dashboard/data'         => ['DashboardController', 'data'],
    '/dashboard/config'       => ['DashboardController', 'config'],
    '/dashboard/sla-stats'    => ['DashboardController', 'slaStats'],
    '/tickets/my'             => ['TicketController', 'myTickets'],
    '/tickets/all'            => ['TicketController', 'allTickets'],
    '/tickets/detail'         => ['TicketController', 'detail'],
    '/tickets/create'         => ['TicketController', 'create'],
    '/tickets/reply'          => ['TicketController', 'reply'],
    '/tickets/update'         => ['TicketController', 'update'],
    '/tickets/escalate'       => ['TicketController', 'escalate'],
    '/tickets/rate'           => ['TicketController', 'rate'],
    '/tickets/reopen'         => ['TicketController', 'reopen'],
    '/tickets/timeline'       => ['TicketController', 'timeline'],
    '/tickets/chat-users'     => ['TicketController', 'chatUsers'],
    '/equipments'             => ['EquipmentController', 'list'],
    '/equipments/listas'      => ['EquipmentController', 'listas'],
    '/equipments/totales'     => ['EquipmentController', 'totales'],
    '/equipments/create'      => ['EquipmentController', 'create'],
    '/equipments/update'      => ['EquipmentController', 'update'],
    '/equipments/delete'      => ['EquipmentController', 'delete'],
    '/maintenance/list'       => ['MaintenanceController', 'list'],
    '/maintenance/detail'     => ['MaintenanceController', 'detail'],
    '/maintenance/save'       => ['MaintenanceController', 'save'],
    '/maintenance/update'     => ['MaintenanceController', 'update'],
    '/licenses'               => ['LicenseController', 'list'],
    '/licenses/listas'        => ['LicenseController', 'listas'],
    '/licenses/create'        => ['LicenseController', 'create'],
    '/licenses/update'        => ['LicenseController', 'update'],
    '/licenses/delete'        => ['LicenseController', 'delete'],
    '/assignments'            => ['AssignmentController', 'list'],
    '/assignments/asignaciones' => ['AssignmentController', 'asignaciones'],
    '/assignments/save'       => ['AssignmentController', 'save'],
    '/assignments/asignar'    => ['AssignmentController', 'asignar'],
    '/assignments/edit-asignacion' => ['AssignmentController', 'editAsignacion'],
    '/assignments/delete-asignacion' => ['AssignmentController', 'deleteAsignacion'],
    '/bajas/search'           => ['BajasController', 'search'],
    '/bajas/save'             => ['BajasController', 'save'],
    '/bajas/list'             => ['BajasController', 'list'],
    '/bajas/consolidated'     => ['BajasController', 'consolidated'],
    '/notifications'          => ['NotificationController', 'list'],
    '/notifications/send'     => ['NotificationController', 'send'],
    '/notifications/mark-read' => ['NotificationController', 'markRead'],
    '/notifications/mark-read-by-related' => ['NotificationController', 'markReadByRelated'],
    '/reports/generate'       => ['ReportController', 'generate'],
    '/reports/listas'         => ['ReportController', 'listas'],
    '/search/global'          => ['SearchController', 'global'],
    '/aux/areas'              => ['AuxiliaryController', 'areas'],
    '/aux/marcas'             => ['AuxiliaryController', 'marcas'],
    '/aux/tipos'              => ['AuxiliaryController', 'tipos'],
    '/aux/configuraciones'    => ['AuxiliaryController', 'configuraciones'],
    '/aux/funcionarios'       => ['AuxiliaryController', 'funcionarios'],
    '/aux/save'               => ['AuxiliaryController', 'save'],
    '/aux/users'              => ['AuxiliaryController', 'users'],
    '/aux/users/save'         => ['AuxiliaryController', 'saveUser'],
    '/aux/users/toggle-status' => ['AuxiliaryController', 'toggleStatus'],
    '/aux/users/force-logout' => ['AuxiliaryController', 'forceLogout'],
    '/permissions/roles'      => ['PermissionController', 'roles'],
    '/permissions/roles/save' => ['PermissionController', 'saveRole'],
    '/permissions/delete-role' => ['PermissionController', 'deleteRole'],
    '/permissions/config-sla' => ['PermissionController', 'configSLA'],
    '/permissions/save-sla'   => ['PermissionController', 'saveSLA'],
    '/permissions/delete-sla' => ['PermissionController', 'deleteSLA'],
    '/permissions/keywords'   => ['PermissionController', 'keywords'],
    '/permissions/save-keyword' => ['PermissionController', 'saveKeyword'],
    '/permissions/delete-keyword' => ['PermissionController', 'deleteKeyword'],
    '/permissions/logs'       => ['PermissionController', 'logs'],
    '/permissions/clear-logs' => ['PermissionController', 'clearLogs'],
    '/permissions/import-backup' => ['PermissionController', 'importBackup'],
];

// Match routes
foreach ($routes as $route => $handler) {
    if ($uri === $route) {
        $controllerFile = __DIR__ . '/controllers/' . $handler[0] . '.php';
        if (file_exists($controllerFile)) {
            require_once $controllerFile;
            $controller = new $handler[0]($pdo);
            $method_name = $handler[1];
            $controller->$method_name();
            exit;
        }
    }
}

// Dynamic ID pattern: /equipments/{id}
if (preg_match('#^/equipments/(\d+)$#', $uri, $matches)) {
    require_once __DIR__ . '/controllers/EquipmentController.php';
    $controller = new EquipmentController($pdo);
    $_GET['id'] = $matches[1];
    $controller->get();
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Ruta no encontrada: ' . $uri]);
