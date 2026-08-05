<?php
/**
 * TopologyController - Módulo Network Topology Engine
 * GestionTI - Gestión de Infraestructura Física y Lógica
 */

class TopologyController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Obtener todos los nodos y enlaces de la topología
     */
    public function data() {
        Auth::requireLogin();
        Auth::getPermissions($this->pdo);
        Permission::require('inv_topology');

        try {
            // Obtener todos los nodos
            $nodesStmt = $this->pdo->query("SELECT * FROM topology_nodes");
            $dbNodes = $nodesStmt->fetchAll();

            $nodes = [];
            foreach ($dbNodes as $row) {
                $nodes[] = [
                    'id' => $row['id'],
                    'parentId' => $row['parent_id'],
                    'type' => $row['type'],
                    'name' => $row['name'],
                    'position' => [
                        'x' => (float)$row['x'],
                        'y' => (float)$row['y']
                    ],
                    'status' => $row['status'],
                    'criticality' => $row['criticality'],
                    'metadata' => $row['metadata'] ? json_decode($row['metadata'], true) : new stdClass()
                ];
            }

            // Obtener todos los enlaces
            $edgesStmt = $this->pdo->query("SELECT * FROM topology_edges");
            $dbEdges = $edgesStmt->fetchAll();

            $edges = [];
            foreach ($dbEdges as $row) {
                $edges[] = [
                    'id' => $row['id'],
                    'source' => $row['source'],
                    'target' => $row['target'],
                    'type' => $row['type'],
                    'status' => $row['status'],
                    'label' => $row['label'],
                    'color' => $row['color'],
                    'speed' => $row['speed'],
                    'metadata' => $row['metadata'] ? json_decode($row['metadata'], true) : new stdClass()
                ];
            }

            json_success([
                'nodes' => $nodes,
                'edges' => $edges
            ]);
        } catch (Exception $e) {
            json_error("Error al cargar datos de topología: " . $e->getMessage());
        }
    }

    /**
     * Guardar el estado completo de la topología (upsert masivo con eliminación de huérfanos)
     */
    public function save() {
        Auth::requireLogin();
        Auth::getPermissions($this->pdo);
        Permission::require('inv_topology');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['nodes']) || !isset($input['edges'])) {
            json_error("Datos inválidos o incompletos.");
        }

        $nodes = $input['nodes'];
        $edges = $input['edges'];

        try {
            $this->pdo->beginTransaction();
            $this->pdo->query("SET FOREIGN_KEY_CHECKS = 0");

            // 1. Obtener IDs recibidos
            $nodeIds = array_map(function($n) { return $n['id']; }, $nodes);
            $edgeIds = array_map(function($e) { return $e['id']; }, $edges);

            // 2. Eliminar enlaces que ya no existen
            if (!empty($edgeIds)) {
                $placeholders = implode(',', array_fill(0, count($edgeIds), '?'));
                $stmt = $this->pdo->prepare("DELETE FROM topology_edges WHERE id NOT IN ($placeholders)");
                $stmt->execute($edgeIds);
            } else {
                $this->pdo->query("DELETE FROM topology_edges");
            }

            // 3. Eliminar nodos que ya no existen (las claves foráneas en edges se borran en cascada)
            if (!empty($nodeIds)) {
                $placeholders = implode(',', array_fill(0, count($nodeIds), '?'));
                // Primero desenlazar parent_id para evitar conflictos de autorreferencia al eliminar
                $stmt = $this->pdo->prepare("UPDATE topology_nodes SET parent_id = NULL WHERE id NOT IN ($placeholders)");
                $stmt->execute($nodeIds);

                $stmt = $this->pdo->prepare("DELETE FROM topology_nodes WHERE id NOT IN ($placeholders)");
                $stmt->execute($nodeIds);
            } else {
                $this->pdo->query("UPDATE topology_nodes SET parent_id = NULL");
                $this->pdo->query("DELETE FROM topology_nodes");
            }

            // 4. Guardar/Actualizar nodos
            $nodeUpsertSql = "INSERT INTO topology_nodes (id, parent_id, type, name, x, y, status, criticality, metadata) 
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                              ON DUPLICATE KEY UPDATE parent_id = VALUES(parent_id), type = VALUES(type), name = VALUES(name), 
                              x = VALUES(x), y = VALUES(y), status = VALUES(status), criticality = VALUES(criticality), metadata = VALUES(metadata)";
            
            $nodeUpsertStmt = $this->pdo->prepare($nodeUpsertSql);

            // Insertar/actualizar nodos en dos fases si hay jerarquías
            // Primera fase: insertar nodos sin asignar parent_id para evitar errores de FK si el padre aún no existe
            foreach ($nodes as $n) {
                $metadata = isset($n['metadata']) ? json_encode($n['metadata']) : null;
                $posX = isset($n['position']['x']) ? (float)$n['position']['x'] : 0.0;
                $posY = isset($n['position']['y']) ? (float)$n['position']['y'] : 0.0;
                $status = $n['status'] ?? 'online';
                $criticality = $n['criticality'] ?? 'medium';

                $nodeUpsertStmt->execute([
                    $n['id'],
                    null, // parent_id temporalmente null
                    $n['type'],
                    $n['name'],
                    $posX,
                    $posY,
                    $status,
                    $criticality,
                    $metadata
                ]);
            }

            // Segunda fase: actualizar los parent_id ahora que todos los nodos existen
            $updateParentStmt = $this->pdo->prepare("UPDATE topology_nodes SET parent_id = ? WHERE id = ?");
            foreach ($nodes as $n) {
                if (!empty($n['parentId'])) {
                    $updateParentStmt->execute([$n['parentId'], $n['id']]);
                }
            }

            // 5. Guardar/Actualizar enlaces
            $edgeUpsertSql = "INSERT INTO topology_edges (id, source, target, type, status, label, color, speed, metadata)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                              ON DUPLICATE KEY UPDATE type = VALUES(type), status = VALUES(status), label = VALUES(label),
                              color = VALUES(color), speed = VALUES(speed), metadata = VALUES(metadata)";
            
            $edgeUpsertStmt = $this->pdo->prepare($edgeUpsertSql);

            foreach ($edges as $e) {
                $metadata = isset($e['metadata']) ? json_encode($e['metadata']) : null;
                $status = $e['status'] ?? 'active';
                $label = $e['label'] ?? null;
                $color = $e['color'] ?? null;
                $speed = $e['speed'] ?? null;

                $edgeUpsertStmt->execute([
                    $e['id'],
                    $e['source'],
                    $e['target'],
                    $e['type'] ?? 'physical',
                    $status,
                    $label,
                    $color,
                    $speed,
                    $metadata
                ]);
            }

            $this->pdo->query("SET FOREIGN_KEY_CHECKS = 1");
            $this->pdo->commit();
            registrar_log($this->pdo, $_SESSION['user_id'], 'topologia', 'Guardado del estado de la topología de red.');
            json_success(null, "Topología guardada correctamente.");
        } catch (Exception $e) {
            $this->pdo->query("SET FOREIGN_KEY_CHECKS = 1");
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            json_error("Error al guardar la topología: " . $e->getMessage());
        }
    }
}
