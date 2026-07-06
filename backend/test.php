<?php
require 'config/db.php';
require 'controllers/ReportController.php';
$rc = new ReportController($pdo);
$_POST = json_decode('{"tipo":"equipos","filtros":{"clasificacion":"Impresora/Escaner"},"page":1,"limit":50}', true);
ob_start();
$rc->generate();
$output = ob_get_clean();
echo $output;
