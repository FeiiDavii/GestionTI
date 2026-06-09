<?php
class LicenseController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function list() {
        Auth::requireLogin();
        Auth::checkForceLogout($this->pdo);
        Permission::require('inv_licencias');

        $licencias = $this->pdo->query("SELECT l.*, a.nombre_area, e.nombre_equipo FROM licencias l LEFT JOIN areas a ON l.id_area=a.id LEFT JOIN equipos_de_computo e ON l.id_equipo=e.id ORDER BY l.nombre_software ASC, l.tipo_edicion ASC")->fetchAll();
        $areas = $this->pdo->query("SELECT * FROM areas ORDER BY nombre_area")->fetchAll();
        $equipos = $this->pdo->query("SELECT id, nombre_equipo, serial FROM equipos_de_computo WHERE estado != 'De baja' ORDER BY nombre_equipo")->fetchAll();

        json_success(['licencias' => $licencias, 'areas' => $areas, 'equipos' => $equipos]);
    }

    public function listas() {
        Auth::requireLogin();
        json_success([
            'areas' => $this->pdo->query("SELECT * FROM areas ORDER BY nombre_area")->fetchAll(),
            'equipos' => $this->pdo->query("SELECT id, nombre_equipo, serial FROM equipos_de_computo WHERE estado != 'De baja' ORDER BY nombre_equipo")->fetchAll()
        ]);
    }

    public function create() { $this->save(false); }
    public function update() { $this->save(true); }

    private function save($isUpdate) {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? null;

        try {
            $software = sanitize_input($input['nombre_software'] ?? '', 'string', 100);
            $edicion = sanitize_input($input['tipo_edicion'] ?? '', 'string', 50);
            $serial = sanitize_input($input['serial_key'] ?? '', 'string', 255);
            $area = !empty($input['id_area']) ? (int)$input['id_area'] : null;
            $equipo = !empty($input['id_equipo']) ? (int)$input['id_equipo'] : null;

            if (empty($software) || empty($serial)) json_error('Nombre del software y serial key son obligatorios.');

            // Validate duplicate serial
            $dupSql = "SELECT id FROM licencias WHERE serial_key = ?";
            $dupParams = [$serial];
            if ($id) { $dupSql .= " AND id != ?"; $dupParams[] = $id; }
            $stmt = $this->pdo->prepare($dupSql); $stmt->execute($dupParams);
            if ($stmt->fetch()) json_error("El Serial Key '$serial' ya se encuentra registrado.");

            if ($id) {
                $this->pdo->prepare("UPDATE licencias SET nombre_software=?, tipo_edicion=?, serial_key=?, id_area=?, id_equipo=? WHERE id=?")
                    ->execute([$software, $edicion, $serial, $area, $equipo, $id]);
            } else {
                $this->pdo->prepare("INSERT INTO licencias (nombre_software, tipo_edicion, serial_key, id_area, id_equipo) VALUES (?,?,?,?,?)")
                    ->execute([$software, $edicion, $serial, $area, $equipo]);
            }
            json_success(null, 'Licencia guardada correctamente');
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function delete() {
        Auth::requireLogin();
        Permission::require('inv_eliminar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $this->pdo->prepare("DELETE FROM licencias WHERE id = ?")->execute([$input['id'] ?? 0]);
        json_success(null, 'Licencia eliminada');
    }
}
