<?php
require 'config/db.php';
$tables = ['equipos_de_computo', 'impresoras_escaneres', 'monitores', 'telefonos', 'otros'];
foreach ($tables as $t) {
    $stmt = $pdo->query("SHOW COLUMNS FROM $t");
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasDate = false;
    foreach ($cols as $c) {
        if (strpos($c['Field'], 'fecha') !== false) {
            echo "$t has: " . $c['Field'] . "\n";
            $hasDate = true;
        }
    }
    if (!$hasDate) echo "$t has NO date\n";
}
