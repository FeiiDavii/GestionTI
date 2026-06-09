<?php
class AssignmentController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function list() {
        Auth::requireLogin();
        Permission::require('inv_asignaciones');
        $marcas = $this->pdo->query("SELECT * FROM marcas ORDER BY nombre_marca")->fetchAll();
        $funcionarios = $this->pdo->query("SELECT id, nombre, apellido FROM funcionarios ORDER BY nombre")->fetchAll();
        $areas = $this->pdo->query("SELECT id, nombre_area FROM areas ORDER BY nombre_area")->fetchAll();
        $equipos = $this->pdo->query("SELECT id, nombre_equipo, serial FROM equipos_de_computo WHERE estado != 'De baja' ORDER BY nombre_equipo")->fetchAll();
        $articulos = $this->pdo->query("SELECT a.*, m.nombre_marca FROM articulos a LEFT JOIN marcas m ON a.id_marca=m.id ORDER BY a.nombre ASC")->fetchAll();
        json_success(compact('marcas', 'funcionarios', 'areas', 'equipos', 'articulos'));
    }

    public function asignaciones() {
        Auth::requireLogin();
        $stmt = $this->pdo->query("SELECT asg.*, art.nombre as nombre_articulo, art.modelo, CONCAT(f.nombre,' ',f.apellido) as nombre_funcionario, ar.nombre_area, eq.nombre_equipo FROM asignaciones asg LEFT JOIN articulos art ON asg.id_articulo=art.id LEFT JOIN funcionarios f ON asg.id_usuario=f.id LEFT JOIN areas ar ON asg.id_area=ar.id LEFT JOIN equipos_de_computo eq ON asg.id_equipo=eq.id ORDER BY asg.fecha_asignacion DESC");
        json_success($stmt->fetchAll());
    }

    public function save() {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? null;

        // Handle delete
        if (!empty($input['_delete'])) {
            try {
                $this->pdo->prepare("DELETE FROM articulos WHERE id = ?")->execute([$id]);
                json_success(null, 'Artículo eliminado');
            } catch (PDOException $e) {
                if ($e->getCode() == '23000') json_error('No se puede eliminar: el artículo está asignado.');
                json_error(get_friendly_error($e));
            }
        }

        try {
            require_once __DIR__ . '/../includes/functions.php';
            $nombre = sanitize_input($input['nombre'] ?? '', 'string', 255);
            $modelo = sanitize_input($input['modelo'] ?? '', 'string', 255);
            $marca = !empty($input['id_marca']) ? (int)$input['id_marca'] : null;
            $caract = sanitize_input($input['caracteristicas'] ?? '', 'string', 255);
            $stock = (int)($input['cantidad_disponible'] ?? 0);

            if (empty($nombre)) json_error('El nombre es obligatorio.');
            validate_alphanumeric($nombre, 'Nombre');

            // Duplicate check
            $dupSql = "SELECT id FROM articulos WHERE nombre=? AND modelo=? AND id_marca <=> ?";
            $dupParams = [$nombre, $modelo, $marca];
            if ($id) { $dupSql .= " AND id != ?"; $dupParams[] = $id; }
            $stmt = $this->pdo->prepare($dupSql); $stmt->execute($dupParams);
            if ($stmt->fetch()) json_error("El artículo ya existe. Edite la cantidad disponible del registro existente.");

            if ($id) {
                $this->pdo->prepare("UPDATE articulos SET nombre=?, modelo=?, id_marca=?, caracteristicas=?, cantidad_disponible=? WHERE id=?")
                    ->execute([$nombre, $modelo, $marca, $caract, $stock, $id]);
            } else {
                $this->pdo->prepare("INSERT INTO articulos (nombre, modelo, id_marca, caracteristicas, cantidad_disponible, cantidad_asignada) VALUES (?,?,?,?,?,0)")
                    ->execute([$nombre, $modelo, $marca, $caract, $stock]);
            }
            json_success(null, 'Artículo guardado exitosamente');
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }

    public function asignar() {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $id_articulo = $input['id_articulo'] ?? 0;
        $tipo = $input['tipo_destino'] ?? '';
        $id_usuario = ($tipo === 'funcionario') ? ($input['id_usuario'] ?? null) : null;
        $id_area = ($tipo === 'area') ? ($input['id_area'] ?? null) : null;
        $id_equipo = ($tipo === 'equipo') ? ($input['id_equipo'] ?? null) : null;

        $stmt = $this->pdo->prepare("SELECT cantidad_disponible FROM articulos WHERE id = ?");
        $stmt->execute([$id_articulo]);
        $art = $stmt->fetch();

        if (!$art || $art['cantidad_disponible'] <= 0) json_error('No hay stock disponible.');

        try {
            $this->pdo->beginTransaction();
            $this->pdo->prepare("INSERT INTO asignaciones (id_articulo, id_usuario, id_area, id_equipo) VALUES (?,?,?,?)")
                ->execute([$id_articulo, $id_usuario, $id_area, $id_equipo]);
            $this->pdo->prepare("UPDATE articulos SET cantidad_disponible = cantidad_disponible - 1, cantidad_asignada = cantidad_asignada + 1 WHERE id = ?")
                ->execute([$id_articulo]);
            $this->pdo->commit();
            json_success(null, 'Asignación realizada');
        } catch (Exception $e) {
            $this->pdo->rollBack();
            json_error(get_friendly_error($e));
        }
    }

    public function deleteAsignacion() {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? 0;

        $stmt = $this->pdo->prepare("SELECT id_articulo FROM asignaciones WHERE id = ?");
        $stmt->execute([$id]);
        $asig = $stmt->fetch();

        if ($asig) {
            $this->pdo->beginTransaction();
            $this->pdo->prepare("DELETE FROM asignaciones WHERE id = ?")->execute([$id]);
            $this->pdo->prepare("UPDATE articulos SET cantidad_disponible = cantidad_disponible + 1, cantidad_asignada = cantidad_asignada - 1 WHERE id = ?")
                ->execute([$asig['id_articulo']]);
            $this->pdo->commit();
            json_success(null, 'Asignación deshecha correctamente');
        } else {
            json_error('Asignación no encontrada', 404);
        }
    }

    public function editAsignacion() {
        Auth::requireLogin();
        Permission::require('inv_crear_editar');
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $id = $input['id'] ?? 0;
        $tipo = $input['tipo_destino'] ?? '';
        $id_usuario = ($tipo === 'funcionario') ? ($input['id_usuario'] ?? null) : null;
        $id_area = ($tipo === 'area') ? ($input['id_area'] ?? null) : null;
        $id_equipo = ($tipo === 'equipo') ? ($input['id_equipo'] ?? null) : null;

        try {
            $stmt = $this->pdo->prepare("UPDATE asignaciones SET id_usuario = ?, id_area = ?, id_equipo = ? WHERE id = ?");
            $stmt->execute([$id_usuario, $id_area, $id_equipo, $id]);
            json_success(null, 'Destino de asignación actualizado');
        } catch (Exception $e) {
            json_error(get_friendly_error($e));
        }
    }
}
