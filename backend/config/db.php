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
        
        // Duplicate entry (1062) - extraer el campo y valor del mensaje
        if ($code == 1062) {
            if (preg_match("/Duplicate entry '(.+)' for key '(.+)'/", $msg, $matches)) {
                $valor = $matches[1];
                $clave = $matches[2];
                // Mapeo de claves comunes a nombres legibles
                $nombres_campos = [
                    'username' => 'nombre de usuario',
                    'serial' => 'número de serial',
                    'nombre' => 'nombre',
                    'nombre_area' => 'nombre del área',
                    'nombre_marca' => 'nombre de la marca',
                    'tipo' => 'tipo',
                    'email' => 'correo electrónico'
                ];
                $campo_legible = $nombres_campos[$clave] ?? $clave;
                return "El $campo_legible '$valor' ya está registrado en el sistema. Por favor use un valor diferente.";
            }
            return "El registro ya existe (valor duplicado). Verifique que los datos no estén repetidos.";
        }
        
        // Foreign key constraint (1451) - no se puede eliminar por referencias
        if ($code == 1451) {
            if (preg_match("/Cannot delete or update a parent row: a foreign key constraint fails \(.+`(.+)`/", $msg, $matches)) {
                $tabla = $matches[1];
                $nombres_tablas = [
                    'equipos_de_computo' => 'equipos de cómputo',
                    'funcionarios' => 'funcionarios',
                    'areas' => 'áreas',
                    'marcas' => 'marcas',
                    'tipos' => 'tipos',
                    'usuarios' => 'usuarios',
                    'tickets' => 'tickets',
                    'asignaciones' => 'asignaciones'
                ];
                $tabla_legible = $nombres_tablas[$tabla] ?? $tabla;
                return "No se puede eliminar este registro porque está siendo utilizado en $tabla_legible. Elimine o modifique los registros relacionados primero.";
            }
            return "No se puede eliminar: este registro está siendo usado en otras partes del sistema.";
        }
        
        // Foreign key constraint (1452) - valor de referencia no existe
        if ($code == 1452) {
            if (preg_match("/foreign key constraint fails \(.+`(.+)`/", $msg, $matches)) {
                $tabla = $matches[1];
                return "El valor seleccionado en $tabla no existe o fue eliminado. Por favor seleccione una opción válida.";
            }
            return "Error de referencia: el valor seleccionado no existe en el sistema.";
        }
        
        // Field cannot be null (1364)
        if ($code == 1364) {
            if (preg_match("/Field '(.+)' doesn't have a default value/", $msg, $matches)) {
                $campo = $matches[1];
                $nombres_campos = [
                    'username' => 'nombre de usuario',
                    'password' => 'contraseña',
                    'nombre' => 'nombre',
                    'apellido' => 'apellido',
                    'email' => 'correo electrónico',
                    'serial' => 'serial',
                    'modelo' => 'modelo',
                    'id_marca' => 'marca',
                    'id_tipo' => 'tipo',
                    'id_area' => 'área'
                ];
                $campo_legible = $nombres_campos[$campo] ?? $campo;
                return "El campo '$campo_legible' es obligatorio y no fue completado.";
            }
            return "Faltan campos obligatorios. Por favor complete todos los campos requeridos.";
        }
        
        // Incorrect integer value
        if (strpos($msg, 'Incorrect integer value') !== false) {
            return "Un campo numérico recibió un valor inválido. Verifique que los campos de selección estén completados correctamente.";
        }
        
        // Data too long
        if (strpos($msg, 'Data too long') !== false) {
            if (preg_match("/Data too long for column '(.+)' at row/", $msg, $matches)) {
                $campo = $matches[1];
                return "El texto ingresado en el campo '$campo' es demasiado largo. Reduzca la longitud del texto.";
            }
            return "El texto ingresado es demasiado largo para alguno de los campos.";
        }
        
        // Cannot be null
        if (strpos($msg, 'cannot be null') !== false) {
            if (preg_match("/Column '(.+)' cannot be null/", $msg, $matches)) {
                $campo = $matches[1];
                return "El campo '$campo' es obligatorio y no puede estar vacío.";
            }
            return "Un campo obligatorio no fue completado.";
        }
        
        // Out of range value
        if (strpos($msg, 'Out of range value') !== false) {
            return "El valor ingresado está fuera del rango permitido. Verifique los valores numéricos.";
        }
        
        // Syntax error
        if (strpos($msg, 'syntax error') !== false) {
            return "Error en la consulta de base de datos. Contacte al administrador del sistema.";
        }
        
        return "Error de base de datos: " . $msg . ". Por favor revise la información ingresada e intente nuevamente.";
    }
}
