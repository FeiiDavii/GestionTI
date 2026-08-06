<?php
require_once __DIR__ . '/../config/env.php';

function get_avatar($user_id, $size = 40, $name = 'Usuario') {
    $template = env('AVATAR_URL', '');
    // Sin proveedor configurado -> sin avatar externo (usar iniciales en el frontend)
    if ($template === '') return '';
    return strtr($template, [
        '{name}' => rawurlencode($name),
        '{size}' => (int)$size,
    ]);
}

function get_role_color($role_id) {
    $colors = [1 => '#dc3545', 2 => '#4a6cf7', 3 => '#28a745'];
    return $colors[$role_id] ?? '#6c757d';
}

function time_ago($datetime) {
    $time = strtotime($datetime);
    $diff = time() - $time;
    if ($diff < 60) return "hace {$diff} segundos";
    if ($diff < 3600) return "hace " . floor($diff / 60) . " minutos";
    if ($diff < 86400) return "hace " . floor($diff / 3600) . " horas";
    if ($diff < 604800) return "hace " . floor($diff / 86400) . " días";
    return date('d/m/Y', $time);
}

function registrar_log($pdo, $user_id, $accion, $detalles) {
    try {
        $uid = is_numeric($user_id) ? (int)$user_id : 0;
        $stmt = $pdo->prepare("INSERT INTO acciones (tabla, descripcion, usuario_id) VALUES (?, ?, ?)");
        $stmt->execute([$accion, $detalles, $uid]);
    } catch (Exception $e) {
        error_log("[GestionTI] registrar_log failed: " . $e->getMessage() . " | tabla=$accion | uid=$user_id");
    }
}

function sanitize_input($data, $type = 'string', $maxLength = 255) {
    if ($data === null || $data === '') return null;
    $data = preg_replace('/[\x{10000}-\x{10FFFF}]/u', '', $data);
    $data = trim($data);
    if ($data === '') return '';
    switch ($type) {
        case 'int': return (int)$data;
        case 'float': return (float)$data;
        case 'username': $data = preg_replace('/[^a-zA-Z0-9.@_\-]/', '', $data); break;
        case 'serial': $data = preg_replace('/[^a-zA-Z0-9-]/', '', $data); break;
        case 'text': $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8'); break;
        case 'string': default:
            $data = preg_replace('/[\r\n]+/', ' ', $data);
            $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
            break;
    }
    if ($maxLength > 0 && mb_strlen($data, 'UTF-8') > $maxLength) {
        $data = mb_substr($data, 0, $maxLength, 'UTF-8');
    }
    return $data;
}

function validate_min_length($value, $minLength, $fieldName) {
    if ($value !== null && $value !== '' && mb_strlen($value, 'UTF-8') < $minLength) {
        throw new Exception("El campo '$fieldName' debe tener al menos $minLength caracteres.");
    }
}

function validate_only_alpha($value, $fieldName) {
    if ($value !== null && $value !== '' && !preg_match('/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/u', $value)) {
        throw new Exception("El campo '$fieldName' solo puede contener letras y espacios.");
    }
}

function validate_alphanumeric($value, $fieldName) {
    if ($value !== null && $value !== '') {
        $hasLetters = preg_match('/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/u', $value);
        $hasNumbers = preg_match('/[0-9]/', $value);
        $onlySymbols = preg_match('/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+$/u', $value);
        if ($onlySymbols) throw new Exception("El campo '$fieldName' no puede contener solo símbolos.");
        if (!$hasLetters && !$hasNumbers) throw new Exception("El campo '$fieldName' debe contener letras o números.");
    }
}

function validate_only_numeric($value, $fieldName) {
    if ($value !== null && $value !== '' && !preg_match('/^[0-9]+$/', $value)) {
        throw new Exception("El campo '$fieldName' solo puede contener números.");
    }
}

function validate_password($value, $fieldName) {
    if ($value !== null && $value !== '') {
        if (strlen($value) < 8) throw new Exception("El campo '$fieldName' debe tener al menos 8 caracteres.");
        $hasLetters = preg_match('/[a-zA-Z]/', $value);
        $hasNumbers = preg_match('/[0-9]/', $value);
        if (!$hasLetters || !$hasNumbers) throw new Exception("El campo '$fieldName' debe contener letras y números.");
    }
}

function sanitize_filename($filename) {
    $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
    return time() . '_' . $filename;
}

function json_response($success, $message = '', $data = null, $extra = []) {
    $res = array_merge(['success' => $success, 'message' => $message, 'data' => $data], $extra);
    echo json_encode($res);
    exit;
}

function json_success($data = null, $message = 'Operación exitosa', $extra = []) {
    json_response(true, $message, $data, $extra);
}

function json_error($message = 'Error', $code = 400) {
    http_response_code($code);
    json_response(false, $message);
}
