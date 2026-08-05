<?php
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/middleware/Auth.php';
require_once __DIR__ . '/middleware/Permission.php';
require_once __DIR__ . '/includes/functions.php';

$controllerFile = __DIR__ . '/controllers/TopologyController.php';
echo "Controller file exists: " . (file_exists($controllerFile) ? 'YES' : 'NO') . "\n";

try {
    require_once $controllerFile;
    echo "TopologyController class exists: " . (class_exists('TopologyController') ? 'YES' : 'NO') . "\n";
    $controller = new TopologyController($pdo);
    echo "Controller instantiated successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
