<?php
class Permission {
    public static function has($permiso) {
        $permisos = $_SESSION['permisos'] ?? [];
        return !empty($permisos[$permiso]);
    }

    public static function require($permiso) {
        if (!self::has($permiso)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Acceso denegado: Permisos insuficientes']);
            exit;
        }
    }

    public static function hasAny($permisosList) {
        foreach ($permisosList as $p) {
            if (self::has($p)) return true;
        }
        return false;
    }

    public static function requireAny($permisosList) {
        if (!self::hasAny($permisosList)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Acceso denegado: Permisos insuficientes']);
            exit;
        }
    }

    public static function isAdmin() {
        return self::has('conf_roles');
    }
}
