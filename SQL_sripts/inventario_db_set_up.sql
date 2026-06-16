-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 16-06-2026 a las 17:53:12
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `inventario_db`
--
CREATE DATABASE IF NOT EXISTS `inventario_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `inventario_db`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `acciones`
--

CREATE TABLE `acciones` (
  `id` int(11) NOT NULL,
  `tabla` varchar(100) NOT NULL,
  `descripcion` text NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `areas`
--

CREATE TABLE `areas` (
  `id` int(11) NOT NULL,
  `nombre_area` varchar(255) NOT NULL,
  `codigo_area` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `articulos`
--

CREATE TABLE `articulos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `id_marca` int(11) DEFAULT NULL,
  `modelo` varchar(255) DEFAULT NULL,
  `articulo_modelo` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci GENERATED ALWAYS AS (concat(`nombre`,' ',`modelo`)) VIRTUAL,
  `caracteristicas` text DEFAULT NULL,
  `cantidad_disponible` int(11) NOT NULL DEFAULT 0,
  `cantidad_asignada` int(11) NOT NULL DEFAULT 0,
  `cantidad_total` int(11) GENERATED ALWAYS AS (`cantidad_disponible` - -`cantidad_asignada`) VIRTUAL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `asignaciones`
--

CREATE TABLE `asignaciones` (
  `id` int(11) NOT NULL,
  `id_articulo` int(11) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `id_area` int(11) DEFAULT NULL,
  `id_equipo` int(11) DEFAULT NULL,
  `fecha_asignacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `bajas`
--

CREATE TABLE `bajas` (
  `id` int(11) NOT NULL,
  `tipo_activo` enum('Activo Fijo','Insumo/Generico') NOT NULL,
  `categoria` varchar(100) NOT NULL COMMENT 'Ej: PC, Monitor, Teclado, RAM',
  `marca` varchar(100) DEFAULT NULL,
  `modelo` varchar(100) DEFAULT NULL,
  `serial` varchar(100) DEFAULT NULL,
  `serial_interno` varchar(100) DEFAULT NULL,
  `motivo` text NOT NULL,
  `cantidad` int(11) DEFAULT 1,
  `origen_tabla` varchar(50) DEFAULT NULL COMMENT 'Tabla de donde se borró (si aplica)',
  `id_origen` int(11) DEFAULT NULL COMMENT 'ID original (referencia)',
  `usuario_responsable_id` int(11) NOT NULL,
  `fecha_baja` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `configuraciones`
--

CREATE TABLE `configuraciones` (
  `id` int(11) NOT NULL,
  `ram_rom` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `config_prioridades`
--

CREATE TABLE `config_prioridades` (
  `id` int(11) NOT NULL,
  `palabra_clave` varchar(50) NOT NULL,
  `prioridad_asignada` enum('Baja','Media','Alta','Crítica') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `config_prioridades`
--

INSERT INTO `config_prioridades` (`id`, `palabra_clave`, `prioridad_asignada`) VALUES
(1, 'servidor', 'Crítica'),
(2, 'caído', 'Crítica'),
(3, 'hackeado', 'Crítica'),
(4, 'robo', 'Crítica'),
(5, 'incendio', 'Crítica'),
(6, 'virus', 'Crítica'),
(7, 'seguridad', 'Crítica'),
(8, 'perdida de datos', 'Crítica'),
(9, 'no arranca', 'Crítica'),
(10, 'pantalla azul', 'Crítica'),
(11, 'internet', 'Alta'),
(12, 'wifi', 'Alta'),
(13, 'correo', 'Alta'),
(14, 'impresora', 'Alta'),
(15, 'no guarda', 'Alta'),
(16, 'error', 'Alta'),
(17, 'licencia vencida', 'Alta'),
(18, 'office', 'Alta'),
(19, 'sin acceso', 'Alta'),
(20, 'lento', 'Media'),
(21, 'mouse', 'Media'),
(22, 'teclado', 'Media'),
(23, 'monitor', 'Media'),
(24, 'parpadea', 'Media'),
(25, 'ruido', 'Media'),
(26, 'actualizar', 'Media'),
(27, 'programar', 'Media'),
(28, 'consulta', 'Baja'),
(29, 'duda', 'Baja'),
(30, 'instalar', 'Baja'),
(31, 'clave', 'Baja'),
(32, 'password', 'Baja'),
(33, 'toner', 'Baja'),
(34, 'papel', 'Baja'),
(35, 'solicitud', 'Baja'),
(36, 'permiso', 'Baja');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `config_slas`
--

CREATE TABLE `config_slas` (
  `id` int(11) NOT NULL,
  `prioridad` enum('Baja','Media','Alta','Cr??tica') NOT NULL,
  `horas_respuesta` int(11) NOT NULL DEFAULT 24 COMMENT 'Horas m??ximas para primera respuesta',
  `horas_resolucion` int(11) NOT NULL DEFAULT 72 COMMENT 'Horas m??ximas para resoluci??n',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `config_slas`
--

INSERT INTO `config_slas` (`id`, `prioridad`, `horas_respuesta`, `horas_resolucion`, `activo`, `updated_at`) VALUES
(1, 'Cr??tica', 1, 4, 1, '2026-05-22 04:47:06'),
(2, 'Alta', 4, 24, 1, '2026-05-22 04:47:06'),
(3, 'Media', 8, 48, 1, '2026-05-22 04:47:06'),
(4, 'Baja', 24, 72, 1, '2026-05-22 04:47:06');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `equipos_de_computo`
--

CREATE TABLE `equipos_de_computo` (
  `id` int(11) NOT NULL,
  `nombre_equipo` varchar(255) NOT NULL,
  `modelo` varchar(255) DEFAULT NULL,
  `procesador` varchar(255) DEFAULT NULL,
  `sistema_operativo` varchar(100) DEFAULT NULL,
  `teamviewer_id` varchar(50) DEFAULT NULL,
  `teamviewer_version` varchar(50) DEFAULT NULL,
  `serial` varchar(255) NOT NULL,
  `serial_interno` varchar(255) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `id_area` int(11) DEFAULT NULL,
  `id_tipo` int(11) DEFAULT NULL,
  `id_marca` int(11) DEFAULT NULL,
  `id_configuracion` int(11) DEFAULT NULL,
  `fecha_compra` date DEFAULT NULL,
  `precio_compra` decimal(10,2) DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `nivel_clasificacion` enum('Público','Interno','Confidencial','Restringido') NOT NULL DEFAULT 'Interno',
  `prot_cifrado` tinyint(1) NOT NULL DEFAULT 0,
  `prot_antivirus` tinyint(1) NOT NULL DEFAULT 0,
  `prot_firewall` tinyint(1) NOT NULL DEFAULT 0,
  `estado` enum('Activo','En mantenimiento','De baja') NOT NULL DEFAULT 'Activo',
  `fecha_actualizacion` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `fecha_baja` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `funcionarios`
--

CREATE TABLE `funcionarios` (
  `id` int(11) NOT NULL,
  `apellido` varchar(255) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `celular` varchar(50) DEFAULT NULL,
  `id_area` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_equipos`
--

CREATE TABLE `historial_equipos` (
  `id` int(11) NOT NULL,
  `id_equipo` int(11) DEFAULT NULL,
  `tipo_accion` enum('Mantenimiento Preventivo','Mantenimiento Correctivo','Repotenciacion','Actualizacion de Datos') NOT NULL,
  `fecha` date NOT NULL,
  `usuario_id` int(11) NOT NULL COMMENT 'Usuario del sistema que registra la acción',
  `razon` varchar(255) DEFAULT NULL COMMENT 'Para correctivos/repotenciación',
  `observaciones` text NOT NULL,
  `detalles_cambio` text DEFAULT NULL COMMENT 'JSON o texto describiendo el cambio (Ej: Area IT -> RRHH)',
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `impresoras_escaneres`
--

CREATE TABLE `impresoras_escaneres` (
  `id` int(11) NOT NULL,
  `modelo` varchar(255) NOT NULL,
  `serial` varchar(255) NOT NULL,
  `serial_interno` varchar(255) DEFAULT NULL,
  `id_tipo` int(11) DEFAULT NULL,
  `id_marca` int(11) DEFAULT NULL,
  `id_equipo` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `licencias`
--

CREATE TABLE `licencias` (
  `id` int(11) NOT NULL,
  `nombre_software` varchar(100) NOT NULL COMMENT 'Ej: Office 2019, Windows 10',
  `tipo_edicion` varchar(50) DEFAULT NULL COMMENT 'Ej: Home, Pro, Standard',
  `serial_key` varchar(255) NOT NULL,
  `id_area` int(11) DEFAULT NULL,
  `id_equipo` int(11) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `marcas`
--

CREATE TABLE `marcas` (
  `id` int(11) NOT NULL,
  `nombre_marca` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `modulos`
--

CREATE TABLE `modulos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `icono` varchar(50) DEFAULT NULL,
  `ruta` varchar(100) DEFAULT NULL,
  `orden` int(11) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `modulos`
--

INSERT INTO `modulos` (`id`, `nombre`, `descripcion`, `icono`, `ruta`, `orden`, `activo`) VALUES
(1, 'Dashboard', 'Panel principal de estadísticas', 'fa-gauge', 'dashboard.php', 1, 1),
(2, 'Inventario', 'Gestión de equipos y artículos', 'fa-laptop', 'equipos.php', 2, 1),
(3, 'Funcionarios', 'Gestión de personal y áreas', 'fa-users', 'funcionarios.php', 3, 1),
(4, 'Reportes', 'Generación de informes y logs', 'fa-file-lines', 'reportes.php', 4, 1),
(5, 'Configuración', 'Ajustes globales del sistema', 'fa-sliders', 'configuracion.php', 99, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `monitores`
--

CREATE TABLE `monitores` (
  `id` int(11) NOT NULL,
  `modelo` varchar(255) NOT NULL,
  `serial` varchar(255) NOT NULL,
  `serial_interno` varchar(255) DEFAULT NULL,
  `id_marca` int(11) DEFAULT NULL,
  `id_equipo` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notificaciones`
--

CREATE TABLE `notificaciones` (
  `id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `titulo` varchar(100) NOT NULL,
  `mensaje` text NOT NULL,
  `tipo` enum('global','personal') NOT NULL,
  `id_destinatario` int(11) DEFAULT NULL COMMENT 'Null si es global',
  `id_remitente` int(11) NOT NULL,
  `leido` tinyint(1) DEFAULT 0,
  `fecha` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `otros`
--

CREATE TABLE `otros` (
  `id` int(11) NOT NULL,
  `modelo` varchar(255) NOT NULL,
  `serial` varchar(255) NOT NULL,
  `id_tipo` int(11) DEFAULT NULL,
  `id_marca` int(11) DEFAULT NULL,
  `id_area` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `nombre_rol` varchar(50) NOT NULL,
  `descripcion` text NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `inv_ver` tinyint(1) NOT NULL DEFAULT 0,
  `inv_crear_editar` tinyint(1) NOT NULL DEFAULT 0,
  `inv_eliminar` tinyint(1) NOT NULL DEFAULT 0,
  `inv_asignaciones` tinyint(1) NOT NULL DEFAULT 0,
  `inv_licencias` tinyint(1) NOT NULL DEFAULT 0,
  `inv_bajas` tinyint(1) NOT NULL DEFAULT 0,
  `tk_ver_global` tinyint(1) NOT NULL DEFAULT 0,
  `tk_responder` tinyint(1) NOT NULL DEFAULT 0,
  `tk_asignar_otros` tinyint(1) NOT NULL DEFAULT 0,
  `tk_mantenimientos` tinyint(1) NOT NULL DEFAULT 0,
  `tk_crear` tinyint(1) DEFAULT 0,
  `usr_ver` tinyint(1) NOT NULL DEFAULT 0,
  `usr_gestionar` tinyint(1) NOT NULL DEFAULT 0,
  `rep_generar` tinyint(1) NOT NULL DEFAULT 0,
  `conf_basica` tinyint(1) NOT NULL DEFAULT 0,
  `conf_roles` tinyint(1) NOT NULL DEFAULT 0,
  `conf_avanzada` tinyint(1) NOT NULL DEFAULT 0,
  `conf_sla` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `nombre_rol`, `descripcion`, `creado_en`, `inv_ver`, `inv_crear_editar`, `inv_eliminar`, `inv_asignaciones`, `inv_licencias`, `inv_bajas`, `tk_ver_global`, `tk_responder`, `tk_asignar_otros`, `tk_mantenimientos`, `tk_crear`, `usr_ver`, `usr_gestionar`, `rep_generar`, `conf_basica`, `conf_roles`, `conf_avanzada`, `conf_sla`) VALUES
(1, 'Administrador', 'Acceso completo al sistema', '2026-05-25 14:27:37', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
(2, 'Avanzado', 'Puede gestionar equipos y asignaciones', '2026-05-26 14:31:10', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1),
(4, 'Funcionario', 'Solo creación y consulta de tickets', '2026-06-16 15:28:49', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `shared_widget_configs`
--

CREATE TABLE `shared_widget_configs` (
  `id` int(11) NOT NULL,
  `widget_id` varchar(100) NOT NULL,
  `config_name` varchar(100) NOT NULL,
  `config_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`config_data`)),
  `created_by` int(11) NOT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `usage_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sla_config`
--

CREATE TABLE `sla_config` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `prioridad_ticket` enum('Crítica','Alta','Media','Baja') NOT NULL,
  `tiempo_respuesta_minutos` int(11) NOT NULL DEFAULT 60,
  `tiempo_resolucion_minutos` int(11) NOT NULL DEFAULT 240,
  `activo` tinyint(1) DEFAULT 1,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `sla_config`
--

INSERT INTO `sla_config` (`id`, `nombre`, `descripcion`, `prioridad_ticket`, `tiempo_respuesta_minutos`, `tiempo_resolucion_minutos`, `activo`, `fecha_creacion`, `fecha_actualizacion`) VALUES
(1, 'SLA Crítico', 'Para tickets de prioridad crítica - Respuesta en 15 minutos, Resolución en 1 hora', 'Crítica', 15, 60, 1, '2026-05-23 09:45:27', '2026-05-23 10:56:29'),
(2, 'SLA Alta', 'Para tickets de prioridad alta - Respuesta en 30 minutos, Resolución en 4 horas', 'Alta', 30, 240, 1, '2026-05-23 09:45:27', '2026-05-23 09:45:27'),
(3, 'SLA Media', 'Para tickets de prioridad media - Respuesta en 1 hora, Resolución en 8 horas', 'Media', 60, 480, 1, '2026-05-23 09:45:27', '2026-05-23 10:56:25'),
(4, 'SLA Baja', 'Para tickets de prioridad baja - Respuesta en 2 horas, Resolución en 24 horas', 'Baja', 120, 1440, 1, '2026-05-23 09:45:27', '2026-05-25 09:46:25');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sla_registros`
--

CREATE TABLE `sla_registros` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `sla_config_id` int(11) NOT NULL,
  `fecha_inicio` datetime NOT NULL,
  `fecha_limite_respuesta` datetime DEFAULT NULL,
  `fecha_limite_resolucion` datetime DEFAULT NULL,
  `fecha_respuesta_real` datetime DEFAULT NULL,
  `fecha_resolucion_real` datetime DEFAULT NULL,
  `estado_respuesta` enum('Pendiente','Cumplido','Incumplido') DEFAULT 'Pendiente',
  `estado_resolucion` enum('Pendiente','Cumplido','Incumplido') DEFAULT 'Pendiente',
  `porcentaje_cumplimiento` decimal(5,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `telefonos`
--

CREATE TABLE `telefonos` (
  `id` int(11) NOT NULL,
  `serial` varchar(255) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `extension` varchar(50) DEFAULT NULL,
  `id_marca` int(11) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tickets`
--

CREATE TABLE `tickets` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL COMMENT 'El funcionario que reporta',
  `tecnico_id` int(11) DEFAULT NULL COMMENT 'El admin/avanzado que atiende',
  `titulo` varchar(150) NOT NULL,
  `descripcion` text NOT NULL,
  `categoria` enum('Software','Software Core','Hardware','Usuarios','Otros') DEFAULT NULL,
  `prioridad` enum('Baja','Media','Alta','Crítica') NOT NULL DEFAULT 'Baja',
  `estado` enum('Abierto','En Proceso','Resuelto','Cerrado') NOT NULL DEFAULT 'Abierto',
  `nivel_servicio` enum('Nivel 1','Nivel 2','Nivel 3','Proveedor') DEFAULT 'Nivel 1',
  `calificacion` int(1) DEFAULT NULL COMMENT 'Estrellas 1 a 5',
  `feedback_usuario` text DEFAULT NULL COMMENT 'Opinión del servicio',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_cierre` datetime DEFAULT NULL,
  `archivo_adjunto` varchar(255) DEFAULT NULL,
  `fecha_calificacion` datetime DEFAULT NULL,
  `fecha_vencimiento_respuesta` datetime DEFAULT NULL COMMENT 'Plazo l??mite primera respuesta',
  `fecha_vencimiento_resolucion` datetime DEFAULT NULL COMMENT 'Plazo l??mite resoluci??n',
  `fecha_primera_respuesta` datetime DEFAULT NULL COMMENT 'Cu??ndo se dio la primera respuesta t??cnica',
  `sla_respuesta_cumplido` tinyint(1) DEFAULT NULL COMMENT '1=cumplido, 0=incumplido, NULL=pendiente',
  `sla_resolucion_cumplido` tinyint(1) DEFAULT NULL COMMENT '1=cumplido, 0=incumplido, NULL=pendiente'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tickets_chat`
--

CREATE TABLE `tickets_chat` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL COMMENT 'Quien escribe el mensaje',
  `mensaje` text NOT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `es_tecnico` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 si es respuesta de soporte, 0 si es el usuario'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tickets_trazabilidad`
--

CREATE TABLE `tickets_trazabilidad` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `accion` varchar(100) NOT NULL,
  `detalles` text DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ticket_eventos`
--

CREATE TABLE `ticket_eventos` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `tipo` enum('creacion','asignacion','escalacion','estado','calificacion','reapertura') NOT NULL,
  `descripcion` varchar(500) NOT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tipos`
--

CREATE TABLE `tipos` (
  `id` int(11) NOT NULL,
  `tipo` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nombre_completo` varchar(255) NOT NULL,
  `id_rol` int(11) DEFAULT 3,
  `estado` tinyint(1) DEFAULT 1 COMMENT '1: Activo, 0: Inactivo',
  `ultimo_acceso` timestamp NULL DEFAULT NULL,
  `id_funcionario` int(11) DEFAULT NULL,
  `dashboard_config` longtext DEFAULT NULL COMMENT 'JSON de configuración del dashboard personalizable (widgets, posiciones, estilos)',
  `force_logout` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `username`, `password`, `nombre_completo`, `id_rol`, `estado`, `ultimo_acceso`, `id_funcionario`, `dashboard_config`, `force_logout`) VALUES
(1, 'ADMIN', '$2y$10$rxCjAjP0txyIbypgc.kdxucwhbxivynV/AJdRM/nuBBOAZ70XenTu', 'Administrador principal del sistema', 1, 1, '2026-06-16 15:08:06', NULL, '{\"version\":1,\"savedAt\":\"2026-06-12 08:37:24\",\"widgets\":[{\"id\":\"w_17812118383581\",\"type\":\"kpi_pcs\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":0,\"config\":[]},{\"id\":\"w_17812118383582\",\"type\":\"kpi_portatiles\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":1,\"config\":[]},{\"id\":\"w_17812118383583\",\"type\":\"kpi_impresoras\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":2,\"config\":[]},{\"id\":\"w_17812118383584\",\"type\":\"kpi_licencias\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":3,\"config\":[]},{\"id\":\"w_17812118383585\",\"type\":\"chart_area\",\"colStart\":1,\"colSpan\":6,\"rowSpan\":2,\"order\":4,\"config\":[]},{\"id\":\"w_17812118383586\",\"type\":\"chart_asign\",\"colStart\":7,\"colSpan\":6,\"rowSpan\":2,\"order\":5,\"config\":[]},{\"id\":\"w_17812118383587\",\"type\":\"kpi_tickets_abiertos\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":6,\"config\":[]},{\"id\":\"w_17812118383588\",\"type\":\"kpi_tickets_proceso\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":7,\"config\":[]},{\"id\":\"w_17812118383589\",\"type\":\"kpi_tickets_hoy\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":8,\"config\":[]},{\"id\":\"w_178121183835810\",\"type\":\"kpi_satisfaccion\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":9,\"config\":[]},{\"id\":\"w_178121183835811\",\"type\":\"list_auditoria\",\"colStart\":1,\"colSpan\":12,\"rowSpan\":2,\"order\":10,\"config\":[]}]}', 0),
(2, 'FREIDERD', '$2y$10$zE0WrkhrVWUlQpAllzaXK.dK4niZhYXCm2WKZmojUrrNpfFaVYjiK', 'Freider David De la cruz Teherán', 1, 1, '2026-06-16 15:35:38', 10, '{\"version\":1,\"widgets\":[{\"id\":\"w_1781042483086_q24w26\",\"type\":\"kpi_sla_pendientes\",\"colStart\":1,\"colSpan\":4,\"rowStart\":9,\"rowSpan\":1,\"order\":11,\"config\":[]},{\"id\":\"w_1781040968502_1\",\"type\":\"kpi_pcs\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":0,\"rowStart\":1},{\"id\":\"w_1781040968502_2\",\"type\":\"kpi_portatiles\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":1,\"rowStart\":1},{\"id\":\"w_1781040968502_3\",\"type\":\"kpi_impresoras\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":2,\"rowStart\":1},{\"id\":\"w_1781040968502_4\",\"type\":\"kpi_licencias\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":3,\"rowStart\":1},{\"id\":\"w_1781040968502_5\",\"type\":\"chart_area\",\"colStart\":1,\"colSpan\":6,\"rowSpan\":2,\"order\":4,\"rowStart\":2},{\"id\":\"w_1781040968502_6\",\"type\":\"chart_asign\",\"colStart\":7,\"colSpan\":6,\"rowSpan\":2,\"order\":5,\"rowStart\":2},{\"id\":\"w_1781040968502_7\",\"type\":\"kpi_tickets_abiertos\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":6,\"rowStart\":4},{\"id\":\"w_1781040968502_8\",\"type\":\"kpi_tickets_proceso\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":7,\"rowStart\":4},{\"id\":\"w_1781040968502_9\",\"type\":\"kpi_tickets_hoy\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":8,\"rowStart\":4},{\"id\":\"w_1781040968502_10\",\"type\":\"kpi_satisfaccion\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":9,\"rowStart\":4},{\"id\":\"w_1781040968502_11\",\"type\":\"list_auditoria\",\"colStart\":1,\"colSpan\":12,\"rowSpan\":2,\"order\":10,\"rowStart\":5},{\"id\":\"w_1781042496278_skt968\",\"type\":\"chart_sla_prioridad\",\"colStart\":1,\"colSpan\":6,\"rowStart\":7,\"rowSpan\":2,\"order\":12,\"config\":[]},{\"id\":\"w_1781042502295_w5gmh0\",\"type\":\"list_sla_proximos\",\"colStart\":7,\"colSpan\":6,\"rowStart\":7,\"rowSpan\":2,\"order\":13,\"config\":[]},{\"id\":\"w_1781042539740_vhyfzp\",\"type\":\"kpi_sla_vencidos\",\"colStart\":5,\"colSpan\":4,\"rowStart\":9,\"rowSpan\":1,\"order\":14,\"config\":[]},{\"id\":\"w_1781042552037_wirpd2\",\"type\":\"kpi_sla_cumplimiento\",\"colStart\":9,\"colSpan\":4,\"rowStart\":9,\"rowSpan\":1,\"order\":15,\"config\":[]}]}', 0),
(3, 'LEONARDOM', '$2y$10$9IDC.z5w3AN7RGFy.rE9uOcT5fFq7sLPxFhB/kzziUNOJoi9IjOZq', 'Leonardo Manjarres Suarez', 2, 1, NULL, 7, '{\"version\":1,\"savedAt\":\"2026-05-23 11:40:58\",\"widgets\":[{\"id\":\"w_17795543300941\",\"type\":\"kpi_pcs\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":0,\"config\":[]},{\"id\":\"w_17795543300942\",\"type\":\"kpi_portatiles\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":1,\"config\":[]},{\"id\":\"w_17795543300943\",\"type\":\"kpi_impresoras\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":2,\"config\":[]},{\"id\":\"w_17795543300944\",\"type\":\"kpi_licencias\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":3,\"config\":[]},{\"id\":\"w_17795543300945\",\"type\":\"chart_area\",\"colStart\":1,\"colSpan\":6,\"rowSpan\":2,\"order\":4,\"config\":[]},{\"id\":\"w_17795543300946\",\"type\":\"chart_asign\",\"colStart\":7,\"colSpan\":6,\"rowSpan\":2,\"order\":5,\"config\":[]},{\"id\":\"w_17795543300947\",\"type\":\"kpi_tickets_abiertos\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":6,\"config\":[]},{\"id\":\"w_17795543300948\",\"type\":\"kpi_tickets_proceso\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":7,\"config\":[]},{\"id\":\"w_17795543300949\",\"type\":\"kpi_tickets_hoy\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":8,\"config\":[]},{\"id\":\"w_177955433009410\",\"type\":\"kpi_satisfaccion\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":9,\"config\":[]},{\"id\":\"w_177955433009411\",\"type\":\"list_auditoria\",\"colStart\":1,\"colSpan\":12,\"rowSpan\":2,\"order\":10,\"config\":[]}]}', 0),
(4, 'MAURICIOC', '$2y$10$wqW.n555E6ZmPSGdjEbKz.FW0fkGeIG/oHcbb7XTTIGeqvZC01l5K', 'Maurico Alexander Correa Vargas', 2, 1, NULL, 8, '{\"version\":1,\"savedAt\":\"2026-05-26 09:31:18\",\"widgets\":[{\"id\":\"w_17797207044771\",\"type\":\"kpi_pcs\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":0,\"config\":[]},{\"id\":\"w_17797207044772\",\"type\":\"kpi_portatiles\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":1,\"config\":[]},{\"id\":\"w_17797207044773\",\"type\":\"kpi_impresoras\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":2,\"config\":[]},{\"id\":\"w_17797207044774\",\"type\":\"kpi_licencias\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":3,\"config\":[]},{\"id\":\"w_17797207044775\",\"type\":\"chart_area\",\"colStart\":1,\"colSpan\":6,\"rowSpan\":2,\"order\":4,\"config\":[]},{\"id\":\"w_17797207044776\",\"type\":\"chart_asign\",\"colStart\":7,\"colSpan\":6,\"rowSpan\":2,\"order\":5,\"config\":[]},{\"id\":\"w_17797207044777\",\"type\":\"kpi_tickets_abiertos\",\"colStart\":1,\"colSpan\":3,\"rowSpan\":1,\"order\":6,\"config\":[]},{\"id\":\"w_17797207044778\",\"type\":\"kpi_tickets_proceso\",\"colStart\":4,\"colSpan\":3,\"rowSpan\":1,\"order\":7,\"config\":[]},{\"id\":\"w_17797207044779\",\"type\":\"kpi_tickets_hoy\",\"colStart\":7,\"colSpan\":3,\"rowSpan\":1,\"order\":8,\"config\":[]},{\"id\":\"w_177972070447710\",\"type\":\"kpi_satisfaccion\",\"colStart\":10,\"colSpan\":3,\"rowSpan\":1,\"order\":9,\"config\":[]},{\"id\":\"w_177972070447711\",\"type\":\"list_auditoria\",\"colStart\":1,\"colSpan\":12,\"rowSpan\":2,\"order\":10,\"config\":[]}]}', 0),
(5, 'JHOND', '$2y$10$tMnC5QyUh0odrw99urKJVOkOjHrsO0C2Iqmc7RF2Zkp98ghIrDKTm', 'Jhon Doe', 4, 1, '2026-06-16 20:02:45', 180, NULL, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `widget_templates`
--

CREATE TABLE `widget_templates` (
  `id` int(11) NOT NULL,
  `widget_type` varchar(50) NOT NULL,
  `widget_name` varchar(100) NOT NULL,
  `widget_description` text DEFAULT NULL,
  `default_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`default_config`)),
  `data_source` varchar(100) DEFAULT NULL,
  `permissions_required` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions_required`)),
  `icon_class` varchar(100) DEFAULT NULL,
  `category` varchar(50) DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `widget_templates`
--

INSERT INTO `widget_templates` (`id`, `widget_type`, `widget_name`, `widget_description`, `default_config`, `data_source`, `permissions_required`, `icon_class`, `category`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'kpi', 'KPI Básico', 'Tarjeta de indicador clave de rendimiento con valor y tendencia', '{\"title\": \"KPI\", \"value\": 0, \"trend\": \"up\", \"trend_value\": 0, \"color\": \"primary\", \"show_progress\": false, \"progress_value\": 0}', 'dynamic', '[]', 'fas fa-tachometer-alt', 'metrics', 1, 1, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(2, 'bar_chart', 'Gráfico de Barras', 'Gráfico de barras para datos categóricos', '{\"title\": \"Gráfico de Barras\", \"chart_type\": \"bar\", \"height\": 250, \"show_legend\": true, \"colors\": [\"#4a6cf7\", \"#686bf7\", \"#3db9dc\"], \"max_items\": 5}', 'dynamic', '[]', 'fas fa-chart-bar', 'charts', 1, 2, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(3, 'line_chart', 'Gráfico de Líneas', 'Gráfico de líneas para tendencias temporales', '{\"title\": \"Gráfico de Líneas\", \"chart_type\": \"line\", \"height\": 250, \"show_legend\": true, \"smooth\": true, \"fill\": false, \"colors\": [\"#4a6cf7\", \"#686bf7\"]}', 'dynamic', '[]', 'fas fa-chart-line', 'charts', 1, 3, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(4, 'doughnut_chart', 'Gráfico Circular', 'Gráfico de donut para proporciones', '{\"title\": \"Gráfico Circular\", \"chart_type\": \"doughnut\", \"height\": 250, \"show_legend\": true, \"cutout\": \"65%\", \"colors\": [\"#4a6cf7\", \"#686bf7\", \"#3db9dc\", \"#fccb90\", \"#ff9f43\"]}', 'dynamic', '[]', 'fas fa-chart-pie', 'charts', 1, 4, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(5, 'data_table', 'Tabla de Datos', 'Tabla configurable con datos dinámicos', '{\"title\": \"Tabla de Datos\", \"height\": 300, \"pagination\": true, \"page_size\": 10, \"sortable\": true, \"searchable\": false}', 'dynamic', '[]', 'fas fa-table', 'data', 1, 5, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(6, 'activity_feed', 'Feed de Actividad', 'Feed de actividades recientes del sistema', '{\"title\": \"Actividad Reciente\", \"height\": 350, \"max_items\": 10, \"show_timestamp\": true, \"show_user\": true}', 'dynamic', '[\"rep_generar\", \"conf_basica\", \"usr_ver\"]', 'fas fa-history', 'activity', 1, 6, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(7, 'goal_progress', 'Progreso de Metas', 'Barras de progreso para objetivos', '{\"title\": \"Metas\", \"height\": 250, \"show_percentage\": true, \"animated\": true, \"color_scheme\": \"primary\"}', 'dynamic', '[]', 'fas fa-bullseye', 'metrics', 1, 7, '2026-05-09 14:59:57', '2026-05-09 14:59:57'),
(8, 'text_widget', 'Widget de Texto', 'Widget configurable para texto o HTML', '{\"title\": \"Texto\", \"content\": \"Tu texto aquí\", \"height\": 200, \"allow_html\": false, \"text_align\": \"left\"}', 'static', '[]', 'fas fa-font', 'content', 1, 8, '2026-05-09 14:59:57', '2026-05-09 14:59:57');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `acciones`
--
ALTER TABLE `acciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `areas`
--
ALTER TABLE `areas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre_area` (`nombre_area`),
  ADD UNIQUE KEY `codigo_area` (`codigo_area`);

--
-- Indices de la tabla `articulos`
--
ALTER TABLE `articulos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_marca` (`id_marca`);

--
-- Indices de la tabla `asignaciones`
--
ALTER TABLE `asignaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_articulo` (`id_articulo`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_area` (`id_area`),
  ADD KEY `id_equipo` (`id_equipo`);

--
-- Indices de la tabla `bajas`
--
ALTER TABLE `bajas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_responsable_id` (`usuario_responsable_id`);

--
-- Indices de la tabla `configuraciones`
--
ALTER TABLE `configuraciones`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `config_prioridades`
--
ALTER TABLE `config_prioridades`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `config_slas`
--
ALTER TABLE `config_slas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `prioridad` (`prioridad`);

--
-- Indices de la tabla `equipos_de_computo`
--
ALTER TABLE `equipos_de_computo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_area` (`id_area`),
  ADD KEY `id_tipo` (`id_tipo`),
  ADD KEY `id_marca` (`id_marca`),
  ADD KEY `id_configuracion` (`id_configuracion`),
  ADD KEY `fk_equipos_creador` (`creado_por`);

--
-- Indices de la tabla `funcionarios`
--
ALTER TABLE `funcionarios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_area` (`id_area`);

--
-- Indices de la tabla `historial_equipos`
--
ALTER TABLE `historial_equipos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_equipo` (`id_equipo`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `impresoras_escaneres`
--
ALTER TABLE `impresoras_escaneres`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial` (`serial`),
  ADD KEY `id_tipo` (`id_tipo`),
  ADD KEY `id_marca` (`id_marca`),
  ADD KEY `id_equipo` (`id_equipo`);

--
-- Indices de la tabla `licencias`
--
ALTER TABLE `licencias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_area` (`id_area`),
  ADD KEY `id_equipo` (`id_equipo`);

--
-- Indices de la tabla `marcas`
--
ALTER TABLE `marcas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre_marca` (`nombre_marca`);

--
-- Indices de la tabla `modulos`
--
ALTER TABLE `modulos`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `monitores`
--
ALTER TABLE `monitores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial` (`serial`),
  ADD KEY `id_marca` (`id_marca`),
  ADD KEY `id_equipo` (`id_equipo`);

--
-- Indices de la tabla `notificaciones`
--
ALTER TABLE `notificaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_remitente` (`id_remitente`),
  ADD KEY `id_destinatario` (`id_destinatario`),
  ADD KEY `parent_id` (`parent_id`);

--
-- Indices de la tabla `otros`
--
ALTER TABLE `otros`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial` (`serial`),
  ADD KEY `id_tipo` (`id_tipo`),
  ADD KEY `id_marca` (`id_marca`),
  ADD KEY `id_area` (`id_area`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `shared_widget_configs`
--
ALTER TABLE `shared_widget_configs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_widget_id` (`widget_id`),
  ADD KEY `idx_public` (`is_public`),
  ADD KEY `idx_usage` (`usage_count`);

--
-- Indices de la tabla `sla_config`
--
ALTER TABLE `sla_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`),
  ADD KEY `idx_prioridad` (`prioridad_ticket`),
  ADD KEY `idx_activo` (`activo`);

--
-- Indices de la tabla `sla_registros`
--
ALTER TABLE `sla_registros`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ticket` (`ticket_id`),
  ADD KEY `idx_sla_config` (`sla_config_id`),
  ADD KEY `idx_estados` (`estado_respuesta`,`estado_resolucion`);

--
-- Indices de la tabla `telefonos`
--
ALTER TABLE `telefonos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial` (`serial`),
  ADD KEY `id_marca` (`id_marca`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Indices de la tabla `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `tecnico_id` (`tecnico_id`),
  ADD KEY `idx_sla_respuesta` (`sla_respuesta_cumplido`),
  ADD KEY `idx_sla_resolucion` (`sla_resolucion_cumplido`),
  ADD KEY `idx_fecha_venc_resp` (`fecha_vencimiento_respuesta`),
  ADD KEY `idx_fecha_venc_resol` (`fecha_vencimiento_resolucion`);

--
-- Indices de la tabla `tickets_chat`
--
ALTER TABLE `tickets_chat`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indices de la tabla `tickets_trazabilidad`
--
ALTER TABLE `tickets_trazabilidad`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indices de la tabla `ticket_eventos`
--
ALTER TABLE `ticket_eventos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ticket` (`ticket_id`);

--
-- Indices de la tabla `tipos`
--
ALTER TABLE `tipos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tipo` (`tipo`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `id_rol` (`id_rol`),
  ADD KEY `fk_usuarios_funcionarios` (`id_funcionario`);

--
-- Indices de la tabla `widget_templates`
--
ALTER TABLE `widget_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`widget_type`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_sort` (`sort_order`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `acciones`
--
ALTER TABLE `acciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `areas`
--
ALTER TABLE `areas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `articulos`
--
ALTER TABLE `articulos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `asignaciones`
--
ALTER TABLE `asignaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `bajas`
--
ALTER TABLE `bajas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `configuraciones`
--
ALTER TABLE `configuraciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `config_prioridades`
--
ALTER TABLE `config_prioridades`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `config_slas`
--
ALTER TABLE `config_slas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `equipos_de_computo`
--
ALTER TABLE `equipos_de_computo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `funcionarios`
--
ALTER TABLE `funcionarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `historial_equipos`
--
ALTER TABLE `historial_equipos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `impresoras_escaneres`
--
ALTER TABLE `impresoras_escaneres`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `licencias`
--
ALTER TABLE `licencias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `marcas`
--
ALTER TABLE `marcas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `modulos`
--
ALTER TABLE `modulos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `monitores`
--
ALTER TABLE `monitores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `notificaciones`
--
ALTER TABLE `notificaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `otros`
--
ALTER TABLE `otros`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `shared_widget_configs`
--
ALTER TABLE `shared_widget_configs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sla_config`
--
ALTER TABLE `sla_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `sla_registros`
--
ALTER TABLE `sla_registros`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `telefonos`
--
ALTER TABLE `telefonos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tickets_chat`
--
ALTER TABLE `tickets_chat`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tickets_trazabilidad`
--
ALTER TABLE `tickets_trazabilidad`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ticket_eventos`
--
ALTER TABLE `ticket_eventos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tipos`
--
ALTER TABLE `tipos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `widget_templates`
--
ALTER TABLE `widget_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `acciones`
--
ALTER TABLE `acciones`
  ADD CONSTRAINT `acciones_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `articulos`
--
ALTER TABLE `articulos`
  ADD CONSTRAINT `fk_articulos_marca` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `asignaciones`
--
ALTER TABLE `asignaciones`
  ADD CONSTRAINT `fk_asignaciones_area` FOREIGN KEY (`id_area`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_asignaciones_articulo` FOREIGN KEY (`id_articulo`) REFERENCES `articulos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_asignaciones_equipo` FOREIGN KEY (`id_equipo`) REFERENCES `equipos_de_computo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_asignaciones_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `funcionarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `bajas`
--
ALTER TABLE `bajas`
  ADD CONSTRAINT `fk_bajas_usuario` FOREIGN KEY (`usuario_responsable_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `equipos_de_computo`
--
ALTER TABLE `equipos_de_computo`
  ADD CONSTRAINT `equipos_de_computo_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `funcionarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `equipos_de_computo_ibfk_2` FOREIGN KEY (`id_area`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `equipos_de_computo_ibfk_3` FOREIGN KEY (`id_tipo`) REFERENCES `tipos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `equipos_de_computo_ibfk_4` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `equipos_de_computo_ibfk_5` FOREIGN KEY (`id_configuracion`) REFERENCES `configuraciones` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_equipos_creador` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `funcionarios`
--
ALTER TABLE `funcionarios`
  ADD CONSTRAINT `funcionarios_ibfk_1` FOREIGN KEY (`id_area`) REFERENCES `areas` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `historial_equipos`
--
ALTER TABLE `historial_equipos`
  ADD CONSTRAINT `fk_hist_equipo` FOREIGN KEY (`id_equipo`) REFERENCES `equipos_de_computo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_hist_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `impresoras_escaneres`
--
ALTER TABLE `impresoras_escaneres`
  ADD CONSTRAINT `impresoras_escaneres_ibfk_1` FOREIGN KEY (`id_tipo`) REFERENCES `tipos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `impresoras_escaneres_ibfk_2` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `impresoras_escaneres_ibfk_3` FOREIGN KEY (`id_equipo`) REFERENCES `equipos_de_computo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `licencias`
--
ALTER TABLE `licencias`
  ADD CONSTRAINT `licencias_ibfk_1` FOREIGN KEY (`id_area`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `licencias_ibfk_2` FOREIGN KEY (`id_equipo`) REFERENCES `equipos_de_computo` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `monitores`
--
ALTER TABLE `monitores`
  ADD CONSTRAINT `monitores_ibfk_1` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `monitores_ibfk_2` FOREIGN KEY (`id_equipo`) REFERENCES `equipos_de_computo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `notificaciones`
--
ALTER TABLE `notificaciones`
  ADD CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`id_remitente`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notificaciones_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `otros`
--
ALTER TABLE `otros`
  ADD CONSTRAINT `otros_ibfk_1` FOREIGN KEY (`id_tipo`) REFERENCES `tipos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `otros_ibfk_2` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `otros_ibfk_3` FOREIGN KEY (`id_area`) REFERENCES `areas` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `shared_widget_configs`
--
ALTER TABLE `shared_widget_configs`
  ADD CONSTRAINT `shared_widget_configs_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `sla_registros`
--
ALTER TABLE `sla_registros`
  ADD CONSTRAINT `sla_registros_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sla_registros_ibfk_2` FOREIGN KEY (`sla_config_id`) REFERENCES `sla_config` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `telefonos`
--
ALTER TABLE `telefonos`
  ADD CONSTRAINT `telefonos_ibfk_1` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `telefonos_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `funcionarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `fk_ticket_tecnico` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ticket_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `tickets_chat`
--
ALTER TABLE `tickets_chat`
  ADD CONSTRAINT `fk_chat_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `fk_usuarios_funcionarios` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_usuarios_roles` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
