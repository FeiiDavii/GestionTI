<?php
class SearchController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function global() {
        Auth::requireLogin();
        $q = $_GET['q'] ?? '';
        if (strlen($q) < 2) json_success([]);

        $results = [];
        $param = "%$q%";

        // Routes
        $routes = [
            ['url' => 'dashboard', 'label' => 'Dashboard', 'icon' => 'fa-house', 'type' => 'Ruta'],
            ['url' => 'equipos', 'label' => 'Inventario General', 'icon' => 'fa-desktop', 'type' => 'Ruta'],
            ['url' => 'tickets', 'label' => 'Mesa de Servicios', 'icon' => 'fa-headset', 'type' => 'Ruta'],
            ['url' => 'gestion-tickets', 'label' => 'Gestión de Tickets', 'icon' => 'fa-ticket', 'type' => 'Ruta'],
            ['url' => 'asignaciones', 'label' => 'Repuestos y Partes', 'icon' => 'fa-microchip', 'type' => 'Ruta'],
            ['url' => 'licencias', 'label' => 'Licencias', 'icon' => 'fa-key', 'type' => 'Ruta'],
            ['url' => 'bajas', 'label' => 'Archivo de Bajas', 'icon' => 'fa-skull-crossbones', 'type' => 'Ruta'],
            ['url' => 'mantenimientos', 'label' => 'Hojas de Vida', 'icon' => 'fa-clipboard-list', 'type' => 'Ruta'],
            ['url' => 'reportes', 'label' => 'Reportes', 'icon' => 'fa-chart-pie', 'type' => 'Ruta'],
            ['url' => 'configuracion', 'label' => 'Configuración', 'icon' => 'fa-gear', 'type' => 'Ruta'],
        ];

        foreach ($routes as $r) {
            if (stripos($r['label'], $q) !== false) {
                $r['url'] = '/' . $r['url'];
                $results[] = $r;
            }
        }

        // Equipos
        $stmt = $this->pdo->prepare("SELECT id, nombre_equipo as label, serial as sublabel, 'Equipo' as type, 'fa-computer' as icon, CONCAT('/equipos') as url FROM equipos_de_computo WHERE serial LIKE ? OR nombre_equipo LIKE ? OR modelo LIKE ? LIMIT 5");
        $stmt->execute([$param, $param, $param]);
        foreach ($stmt->fetchAll() as $r) $results[] = $r;

        // Funcionarios
        $stmt = $this->pdo->prepare("SELECT id, CONCAT(nombre,' ',apellido) as label, celular as sublabel, 'Funcionario' as type, 'fa-user' as icon, '/equipos' as url FROM funcionarios WHERE nombre LIKE ? OR apellido LIKE ? LIMIT 5");
        $stmt->execute([$param, $param]);
        foreach ($stmt->fetchAll() as $r) $results[] = $r;

        // Áreas
        $stmt = $this->pdo->prepare("SELECT id, nombre_area as label, codigo_area as sublabel, 'Área' as type, 'fa-building' as icon, '/equipos' as url FROM areas WHERE nombre_area LIKE ? LIMIT 5");
        $stmt->execute([$param]);
        foreach ($stmt->fetchAll() as $r) $results[] = $r;

        json_success($results);
    }
}
