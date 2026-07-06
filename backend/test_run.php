<?php
require 'config/db.php';
require 'controllers/ReportController.php';
class Auth { public static function requireLogin() {} }
class Permission { public static function require($perm) {} }
function json_success($data) { echo json_encode($data); exit; }
function json_error($msg) { echo json_encode(['error' => $msg]); exit; }

$rc = new ReportController($pdo);
$_POST = json_decode('{"tipo":"equipos","filtros":{},"page":1,"limit":50}', true);
ob_start();
$rc->generate();
$output = ob_get_clean();

$result = json_decode($output, true);
if (isset($result['error'])) {
    echo "ERROR: " . $result['error'];
} else {
    echo "SUCCESS\n";
    echo "Total: " . $result['total'] . "\n";
    echo "Data length: " . count($result['data']) . "\n";
    if (isset($result['categoryCounts'])) {
        echo "Has Category Counts\n";
    }
}
