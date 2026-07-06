<?php
require 'config/db.php';
require 'controllers/ReportController.php';

class Auth { public static function requireLogin() {} }
class Permission { public static function require($perm) {} }
function json_success($data) { echo json_encode($data); exit; }
function json_error($msg) { echo json_encode(['error' => $msg]); exit; }

$rc = new ReportController($pdo);
$_POST = json_decode('{"tipo":"equipos","filtros":{},"page":1,"limit":10}', true);
ob_start();
$rc->generate();
$output = ob_get_clean();

$result = json_decode($output, true);
foreach ($result['data'] as $row) {
    echo $row['categoria_hardware'] . " | " . $row['nombre_equipo'] . "\n";
}
