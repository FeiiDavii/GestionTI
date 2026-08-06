<?php
/**
 * Configuración externa (variables de entorno / archivo .env)
 *
 * Precedencia: variables de entorno reales > backend/.env > defaults de XAMPP local.
 * No depende de librerías externas (sin dotenv) y no escribe a disco.
 *
 * Variables disponibles (ver backend/.env.example):
 *   DB_HOST, DB_NAME, DB_USER, DB_PASS   -> credenciales de base de datos
 *   APP_ORIGINS                          -> orígenes CORS permitidos (CSV)
 *   AVATAR_URL                           -> plantilla de avatar ({name}, {size})
 */

if (!function_exists('env_load')) {
    function env_load() {
        static $loaded = false;
        if ($loaded) return;
        $loaded = true;

        $file = __DIR__ . '/../.env';
        if (!is_file($file) || !is_readable($file)) return;

        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            $pos = strpos($line, '=');
            if ($pos === false) continue;
            $key   = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));
            if (strlen($value) >= 2 && $value[0] === '"' && substr($value, -1) === '"') {
                $value = substr($value, 1, -1);
            }
            // Las variables de entorno reales tienen prioridad sobre el .env
            if (getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
}

if (!function_exists('env')) {
    function env($key, $default = null) {
        env_load();
        $value = getenv($key);
        if ($value === false || $value === '') return $default;
        return $value;
    }
}

if (!function_exists('app_allowed_origins')) {
    function app_allowed_origins() {
        $raw = env('APP_ORIGINS', 'http://localhost:5173');
        $origins = array_map('trim', explode(',', $raw));
        return array_values(array_filter($origins));
    }
}

if (!function_exists('cors_origin')) {
    /**
     * Devuelve el origen de la petición solo si está en la lista permitida,
     * o null si no hay header Origin o no está permitido.
     */
    function cors_origin() {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin === '') return null;
        return in_array($origin, app_allowed_origins(), true) ? $origin : null;
    }
}

// Cargar al incluir este archivo
env_load();
