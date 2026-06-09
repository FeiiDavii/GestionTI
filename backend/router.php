<?php
/**
 * Router para PHP built-in server (desarrollo)
 * Uso: php -S localhost:8080 -t backend/ router.php
 *
 * - Archivos estáticos (uploads, imágenes, etc.) → servir directamente
 * - Todo lo demás → index.php
 */

$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Servir archivos estáticos directamente si existen en disco
$filePath = __DIR__ . $path;
if (is_file($filePath)) {
    return false; // PHP built-in sirve el archivo tal cual
}

// Todo lo demás va al router principal
require_once __DIR__ . '/index.php';
