<?php
date_default_timezone_set('America/Bogota');

$host = 'localhost';
$db   = 'inventario_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '-05:00'"
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit;
}

if (!function_exists('get_friendly_error')) {
    function get_friendly_error($e) {
        if (!($e instanceof PDOException)) return $e->getMessage();
        $code = $e->errorInfo[1] ?? 0;
        $msg = $e->getMessage();
        if ($code == 1062) return "El registro ya existe (valor duplicado).";
        if ($code == 1451) return "No se puede eliminar: está siendo usado en otras partes del sistema.";
        if ($code == 1452) return "Error de referencia: el valor seleccionado no existe.";
        if ($code == 1364) return "Faltan campos obligatorios.";
        if (strpos($msg, 'Incorrect integer value') !== false) return "Un campo de selección quedó vacío o recibió texto en lugar de un número válido.";
        if (strpos($msg, 'Data too long') !== false) return "El texto ingresado es demasiado largo.";
        if (strpos($msg, 'cannot be null') !== false) return "Un campo obligatorio no fue completado.";
        return "Error de base de datos. Revise la información ingresada.";
    }
}
