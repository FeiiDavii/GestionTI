# GestionTI — Sistema de Gestión de Inventario TI

> **Versión:** 3.9.0  
> **Stack:** React 19 + TailwindCSS v4 (Frontend) · PHP 8.0 + PDO (Backend API REST)  
> **Base de datos:** MariaDB 10.4 — `inventario_db`  
> **Servidor local:** XAMPP (Apache 2.4 + PHP 8.0.30)

Sistema web integral para la gestión del departamento de TI. Cubre el ciclo de vida completo de activos tecnológicos: registro y asignación de equipos, licencias de software, atención de tickets (Mesa de Servicios con SLA), mantenimientos, reportes y baja de activos. Incluye control de acceso basado en permisos (PBAC), dashboard personalizable con widgets arrastrables, notificaciones en tiempo real vía SSE y modo oscuro.

---

## Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Stack tecnológico](#stack-tecnológico)
4. [Base de datos](#base-de-datos)
5. [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
6. [Sistema de autenticación y permisos (PBAC)](#sistema-de-autenticación-y-permisos-pbac)
7. [API REST — Endpoints](#api-rest--endpoints)
8. [Módulos del frontend](#módulos-del-frontend)
9. [Rutas del frontend](#rutas-del-frontend)
10. [Tiempo real (SSE)](#tiempo-real-sse)
11. [Preferencias de usuario](#preferencias-de-usuario)

---

## Arquitectura

```
Navegador (localhost:5173)
        │
        ▼
  Vite Dev Server
  ┌─────────────────────────────────┐
  │  /api/stream  →  Apache :80     │  (SSE — evita bloqueo del proceso)
  │  /api/*       →  Apache :80     │  (REST API con soporte multipart)
  └─────────────────────────────────┘
        │
        ▼
  Apache 2.4 (XAMPP, puerto 80)
  /GestionTI/backend/index.php
        │
        ├── Middleware Auth.php + Permission.php
        ├── 14 Controllers (PHP puro, PDO)
        └── MariaDB 10.4 — inventario_db
```

Todo el tráfico API pasa por Apache para garantizar el soporte correcto de `multipart/form-data` (subida de archivos) y sesiones PHP consistentes. El proxy de Vite reescribe los headers `Set-Cookie` para normalizar el `path=/` y eliminar restricciones de dominio, permitiendo que la cookie de sesión funcione entre el puerto 5173 y el 80.

---

## Estructura del proyecto

```
GestionTI/
├── SQL_sripts/
│   └── inventario_db_set_up.sql     ← Script completo de creación de BD
├── backend/
│   ├── .htaccess                    ← Routing Apache + CORS + SSE config
│   ├── index.php                    ← Router REST API (~80 rutas)
│   ├── stream.php                   ← SSE endpoint (proceso independiente)
│   ├── config/
│   │   └── db.php                   ← Conexión PDO
│   ├── controllers/                 ← 14 controladores
│   │   ├── AuthController.php
│   │   ├── AuxiliaryController.php
│   │   ├── AssignmentController.php
│   │   ├── BajasController.php
│   │   ├── DashboardController.php
│   │   ├── EquipmentController.php
│   │   ├── LicenseController.php
│   │   ├── MaintenanceController.php
│   │   ├── NotificationController.php
│   │   ├── PermissionController.php
│   │   ├── ReportController.php
│   │   ├── SearchController.php
│   │   ├── StreamController.php
│   │   └── TicketController.php
│   ├── middleware/
│   │   ├── Auth.php                 ← Gestión de sesión y autenticación
│   │   └── Permission.php           ← Verificación PBAC por endpoint
│   ├── includes/
│   │   └── functions.php            ← Sanitización, validación, helpers
│   └── uploads/
│       └── tickets/                 ← Archivos adjuntos de tickets
└── frontend/
    ├── index.html                   ← Script inline de tema (FOUC fix)
    ├── vite.config.js               ← Proxy + cookie rewrite
    ├── package.json
    └── src/
        ├── App.jsx                  ← Rutas protegidas + HomeRedirect
        ├── main.jsx
        ├── index.css                ← Variables CSS + estilos globales
        ├── api/
        │   └── client.js            ← Axios instance + todos los métodos API
        ├── context/
        │   ├── AuthContext.jsx      ← Estado global de auth y PBAC
        │   └── RealtimeContext.jsx  ← SSE subscriptions y notificaciones
        ├── core/
        │   ├── toast.js
        │   ├── usePolling.js
        │   └── useSSE.js
        ├── components/
        │   ├── common/
        │   │   ├── DataTableControls.jsx
        │   │   └── SearchableSelect.jsx
        │   └── layout/
        │       ├── AppLayout.jsx    ← Aplica tema y sidebar al montar
        │       ├── LoginLayout.jsx
        │       ├── Sidebar.jsx      ← Menú dinámico según PBAC
        │       └── TopBar.jsx       ← Búsqueda global + notificaciones
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Tickets.jsx
            ├── GestionTickets.jsx
            ├── Equipos.jsx
            ├── Asignaciones.jsx
            ├── Licencias.jsx
            ├── Bajas.jsx
            ├── Mantenimientos.jsx
            ├── Configuracion.jsx
            ├── Reportes.jsx
            └── Perfil.jsx
```

---

## Stack tecnológico

### Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | ^19.0.0 | UI framework |
| React Router DOM | ^7.0.0 | Enrutamiento SPA |
| TailwindCSS | ^4.0.0 | Framework CSS utility-first |
| Vite | ^6.0.0 | Build tool y dev server |
| Axios | ^1.16.0 | Cliente HTTP |
| Chart.js + react-chartjs-2 | ^4.4 / ^5.2 | Gráficas (Bar, Pie, Doughnut, Line) |
| SweetAlert2 | ^11.0.0 | Modales de confirmación y alertas |
| jsPDF + autotable | ^4.2 / ^5.0 | Exportación a PDF |
| react-icons | ^5.0.0 | Font Awesome 6 como componentes React |
| react-select | ^5.10.2 | Selectores con búsqueda |

### Backend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| PHP | 8.0.30 | Lenguaje del API REST |
| Apache | 2.4.58 | Servidor web (XAMPP) |
| PDO | — | Acceso a base de datos |
| PHP Sessions | — | Autenticación stateful |
| Server-Sent Events | — | Notificaciones en tiempo real |

### Base de datos

| | |
|---|---|
| Motor | MariaDB 10.4.32 |
| Nombre | `inventario_db` |
| Charset | `utf8mb4` / `utf8mb4_unicode_ci` |
| Zona horaria | `America/Bogota` (`-05:00`) |
| Tablas | 30 |

---

## Base de datos

### Diagrama de grupos funcionales

```
┌─── USUARIOS Y ROLES ──────────┐   ┌─── INVENTARIO ─────────────────┐
│ usuarios                      │   │ equipos_de_computo             │
│ roles (18 flags de permiso)   │   │ monitores                      │
│ funcionarios                  │   │ impresoras_escaneres            │
└───────────────────────────────┘   │ telefonos                      │
                                    │ otros                          │
┌─── TICKETS Y SOPORTE ─────────┐   │ articulos (+ columnas VIRTUAL) │
│ tickets                       │   │ asignaciones                   │
│ tickets_chat                  │   │ licencias                      │
│ ticket_eventos                │   │ historial_equipos              │
│ tickets_trazabilidad          │   │ bajas                          │
│ config_prioridades            │   └────────────────────────────────┘
└───────────────────────────────┘
                                    ┌─── SLA ────────────────────────┐
┌─── NOTIFICACIONES Y LOGS ─────┐   │ config_slas                   │
│ notificaciones                │   │ sla_config                    │
│ acciones (audit log)          │   │ sla_registros                 │
└───────────────────────────────┘   └────────────────────────────────┘

┌─── DATOS AUXILIARES ──────────┐   ┌─── DASHBOARD ──────────────────┐
│ areas                         │   │ widget_templates               │
│ marcas                        │   │ shared_widget_configs          │
│ tipos                         │   └────────────────────────────────┘
│ configuraciones               │
│ modulos                       │
└───────────────────────────────┘
```

### Tablas principales

#### `usuarios`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | int PK | Identificador |
| `username` | varchar(100) UNIQUE | Nombre de usuario |
| `password` | varchar(255) | Hash bcrypt |
| `nombre_completo` | varchar(255) | Nombre para mostrar |
| `id_rol` | int FK → roles | Rol asignado |
| `estado` | tinyint(1) | 1=Activo, 0=Inactivo |
| `ultimo_acceso` | timestamp | Fecha del último login |
| `id_funcionario` | int FK → funcionarios | Vinculación al empleado |
| `dashboard_config` | longtext (JSON) | Configuración de widgets personalizada |
| `force_logout` | tinyint(1) | Forzar cierre de sesión en próxima request |

#### `roles`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | int PK | Identificador |
| `nombre_rol` | varchar(50) | Nombre del rol |
| `descripcion` | text | Descripción |
| `inv_ver` … `conf_sla` | tinyint(1) ×18 | Flags de permiso PBAC |

#### `equipos_de_computo`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `serial` | varchar(255) | Serial de fabricante |
| `serial_interno` | varchar(255) | Serial interno del área TI |
| `nivel_clasificacion` | enum | Público / Interno / Confidencial / Restringido |
| `prot_cifrado` | tinyint(1) | Tiene cifrado de disco |
| `prot_antivirus` | tinyint(1) | Tiene antivirus |
| `prot_firewall` | tinyint(1) | Tiene firewall |
| `estado` | enum | Activo / En mantenimiento / De baja |
| `teamviewer_id` | varchar(50) | ID de acceso remoto |

#### `tickets`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `prioridad` | enum | Baja / Media / Alta / Crítica |
| `estado` | enum | Abierto / En Proceso / Resuelto / Cerrado |
| `categoria` | enum | Software / Software Core / Hardware / Usuarios / Otros |
| `calificacion` | int(1) | Estrellas 1–5 post-resolución |
| `sla_respuesta_cumplido` | tinyint(1) | 1=cumplido, 0=incumplido, NULL=pendiente |
| `sla_resolucion_cumplido` | tinyint(1) | 1=cumplido, 0=incumplido, NULL=pendiente |
| `archivo_adjunto` | varchar(255) | Nombre de archivo en uploads/tickets/ |

#### `sla_config`
Configuración activa de SLA (tiempos en minutos):

| Prioridad | Respuesta | Resolución |
|-----------|-----------|------------|
| Crítica | 15 min | 60 min |
| Alta | 30 min | 240 min |
| Media | 60 min | 480 min |
| Baja | 120 min | 1440 min |

#### `config_prioridades`
36 palabras clave para asignación automática de prioridad al crear un ticket:

| Prioridad | Ejemplos |
|-----------|---------|
| Crítica | servidor, caído, hackeado, virus, pantalla azul, no arranca |
| Alta | internet, wifi, correo, impresora, error, sin acceso |
| Media | lento, mouse, teclado, monitor, parpadea |
| Baja | consulta, instalar, clave, toner, solicitud |

### Relaciones clave (Foreign Keys)

```
usuarios.id_rol           → roles.id
usuarios.id_funcionario   → funcionarios.id
equipos_de_computo.id_usuario → funcionarios.id
equipos_de_computo.id_area    → areas.id
tickets.usuario_id        → usuarios.id  (ON DELETE CASCADE)
tickets.tecnico_id        → usuarios.id  (ON DELETE SET NULL)
tickets_chat.ticket_id    → tickets.id   (ON DELETE CASCADE)
sla_registros.ticket_id   → tickets.id   (ON DELETE CASCADE)
notificaciones.id_destinatario → usuarios.id (ON DELETE CASCADE)
historial_equipos.id_equipo    → equipos_de_computo.id (ON DELETE SET NULL)
```

---

## Instalación y puesta en marcha

### Requisitos

- XAMPP con Apache 2.4 y PHP 8.0+ activos
- MariaDB / MySQL
- Node.js 18+

### 1. Base de datos

```sql
-- En phpMyAdmin o consola MySQL:
SOURCE /xampp/htdocs/GestionTI/SQL_sripts/inventario_db_set_up.sql;
```

El script crea la base `inventario_db`, todas las tablas, índices, claves foráneas y los datos iniciales (configuraciones de hardware, SLA por defecto, palabras clave de prioridad y usuario administrador de ejemplo).

### 2. Backend

No requiere instalación adicional. Apache sirve el backend desde:

```
http://localhost/GestionTI/backend/
```

Verifica que `backend/config/db.php` tenga las credenciales correctas (por defecto `root` sin contraseña para XAMPP local).

### 3. Frontend — desarrollo

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`. El proxy de Vite enruta automáticamente `/api/*` a Apache.

### 4. Frontend — producción

```bash
cd frontend
npm run build
```

El `dist/` generado puede servirse directamente desde Apache copiando su contenido a `htdocs/GestionTI/` y configurando el `mod_rewrite` para SPA.

### Credenciales de ejemplo

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `FREIDERD` | (ver BD) | Administrador |
| `ADMIN` | (ver BD) | Avanzado |
| `JHOND` | (ver BD) | Funcionario |

---

## Sistema de autenticación y permisos (PBAC)

El sistema usa **Permission-Based Access Control** con 18 flags booleanos almacenados directamente en la tabla `roles`. No hay tabla intermedia de permisos — cada columna es un flag `tinyint(1)`.

### Los 18 permisos

| Código | Descripción |
|--------|-------------|
| `inv_ver` | Ver inventario general |
| `inv_crear_editar` | Crear y editar equipos |
| `inv_eliminar` | Eliminar registros de inventario |
| `inv_asignaciones` | Gestionar insumos y repuestos |
| `inv_licencias` | Gestionar licencias de software |
| `inv_bajas` | Registrar bajas de activos |
| `tk_ver_global` | Ver todos los tickets del sistema |
| `tk_responder` | Responder tickets como técnico |
| `tk_asignar_otros` | Reasignar tickets a otros técnicos |
| `tk_mantenimientos` | Hojas de vida técnicas |
| `tk_crear` | Crear tickets de soporte |
| `usr_ver` | Ver listado de usuarios |
| `usr_gestionar` | Crear, editar y desactivar usuarios |
| `rep_generar` | Generar reportes y exportaciones |
| `conf_basica` | Configuración general del sistema |
| `conf_roles` | Gestionar roles y permisos |
| `conf_avanzada` | Operaciones avanzadas (backup, logs) |
| `conf_sla` | Configurar SLAs y palabras clave |

### Flujo de autenticación

1. `POST /api/auth/login` → valida credenciales, actualiza `ultimo_acceso`, guarda `$_SESSION`
2. `$_SESSION` almacena: `user_id`, `username`, `nombre`, `role`, `permisos` (array completo)
3. En cada request protegida: `Auth::requireLogin()` verifica `$_SESSION['user_id']`
4. `Permission::require('permiso')` o `Permission::requireAny([...])` verifica el flag específico
5. `Auth::checkForceLogout($pdo)` detecta si el admin cambió los permisos y fuerza re-login
6. Redirección post-login: `esAdministrativo()` → `/dashboard`; solo `tk_crear` → `/tickets`

### `esAdministrativo()` (AuthContext)

Retorna `true` si el usuario tiene cualquiera de: `inv_ver`, `tk_ver_global`, `tk_responder`, `usr_ver`, `rep_generar`, `conf_basica`. Determina qué layout y rutas se muestran.

---

## API REST — Endpoints

Base URL en desarrollo: `http://localhost:5173/api` (proxiado a Apache).

Formato de respuesta estándar:
```json
{ "success": true, "message": "Operación exitosa", "data": { ... } }
{ "success": false, "message": "Descripción del error" }
```

### Autenticación

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/auth/login` | — | Iniciar sesión |
| POST | `/auth/logout` | — | Cerrar sesión |
| GET | `/auth/me` | login | Usuario actual + permisos |
| GET | `/auth/permisos` | login | Array de permisos |
| POST | `/auth/recovery` | — | Solicitar recuperación de contraseña |
| POST | `/auth/change-password` | login | Cambiar contraseña |
| GET | `/auth/profile-stats` | login | Estadísticas del perfil |

### Dashboard

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/dashboard/data` | login | KPIs y datos de gráficas |
| GET/POST | `/dashboard/config` | login | Leer/guardar layout de widgets |
| GET | `/dashboard/sla-stats` | login | Estadísticas de cumplimiento SLA |

### Tickets

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/tickets/my` | login | Tickets del usuario actual |
| GET | `/tickets/all` | `tk_ver_global` | Todos los tickets |
| GET | `/tickets/detail?id=` | login | Detalle + chat + timeline |
| POST | `/tickets/create` | `tk_crear` | Crear ticket (multipart/form-data) |
| POST | `/tickets/reply` | login | Responder en chat |
| POST | `/tickets/update` | `tk_responder` | Cambiar estado/categoría/técnico |
| POST | `/tickets/escalate` | `tk_responder` | Escalar a otro técnico |
| POST | `/tickets/rate` | login | Calificar y cerrar ticket |
| POST | `/tickets/reopen` | login | Reabrir ticket cerrado |
| GET | `/tickets/timeline?id=` | login | Timeline de eventos |
| GET | `/tickets/chat-users` | `tk_ver_global` | Usuarios del chat |

### Inventario

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/equipments` | `inv_ver` | Listado de equipos |
| GET | `/equipments/{id}` | `inv_ver` | Detalle de equipo |
| GET | `/equipments/listas` | `inv_ver` | Listas auxiliares (marcas, tipos…) |
| GET | `/equipments/totales` | `inv_ver` | KPIs del inventario |
| POST | `/equipments/create` | `inv_crear_editar` | Crear equipo |
| POST | `/equipments/update` | `inv_crear_editar` | Actualizar equipo |
| POST | `/equipments/delete` | `inv_eliminar` | Dar de baja equipo |

### Mantenimientos

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/maintenance/list` | `tk_mantenimientos` | Lista de equipos |
| GET | `/maintenance/detail?id=` | `tk_mantenimientos` | Ficha técnica completa |
| POST | `/maintenance/save` | `tk_mantenimientos` | Registrar mantenimiento |
| POST | `/maintenance/update` | `tk_mantenimientos` | Actualizar datos del equipo |

### Licencias

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/licenses` | `inv_licencias` | Listado |
| GET | `/licenses/listas` | `inv_licencias` | Listas auxiliares |
| POST | `/licenses/create` | `inv_licencias` | Crear licencia |
| POST | `/licenses/update` | `inv_licencias` | Actualizar licencia |
| POST | `/licenses/delete` | `inv_licencias` | Eliminar licencia |

### Asignaciones

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/assignments` | `inv_asignaciones` | Catálogo de artículos |
| GET | `/assignments/asignaciones` | `inv_asignaciones` | Asignaciones activas |
| POST | `/assignments/save` | `inv_asignaciones` | Guardar artículo |
| POST | `/assignments/asignar` | `inv_asignaciones` | Crear asignación |
| POST | `/assignments/edit-asignacion` | `inv_asignaciones` | Editar asignación |
| POST | `/assignments/delete-asignacion` | `inv_asignaciones` | Eliminar asignación |

### Bajas

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/bajas/search?q=` | `inv_bajas` | Buscar activo para dar de baja |
| POST | `/bajas/save` | `inv_bajas` | Registrar baja |
| GET | `/bajas/list` | `inv_bajas` | Historial de bajas |
| GET | `/bajas/consolidated` | `inv_bajas` | Consolidado por categoría |

### Reportes

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/reports/generate` | `rep_generar` | Generar reporte (preview / csv / pdf_all) |
| GET | `/reports/listas` | `rep_generar` | Listas de filtros |

### Notificaciones

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/notifications` | login | Lista de notificaciones |
| POST | `/notifications/send` | login | Enviar notificación |
| POST | `/notifications/mark-read` | login | Marcar como leída |
| POST | `/notifications/mark-read-by-related` | login | Marcar relacionadas como leídas |

### Búsqueda global

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/search/global?q=` | login | Búsqueda en todas las entidades |

### Auxiliares y usuarios

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/aux/areas` | login | Áreas |
| GET | `/aux/marcas` | login | Marcas |
| GET | `/aux/tipos` | login | Tipos de activo |
| GET | `/aux/configuraciones` | login | Configuraciones de hardware |
| GET | `/aux/funcionarios` | login | Funcionarios |
| POST | `/aux/save` | login | Crear registro auxiliar o backup BD |
| GET | `/aux/users` | `usr_ver` | Lista de usuarios |
| POST | `/aux/users/save` | `usr_gestionar` | Crear/editar usuario |
| POST | `/aux/users/toggle-status` | `usr_gestionar` | Activar/desactivar usuario |
| POST | `/aux/users/force-logout` | `usr_gestionar` | Forzar cierre de sesión |

### Permisos y configuración

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/permissions/roles` | `conf_basica` | Lista de roles con permisos |
| POST | `/permissions/roles/save` | `conf_roles` | Crear/editar rol |
| POST | `/permissions/delete-role` | `conf_roles` | Eliminar rol |
| GET | `/permissions/config-sla` | `conf_sla` | Configuración SLA actual |
| POST | `/permissions/save-sla` | `conf_sla` | Actualizar SLA |
| POST | `/permissions/delete-sla` | `conf_sla` | Eliminar SLA |
| GET | `/permissions/keywords` | `conf_sla` | Palabras clave de prioridad |
| POST | `/permissions/save-keyword` | `conf_sla` | Agregar palabra clave |
| POST | `/permissions/delete-keyword` | `conf_sla` | Eliminar palabra clave |
| GET | `/permissions/logs` | `conf_basica` | Log de auditoría |
| POST | `/permissions/clear-logs` | `conf_avanzada` | Limpiar logs > 30 días |
| POST | `/permissions/import-backup` | `conf_avanzada` | Restaurar backup SQL |

### SSE

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/stream` | Stream de eventos en tiempo real |

---

## Módulos del frontend

### Dashboard (`/dashboard`)
Dashboard completamente personalizable con sistema de widgets arrastrables. Catálogo de 22 tipos de widgets: KPIs numéricos (PCs, portátiles, impresoras, licencias, tickets, SLA), gráficas Chart.js (Bar, Pie, Doughnut), listas de auditoría y SLA próximos a vencer. La configuración se persiste en `usuarios.dashboard_config` (JSON). Solo accesible para usuarios administrativos; los funcionarios son redirigidos directamente a `/tickets`.

### Mesa de Servicios (`/tickets`)
Vista de usuario final para gestión de sus propios tickets. Creación con descripción, archivo adjunto y prioridad automática por palabras clave. Chat en tiempo real con el soporte técnico. Wizard de calificación post-resolución (1–5 estrellas). Detección anti-spam de tickets duplicados abiertos.

### Gestión de Tickets (`/gestion-tickets`)
Vista de soporte técnico. Tabla completa con filtros por estado y prioridad. Panel de detalle en tres secciones: información del ticket, chat con burbujas diferenciadas por rol, y timeline de eventos. Acciones: cambiar estado, asignar técnico, escalar con motivo, responder.

### Inventario (`/equipos`)
CRUD completo de 5 tipos de activos: computadores, impresoras/escáneres, monitores, teléfonos IP y otros. Campos de seguridad por equipo (cifrado, antivirus, firewall, nivel de clasificación). Selectores con "Quick Add" inline para marcas, tipos, áreas, configuraciones y funcionarios. KPIs de totales en la cabecera.

### Asignaciones (`/asignaciones`)
Control de stock de insumos y repuestos con columnas virtuales (`cantidad_total`). Registro de asignaciones a funcionarios, áreas o equipos. La devolución restaura el stock automáticamente.

### Licencias (`/licencias`)
CRUD de licencias de software con serial key (toggle de visibilidad), edición, asignación a equipos y áreas.

### Bajas (`/bajas`)
Tres flujos de baja: activo en inventario (búsqueda por serial + soft-delete), activo no inventariado (formulario manual) e insumo genérico (con cantidad apilable). Al dar de baja un equipo se desvinculan periféricos, licencias y asignaciones.

### Hojas de Vida (`/mantenimientos`)
Ficha técnica completa de cada equipo con historial de mantenimientos. Tipos de mantenimiento: preventivo, correctivo (con razón obligatoria) y repotenciación (actualización de hardware). Registro de cambios de datos con justificación.

### Reportes (`/reportes`)
Seis tipos de reporte: Inventario, Repuestos, Licencias, Tickets, Bajas y Logs. Filtros dinámicos por tipo. Vista previa paginada. Exportación a CSV (con BOM UTF-8) y PDF.

### Configuración (`/configuracion`)
Seis tabs protegidos por permiso:
- **Apariencia** — modo oscuro y sidebar compacto (persiste en localStorage)
- **Sistema** — info del sistema, backup/restauración de BD, log de auditoría
- **Usuarios** — tabla paginada con búsqueda, CRUD de usuarios, toggle activo/inactivo, force logout
- **Roles y Permisos** — matriz completa de 18 permisos por rol, crear/editar/eliminar roles
- **SLAs** — tiempos de respuesta y resolución en horas por prioridad
- **Prioridades** — CRUD de palabras clave para prioridad automática de tickets

### Perfil (`/perfil`)
Estadísticas del usuario actual (tickets creados, resueltos, equipos asignados, mantenimientos registrados). Cambio de contraseña con validación de fortaleza en tiempo real (mayúscula, minúscula, número, carácter especial, mínimo 8 caracteres).

---

## Rutas del frontend

| Ruta | Componente | Permiso requerido |
|------|-----------|-------------------|
| `/login` | Login | Público |
| `/` | HomeRedirect | Redirige según rol |
| `/dashboard` | Dashboard | Cualquier usuario autenticado |
| `/tickets` | Tickets | Cualquier usuario autenticado |
| `/gestion-tickets` | GestionTickets | `tk_ver_global` |
| `/equipos` | Equipos | `inv_ver` |
| `/asignaciones` | Asignaciones | `inv_asignaciones` |
| `/licencias` | Licencias | `inv_licencias` |
| `/bajas` | Bajas | `inv_bajas` |
| `/mantenimientos` | Mantenimientos | `tk_mantenimientos` |
| `/configuracion` | Configuracion | Cualquier usuario autenticado |
| `/reportes` | Reportes | `rep_generar` |
| `/perfil` | Perfil | Cualquier usuario autenticado |

**Lógica de redirección:**
- `/` y `/login` (cuando hay sesión activa) → `esAdministrativo()` ? `/dashboard` : `/tickets`
- `/dashboard` sin `esAdministrativo()` → redirige directamente a `/tickets`
- Ruta protegida sin permiso → redirige a `/dashboard`

---

## Tiempo real (SSE)

El endpoint `GET /api/stream` (`backend/stream.php`) mantiene una conexión persistente SSE con el cliente. Emite eventos en las siguientes categorías:

| Evento | Descripción |
|--------|-------------|
| `new_notification` | Nueva notificación personal o global |
| `tickets_update` | Cambio en el estado de tickets |
| `chat_update` | Nuevo mensaje en chat de ticket |
| `system_update` | Cambio en inventario u otras entidades |
| `force_logout` | El administrador revocó la sesión del usuario |

El cliente React los maneja en `RealtimeContext.jsx` vía `useSSE.js`. El stream SSE corre bajo Apache (no el PHP built-in) para evitar bloqueos de proceso.

---

## Preferencias de usuario

Las preferencias visuales se guardan en `localStorage` del navegador:

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `darkMode` | `'true'` / `'false'` | Modo oscuro |
| `sidebarCompact` | `'true'` / `'false'` | Sidebar compacto (80px) |

**Aplicación sin flash (FOUC):** `index.html` contiene un script inline en el `<head>` que lee `localStorage` y aplica `data-theme="dark"` al `<html>` antes de que el bundle de React cargue. `AppLayout.jsx` aplica ambas preferencias al montar y limpia la clase temporal.

El tema oscuro usa variables CSS en `:root` y `[data-theme="dark"]`:

```css
:root {
  --primary-color: #4a6cf7;
  --bg-color: #f0f2f5;
  --card-bg: #ffffff;
  --text-color: #333;
  /* ... */
}

[data-theme="dark"] {
  --primary-color: #6aa5e3;
  --bg-color: #121212;
  --card-bg: #1e1e1e;
  --text-color: #e0e0e0;
  /* ... */
}
```
