<?php
class SearchController {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }

    public function global() {
        Auth::requireLogin();
        $q = $_GET['q'] ?? '';
        if (strlen($q) < 2) json_success([]);

        $searchTerms = explode(' ', strtolower(trim($q)));
        $results = [];

        // Índice estático de módulos, funcionalidades, configuraciones y reportes
        $items = [
            // Módulos
            [
                'url' => '/dashboard',
                'label' => 'Dashboard',
                'sublabel' => 'Panel de control, gráficos y estadísticas generales',
                'icon' => 'fa-house',
                'type' => 'Módulo',
                'keywords' => 'dashboard, inicio, graficos, estadisticas, resumen, kpis, metricas, control'
            ],
            [
                'url' => '/equipos',
                'label' => 'Inventario de Equipos',
                'sublabel' => 'Gestión de computadores y periféricos activos',
                'icon' => 'fa-desktop',
                'type' => 'Módulo',
                'keywords' => 'inventario, equipos, computadores, computo, laptops, pc, hardware, perifericos'
            ],
            [
                'url' => '/tickets',
                'label' => 'Mis Tickets',
                'sublabel' => 'Tus solicitudes de soporte y mesa de servicios',
                'icon' => 'fa-headset',
                'type' => 'Módulo',
                'keywords' => 'tickets, mis tickets, crear ticket, soporte, mesa de ayuda, reportar problema, incidentes'
            ],
            [
                'url' => '/gestion-tickets',
                'label' => 'Gestión de Tickets',
                'sublabel' => 'Administración y atención de casos de soporte global',
                'icon' => 'fa-ticket',
                'type' => 'Módulo',
                'keywords' => 'atender tickets, gestionar tickets, tickets globales, soporte tecnico, bandeja de entrada, incidentes'
            ],
            [
                'url' => '/asignaciones',
                'label' => 'Insumos y Asignaciones',
                'sublabel' => 'Asignación de repuestos y control de stock de partes',
                'icon' => 'fa-microchip',
                'type' => 'Módulo',
                'keywords' => 'insumos, asignaciones, repuestos, stock, partes, inventario insumos, consumibles'
            ],
            [
                'url' => '/licencias',
                'label' => 'Licencias de Software',
                'sublabel' => 'Administración de seriales y activaciones de software',
                'icon' => 'fa-key',
                'type' => 'Módulo',
                'keywords' => 'licencias, software, office, windows, antivirus, seriales, activaciones, llaves'
            ],
            [
                'url' => '/bajas',
                'label' => 'Archivo de Bajas',
                'sublabel' => 'Histórico de activos y periféricos dados de baja',
                'icon' => 'fa-skull-crossbones',
                'type' => 'Módulo',
                'keywords' => 'bajas, descartes, chatarra, motivos de baja, historico bajas, eliminados'
            ],
            [
                'url' => '/mantenimientos',
                'label' => 'Hojas de Vida (Mantenimientos)',
                'sublabel' => 'Historial de mantenimientos preventivos y correctivos',
                'icon' => 'fa-clipboard-list',
                'type' => 'Módulo',
                'keywords' => 'mantenimiento, mantenimiento preventivo, correctivo, hoja de vida, reparaciones, soporte'
            ],
            [
                'url' => '/reportes',
                'label' => 'Reportes del Sistema',
                'sublabel' => 'Generador de informes y reportes personalizados',
                'icon' => 'fa-chart-pie',
                'type' => 'Módulo',
                'keywords' => 'reportes, exportar pdf, exportar csv, informes, descargas, reportes general'
            ],
            [
                'url' => '/configuracion',
                'label' => 'Configuración Global',
                'sublabel' => 'Ajustes del sistema, usuarios y permisos',
                'icon' => 'fa-gear',
                'type' => 'Módulo',
                'keywords' => 'configuracion, ajustes, global, opciones, administrador, settings'
            ],
            [
                'url' => '/perfil',
                'label' => 'Mi Perfil',
                'sublabel' => 'Datos personales y cambio de contraseña',
                'icon' => 'fa-user-gear',
                'type' => 'Módulo',
                'keywords' => 'perfil, mi cuenta, contraseña, password, mis datos'
            ],
            // Configuraciones (Pestañas)
            [
                'url' => '/configuracion?tab=apariencia',
                'label' => 'Apariencia (Modo Oscuro)',
                'sublabel' => 'Tema visual, modo oscuro y diseño de interfaz',
                'icon' => 'fa-palette',
                'type' => 'Configuración',
                'keywords' => 'apariencia, modo oscuro, dark mode, tema, visual, color, diseño, menu'
            ],
            [
                'url' => '/configuracion?tab=usuarios',
                'label' => 'Gestión de Usuarios',
                'sublabel' => 'Crear, activar, desactivar y administrar cuentas de usuario',
                'icon' => 'fa-users',
                'type' => 'Configuración',
                'keywords' => 'usuarios, crear usuario, desactivar usuario, nuevo usuario, password, cuentas'
            ],
            [
                'url' => '/configuracion?tab=roles',
                'label' => 'Roles y Permisos',
                'sublabel' => 'Configurar niveles de acceso y privilegios de seguridad',
                'icon' => 'fa-shield',
                'type' => 'Configuración',
                'keywords' => 'roles, permisos, seguridad, privilegios, accesos, administrador, tecnico, funcionarios'
            ],
            [
                'url' => '/configuracion?tab=sla',
                'label' => 'Configuración de SLAs',
                'sublabel' => 'Acuerdos de niveles de servicio y plazos de respuesta',
                'icon' => 'fa-gauge-high',
                'type' => 'Configuración',
                'keywords' => 'sla, tiempo de respuesta, resolucion, niveles de servicio, prioridades, tiempos'
            ],
            [
                'url' => '/configuracion?tab=sistema',
                'label' => 'Auditoría y Logs del Sistema',
                'sublabel' => 'Historial y logs de auditoría de eventos importantes',
                'icon' => 'fa-clock-rotate-left',
                'type' => 'Configuración',
                'keywords' => 'auditoria, logs, acciones, eventos, historial, sistema, registros, borrar logs'
            ],
            [
                'url' => '/configuracion?tab=sistema',
                'label' => 'Copias de Seguridad (Backup BD)',
                'sublabel' => 'Exportar y restaurar la base de datos SQL del sistema',
                'icon' => 'fa-database',
                'type' => 'Configuración',
                'keywords' => 'backup, respaldo, bd, sql, base de datos, restaurar, importar sql'
            ],
            [
                'url' => '/configuracion?tab=prioridades',
                'label' => 'Palabras Clave de Prioridad',
                'sublabel' => 'Términos para asignación automática de prioridad a tickets',
                'icon' => 'fa-tag',
                'type' => 'Configuración',
                'keywords' => 'prioridades, palabras clave, keywords, asignacion automatica, terminos'
            ],
            // Reportes específicos
            [
                'url' => '/reportes?type=equipos',
                'label' => 'Reporte de Equipos',
                'sublabel' => 'Exportar e informar sobre computadores y activos fijos',
                'icon' => 'fa-file-pdf',
                'type' => 'Reporte',
                'keywords' => 'reporte equipos, informe computadores, exportar hardware, pdf equipos'
            ],
            [
                'url' => '/reportes?type=repuestos',
                'label' => 'Reporte de Repuestos',
                'sublabel' => 'Exportar e informar sobre repuestos e insumos en stock',
                'icon' => 'fa-file-pdf',
                'type' => 'Reporte',
                'keywords' => 'reporte repuestos, informe insumos, exportar stock, pdf repuestos'
            ],
            [
                'url' => '/reportes?type=licencias',
                'label' => 'Reporte de Licencias',
                'sublabel' => 'Exportar e informar sobre licencias de software',
                'icon' => 'fa-file-pdf',
                'type' => 'Reporte',
                'keywords' => 'reporte licencias, informe software, exportar llaves, pdf licencias'
            ],
            [
                'url' => '/reportes?type=tickets',
                'label' => 'Reporte de Tickets',
                'sublabel' => 'Exportar e informar sobre incidentes y cumplimiento de SLAs',
                'icon' => 'fa-file-pdf',
                'type' => 'Reporte',
                'keywords' => 'reporte tickets, informe soporte, exportar casos, calificaciones'
            ],
            [
                'url' => '/reportes?type=bajas',
                'label' => 'Reporte de Bajas',
                'sublabel' => 'Exportar e informar sobre activos descartados',
                'icon' => 'fa-file-pdf',
                'type' => 'Reporte',
                'keywords' => 'reporte bajas, informe descartes, exportar bajas'
            ],
            [
                'url' => '/reportes?type=logs',
                'label' => 'Reporte de Auditoría (Logs)',
                'sublabel' => 'Exportar e informar sobre el historial de actividad y auditoría',
                'icon' => 'fa-file-pdf',
                'type' => 'Reporte',
                'keywords' => 'reporte logs, informe auditoria, exportar eventos'
            ]
        ];

        foreach ($items as $item) {
            $matched = true;
            foreach ($searchTerms as $term) {
                if (stripos($item['label'], $term) === false &&
                    stripos($item['sublabel'], $term) === false &&
                    stripos($item['keywords'], $term) === false &&
                    stripos($item['type'], $term) === false) {
                    $matched = false;
                    break;
                }
            }
            if ($matched) {
                unset($item['keywords']); // No enviar palabras clave al cliente
                $results[] = $item;
            }
        }

        json_success($results);
    }
}
