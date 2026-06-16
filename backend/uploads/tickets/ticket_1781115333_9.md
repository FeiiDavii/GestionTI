<div align="center">

# 🖥️ GestionTI
### Sistema Integral de Gestión de Inventario TI

[![Versión](https://img.shields.io/badge/versión-3.9.0-4a6cf7?style=for-the-badge)](.)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)](.)
[![PHP](https://img.shields.io/badge/PHP-8.0-777BB4?style=for-the-badge&logo=php)](.)
[![MariaDB](https://img.shields.io/badge/MariaDB-10.4-003545?style=for-the-badge&logo=mariadb)](.)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](.)

*Plataforma web para la gestión completa del ciclo de vida de activos tecnológicos, soporte técnico con SLA y control de acceso granular por permisos.*

---

</div>

## 📋 Tabla de Contenidos

1. [Descripción general](#-descripción-general)
2. [Arquitectura del sistema](#-arquitectura-del-sistema)
3. [Stack tecnológico](#-stack-tecnológico)
4. [Estructura del proyecto](#-estructura-del-proyecto)
5. [Base de datos](#-base-de-datos)
6. [Instalación y puesta en marcha](#-instalación-y-puesta-en-marcha)
7. [Autenticación y permisos (PBAC)](#-autenticación-y-permisos-pbac)
8. [API REST — Referencia de endpoints](#-api-rest--referencia-de-endpoints)
9. [Módulos del frontend](#-módulos-del-frontend)
10. [Rutas protegidas](#-rutas-protegidas)
11. [Tiempo real con SSE](#-tiempo-real-con-sse)
12. [Preferencias de usuario y temas](#-preferencias-de-usuario-y-temas)

---

## 🧭 Descripción general

**GestionTI** es un sistema web corporativo diseñado para centralizar y automatizar las operaciones del departamento de Tecnología de la Información. Cubre el ciclo de vida completo de los activos tecnológicos de una organización, desde su ingreso al inventario hasta su baja definitiva.

### ¿Qué resuelve?

| Área | Funcionalidad |
|---|---|
| 📦 **Inventario** | Registro, clasificación y seguimiento de equipos de cómputo, monitores, impresoras, teléfonos IP y otros activos |
| 🎫 **Mesa de Servicios** | Gestión de tickets de soporte con SLA, chat en tiempo real y escalamiento técnico |
| 🔒 **Control de acceso** | Sistema PBAC con 18 permisos individuales por rol |
| 📊 **Dashboard** | Widgets arrastrables y personalizables con KPIs e indicadores en tiempo real |
| 📄 **Reportes** | Exportación a PDF y CSV de inventario, tickets, bajas, licencias y logs |
| ⚙️ **Configuración** | Gestión de usuarios, roles, SLAs, palabras clave de prioridad y backup de BD |

---

## 🏗️ Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENTE (Navegador)                        │
│                    http://localhost:5173                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vite Dev Server                              │
│                                                                 │
│   /api/stream  ──► Apache :80   (SSE — proceso independiente)  │
│   /api/*       ──► Apache :80   (REST — soporte multipart)     │
│                                                                 │
│   El proxy reescribe Set-Cookie para normalizar path=/ y       │
│   eliminar restricciones de dominio entre :5173 y :80          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Apache 2.4 (XAMPP — puerto 80)                    │
│         /GestionTI/backend/index.php  (Router ~80 rutas)       │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Middleware                                             │  │
│   │    Auth.php ──── gestión de sesión PHP                  │  │
│   │    Permission.php ── verificación PBAC por endpoint     │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  14 Controladores PHP (PDO)                            │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              MariaDB 10.4 — inventario_db                      │
│                      30 tablas                                  │
└─────────────────────────────────────────────────────────────────┘
```

> **Nota de diseño:** Todo el tráfico API pasa por Apache (no por el servidor integrado de PHP) para garantizar soporte correcto de `multipart/form-data` en subida de archivos y sesiones PHP consistentes entre el frontend y el backend.

---

## 🛠️ Stack tecnológico

### Frontend

| Tecnología | Versión | Rol en el proyecto |
|---|---|---|
| **React** | ^19.0.0 | Framework de UI — SPA |
| **React Router DOM** | ^7.0.0 | Enrutamiento cliente con rutas protegidas |
| **TailwindCSS** | ^4.0.0 | Estilos utility-first + modo oscuro |
| **Vite** | ^6.0.0 | Build tool y dev server con proxy |
| **Axios** | ^1.16.0 | Cliente HTTP — instancia centralizada |
| **Chart.js + react-chartjs-2** | ^4.4 / ^5.2 | Gráficas: Bar, Pie, Doughnut, Line |
| **SweetAlert2** | ^11.0.0 | Modales de confirmación y alertas |
| **jsPDF + autotable** | ^4.2 / ^5.0 | Exportación de reportes a PDF |
| **react-icons** | ^5.0.0 | Iconografía (Font Awesome 6) |
| **react-select** | ^5.10.2 | Selectores avanzados con búsqueda |

### Backend

| Tecnología | Versión | Rol en el proyecto |
|---|---|---|
| **PHP** | 8.0.30 | Lenguaje del API REST |
| **Apache** | 2.4.58 | Servidor web (vía XAMPP) |
| **PDO** | — | Capa de acceso a base de datos |
| **PHP Sessions** | — | Autenticación stateful |
| **Server-Sent Events** | — | Notificaciones en tiempo real |

### Base de datos

| Parámetro | Valor |
|---|---|
| Motor | MariaDB 10.4.32 |
| Nombre de BD | `inventario_db` |
| Charset | `utf8mb4` / `utf8mb4_unicode_ci` |
| Zona horaria | `America/Bogota` (`UTC-5`) |
| Número de tablas | 30 |

---

## 📁 Estructura del proyecto

```
GestionTI/
│
├── SQL_sripts/
│   └── inventario_db_set_up.sql        ← Script completo de creación de BD
│                                          (tablas, índices, FKs, datos iniciales)
│
├── backend/
│   ├── .htaccess                        ← Routing Apache, CORS y config SSE
│   ├── index.php                        ← Router principal (~80 rutas REST)
│   ├── stream.php                       ← Endpoint SSE (proceso independiente)
│   │
│   ├── config/
│   │   └── db.php                       ← Conexión PDO a MariaDB
│   │
│   ├── controllers/                     ← 14 controladores de dominio
│   │   ├── AuthController.php           ← Login, logout, perfil, contraseña
│   │   ├── AuxiliaryController.php      ← Datos auxiliares, usuarios, backup
│   │   ├── AssignmentController.php     ← Insumos y asignaciones de repuestos
│   │   ├── BajasController.php          ← Baja de activos y registros
│   │   ├── DashboardController.php      ← KPIs, widgets y estadísticas SLA
│   │   ├── EquipmentController.php      ← CRUD inventario de equipos
│   │   ├── LicenseController.php        ← CRUD licencias de software
│   │   ├── MaintenanceController.php    ← Fichas técnicas y mantenimientos
│   │   ├── NotificationController.php   ← Gestión de notificaciones
│   │   ├── PermissionController.php     ← Roles, SLAs, palabras clave, logs
│   │   ├── ReportController.php         ← Generación de reportes y filtros
│   │   ├── SearchController.php         ← Búsqueda global multi-entidad
│   │   ├── StreamController.php         ← Lógica de eventos SSE
│   │   └── TicketController.php         ← Ciclo completo de tickets
│   │
│   ├── middleware/
│   │   ├── Auth.php                     ← Sesión PHP, checkForceLogout
│   │   └── Permission.php              ← Verificación PBAC por endpoint
│   │
│   ├── includes/
│   │   └── functions.php               ← Sanitización, validación, helpers
│   │
│   └── uploads/
│       └── tickets/                    ← Archivos adjuntos de tickets
│
└── frontend/
    ├── index.html                       ← Script inline anti-FOUC (tema oscuro)
    ├── vite.config.js                   ← Proxy /api/* + rewrite de cookies
    ├── package.json
    │
    └── src/
        ├── App.jsx                      ← Rutas protegidas + HomeRedirect
        ├── main.jsx                     ← Punto de entrada React
        ├── index.css                    ← Variables CSS globales (light/dark)
        │
        ├── api/
        │   └── client.js               ← Instancia Axios + todos los métodos API
        │
        ├── context/
        │   ├── AuthContext.jsx         ← Estado global de sesión y permisos PBAC
        │   └── RealtimeContext.jsx     ← Suscripciones SSE y estado notificaciones
        │
        ├── core/
        │   ├── toast.js                ← Sistema de notificaciones toast
        │   ├── usePolling.js           ← Hook para polling periódico
        │   └── useSSE.js              ← Hook para conexión SSE
        │
        ├── components/
        │   ├── common/
        │   │   ├── DataTableControls.jsx   ← Controles de tabla reutilizables
        │   │   └── SearchableSelect.jsx    ← Select con búsqueda y Quick Add
        │   └── layout/
        │       ├── AppLayout.jsx       ← Layout principal, aplica tema y sidebar
        │       ├── LoginLayout.jsx     ← Layout para pantalla de acceso
        │       ├── Sidebar.jsx         ← Menú dinámico filtrado por PBAC
        │       └── TopBar.jsx          ← Búsqueda global + campana notificaciones
        │
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

## 🗄️ Base de datos

### Grupos funcionales

```
┌─── USUARIOS Y ROLES ──────────┐   ┌─── INVENTARIO ─────────────────────┐
│ usuarios                      │   │ equipos_de_computo                 │
│ roles (18 flags de permiso)   │   │ monitores                          │
│ funcionarios                  │   │ impresoras_escaneres                │
└───────────────────────────────┘   │ telefonos                          │
                                    │ otros                              │
┌─── TICKETS Y SOPORTE ─────────┐   │ articulos (+ columnas VIRTUAL)     │
│ tickets                       │   │ asignaciones                       │
│ tickets_chat                  │   │ licencias                          │
│ ticket_eventos                │   │ historial_equipos                  │
│ tickets_trazabilidad          │   │ bajas                              │
│ config_prioridades            │   └────────────────────────────────────┘
└───────────────────────────────┘
                                    ┌─── SLA ─────────────────────────────┐
┌─── NOTIFICACIONES Y LOGS ─────┐   │ config_slas                        │
│ notificaciones                │   │ sla_config                         │
│ acciones (audit log)          │   │ sla_registros                      │
└───────────────────────────────┘   └────────────────────────────────────┘

┌─── DATOS AUXILIARES ──────────┐   ┌─── DASHBOARD ───────────────────────┐
│ areas                         │   │ widget_templates                   │
│ marcas                        │   │ shared_widget_configs              │
│ tipos                         │   └────────────────────────────────────┘
│ configuraciones               │
│ modulos                       │
└───────────────────────────────┘
```

### Tablas principales

#### `usuarios`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `int` PK | Identificador único |
| `username` | `varchar(100)` UNIQUE | Nombre de usuario para login |
| `password` | `varchar(255)` | Hash bcrypt |
| `nombre_completo` | `varchar(255)` | Nombre visible en la interfaz |
| `id_rol` | `int` FK → `roles` | Rol asignado al usuario |
| `estado` | `tinyint(1)` | `1` = Activo · `0` = Inactivo |
| `ultimo_acceso` | `timestamp` | Fecha y hora del último login exitoso |
| `id_funcionario` | `int` FK → `funcionarios` | Vinculación al empleado de nómina |
| `dashboard_config` | `longtext` (JSON) | Layout de widgets personalizado |
| `force_logout` | `tinyint(1)` | Flag para forzar cierre de sesión remoto |

#### `roles`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `int` PK | Identificador |
| `nombre_rol` | `varchar(50)` | Nombre del rol |
| `descripcion` | `text` | Descripción del rol |
| `inv_ver` … `conf_sla` | `tinyint(1)` ×18 | Flags de permiso PBAC (ver sección permisos) |

#### `equipos_de_computo`

| Columna | Tipo | Descripción |
|---|---|---|
| `serial` | `varchar(255)` | Serial del fabricante |
| `serial_interno` | `varchar(255)` | Serial asignado internamente por TI |
| `nivel_clasificacion` | `enum` | `Público` / `Interno` / `Confidencial` / `Restringido` |
| `prot_cifrado` | `tinyint(1)` | Tiene cifrado de disco habilitado |
| `prot_antivirus` | `tinyint(1)` | Tiene antivirus activo |
| `prot_firewall` | `tinyint(1)` | Tiene firewall habilitado |
| `estado` | `enum` | `Activo` / `En mantenimiento` / `De baja` |
| `teamviewer_id` | `varchar(50)` | ID de acceso remoto |

#### `tickets`

| Columna | Tipo | Descripción |
|---|---|---|
| `prioridad` | `enum` | `Baja` / `Media` / `Alta` / `Crítica` |
| `estado` | `enum` | `Abierto` / `En Proceso` / `Resuelto` / `Cerrado` |
| `categoria` | `enum` | `Software` / `Software Core` / `Hardware` / `Usuarios` / `Otros` |
| `calificacion` | `int(1)` | Estrellas 1–5 asignadas al cerrar |
| `sla_respuesta_cumplido` | `tinyint(1)` | `1`=cumplido · `0`=incumplido · `NULL`=pendiente |
| `sla_resolucion_cumplido` | `tinyint(1)` | `1`=cumplido · `0`=incumplido · `NULL`=pendiente |
| `archivo_adjunto` | `varchar(255)` | Nombre del archivo en `uploads/tickets/` |

#### `sla_config` — Configuración por defecto

| Prioridad | Tiempo de respuesta | Tiempo de resolución |
|---|---|---|
| 🔴 Crítica | 15 min | 60 min |
| 🟠 Alta | 30 min | 240 min (4 h) |
| 🟡 Media | 60 min | 480 min (8 h) |
| 🟢 Baja | 120 min | 1440 min (24 h) |

#### `config_prioridades` — Palabras clave de asignación automática

El sistema analiza el título y descripción del ticket al crearlo y asigna prioridad automáticamente según estas palabras clave (36 en total, configurables desde la interfaz):

| Prioridad | Ejemplos de palabras clave |
|---|---|
| 🔴 Crítica | `servidor`, `caído`, `hackeado`, `virus`, `pantalla azul`, `no arranca` |
| 🟠 Alta | `internet`, `wifi`, `correo`, `impresora`, `error`, `sin acceso` |
| 🟡 Media | `lento`, `mouse`, `teclado`, `monitor`, `parpadea` |
| 🟢 Baja | `consulta`, `instalar`, `clave`, `toner`, `solicitud` |

### Relaciones clave (Foreign Keys)

```
usuarios.id_rol               → roles.id
usuarios.id_funcionario       → funcionarios.id
equipos_de_computo.id_usuario → funcionarios.id
equipos_de_computo.id_area    → areas.id
tickets.usuario_id            → usuarios.id         (ON DELETE CASCADE)
tickets.tecnico_id            → usuarios.id         (ON DELETE SET NULL)
tickets_chat.ticket_id        → tickets.id          (ON DELETE CASCADE)
sla_registros.ticket_id       → tickets.id          (ON DELETE CASCADE)
notificaciones.id_destinatario → usuarios.id        (ON DELETE CASCADE)
historial_equipos.id_equipo   → equipos_de_computo.id (ON DELETE SET NULL)
```

---

## 🚀 Instalación y puesta en marcha

### Requisitos previos

| Componente | Versión mínima |
|---|---|
| XAMPP (Apache + PHP) | Apache 2.4 · PHP 8.0+ |
| MariaDB / MySQL | 10.4+ |
| Node.js | 18+ |
| npm | 9+ |

### Paso 1 — Clonar el repositorio

Coloca la carpeta del proyecto dentro del directorio `htdocs` de XAMPP:

```
C:\xampp\htdocs\GestionTI\
```

### Paso 2 — Base de datos

Abre **phpMyAdmin** o una consola MySQL y ejecuta el script de configuración completo:

```sql
SOURCE /xampp/htdocs/GestionTI/SQL_sripts/inventario_db_set_up.sql;
```

Este script realiza automáticamente:
- Creación de la base de datos `inventario_db`
- Creación de las 30 tablas con sus índices y claves foráneas
- Inserción de datos iniciales: configuraciones de hardware, SLA por defecto, palabras clave de prioridad
- Creación del usuario administrador inicial

### Paso 3 — Verificar credenciales de BD

Abre `backend/config/db.php` y confirma los datos de conexión. Para una instalación estándar de XAMPP local no es necesario ningún cambio:

```php
// backend/config/db.php
$host = 'localhost';
$db   = 'inventario_db';
$user = 'root';
$pass = '';          // XAMPP por defecto no tiene contraseña
```

### Paso 4 — Iniciar Apache y MySQL en XAMPP

Asegúrate de que tanto **Apache** como **MySQL** estén en estado `Running` en el panel de control de XAMPP antes de continuar.

### Paso 5 — Instalar dependencias del frontend

```bash
cd frontend
npm install
```

### Paso 6 — Levantar el servidor de desarrollo

```bash
npm run dev
```

La aplicación quedará disponible en:

```
http://localhost:5173
```

El proxy de Vite enrutará automáticamente todas las peticiones `/api/*` hacia Apache en el puerto 80.

### Build para producción

```bash
cd frontend
npm run build
```

El directorio `dist/` generado puede copiarse a `htdocs/GestionTI/` y servirse directamente desde Apache. Asegúrate de configurar `mod_rewrite` para redirigir todas las rutas al `index.html` de la SPA.

### Credenciales de acceso iniciales

> ⚠️ **Cambia estas contraseñas inmediatamente en un entorno de producción.**

| Usuario | Rol | Acceso |
|---|---|---|
| `FREIDERD` | Administrador | Acceso completo a todos los módulos |
| `ADMIN` | Avanzado | Acceso a configuración sin operaciones destructivas |
| `JHOND` | Funcionario | Solo mesa de servicios (`/tickets`) |

Las contraseñas de cada usuario se encuentran en el script SQL de inicialización.

---

## 🔐 Autenticación y permisos (PBAC)

El sistema implementa **Permission-Based Access Control (PBAC)**: 18 flags booleanos almacenados directamente como columnas `tinyint(1)` en la tabla `roles`. No existe una tabla intermedia de permisos, lo que simplifica las consultas y acelera la verificación.

### Los 18 permisos disponibles

#### Inventario

| Código | Descripción |
|---|---|
| `inv_ver` | Ver el inventario general de equipos |
| `inv_crear_editar` | Crear y editar registros de equipos |
| `inv_eliminar` | Eliminar registros del inventario |
| `inv_asignaciones` | Gestionar insumos, repuestos y asignaciones |
| `inv_licencias` | Gestionar licencias de software |
| `inv_bajas` | Registrar bajas de activos |

#### Tickets y soporte

| Código | Descripción |
|---|---|
| `tk_ver_global` | Ver todos los tickets del sistema (no solo los propios) |
| `tk_responder` | Responder y actualizar tickets como técnico |
| `tk_asignar_otros` | Reasignar tickets a otros técnicos |
| `tk_mantenimientos` | Acceder a hojas de vida y registrar mantenimientos |
| `tk_crear` | Crear nuevos tickets de soporte |

#### Usuarios

| Código | Descripción |
|---|---|
| `usr_ver` | Ver el listado de usuarios del sistema |
| `usr_gestionar` | Crear, editar y desactivar usuarios |

#### Reportes y configuración

| Código | Descripción |
|---|---|
| `rep_generar` | Generar reportes y exportar a CSV / PDF |
| `conf_basica` | Configuración general, ver logs de auditoría |
| `conf_roles` | Gestionar roles y su matriz de permisos |
| `conf_avanzada` | Backup, restauración de BD y limpieza de logs |
| `conf_sla` | Configurar tiempos SLA y palabras clave de prioridad |

### Flujo de autenticación

```
1. POST /api/auth/login
   └── Valida credenciales contra hash bcrypt
   └── Registra ultimo_acceso en la BD
   └── Guarda $_SESSION con user_id, username, nombre, role, permisos[]

2. Cada request protegida:
   ├── Auth::requireLogin()         → verifica $_SESSION['user_id']
   ├── Auth::checkForceLogout($pdo) → detecta cambio de permisos por admin
   └── Permission::require('flag') → verifica el permiso específico del endpoint

3. Respuesta en caso de error:
   ├── 401 — No autenticado
   └── 403 — Sin permiso suficiente

4. Redirección post-login (frontend):
   ├── esAdministrativo() = true  → /dashboard
   └── esAdministrativo() = false → /tickets
```

### `esAdministrativo()` — lógica de rol

La función `esAdministrativo()` en `AuthContext.jsx` devuelve `true` si el usuario posee **al menos uno** de los siguientes permisos: `inv_ver`, `tk_ver_global`, `tk_responder`, `usr_ver`, `rep_generar`, `conf_basica`. Determina el layout mostrado, las rutas accesibles y la página de inicio tras el login.

---

## 📡 API REST — Referencia de endpoints

**Base URL (desarrollo):** `http://localhost:5173/api` *(proxiado a Apache)*

**Formato de respuesta estándar:**

```json
// Éxito
{ "success": true, "message": "Operación exitosa", "data": { ... } }

// Error
{ "success": false, "message": "Descripción del error" }
```

---

### 🔑 Autenticación

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/auth/login` | Público | Iniciar sesión |
| `POST` | `/auth/logout` | Público | Cerrar sesión y destruir cookie |
| `GET` | `/auth/me` | login | Usuario actual con su array de permisos |
| `GET` | `/auth/permisos` | login | Array de permisos del usuario activo |
| `POST` | `/auth/recovery` | Público | Solicitar recuperación de contraseña |
| `POST` | `/auth/change-password` | login | Cambiar contraseña del usuario activo |
| `GET` | `/auth/profile-stats` | login | Estadísticas del perfil (tickets, equipos, etc.) |

---

### 📊 Dashboard

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/dashboard/data` | login | KPIs y datos para gráficas |
| `GET` / `POST` | `/dashboard/config` | login | Leer o guardar layout de widgets personalizado |
| `GET` | `/dashboard/sla-stats` | login | Estadísticas de cumplimiento de SLA |

---

### 🎫 Tickets

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/tickets/my` | login | Tickets del usuario actual |
| `GET` | `/tickets/all` | `tk_ver_global` | Todos los tickets del sistema |
| `GET` | `/tickets/detail?id=` | login | Detalle + historial de chat + timeline de eventos |
| `POST` | `/tickets/create` | `tk_crear` | Crear ticket (`multipart/form-data`, admite adjunto) |
| `POST` | `/tickets/reply` | login | Enviar mensaje en el chat del ticket |
| `POST` | `/tickets/update` | `tk_responder` | Cambiar estado, categoría o técnico asignado |
| `POST` | `/tickets/escalate` | `tk_responder` | Escalar ticket a otro técnico con motivo obligatorio |
| `POST` | `/tickets/rate` | login | Calificar y cerrar ticket (1–5 estrellas) |
| `POST` | `/tickets/reopen` | login | Reabrir un ticket en estado Cerrado |
| `GET` | `/tickets/timeline?id=` | login | Timeline completo de eventos del ticket |
| `GET` | `/tickets/chat-users` | `tk_ver_global` | Usuarios disponibles para asignar al chat |

---

### 📦 Inventario

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/equipments` | `inv_ver` | Listado paginado de equipos |
| `GET` | `/equipments/{id}` | `inv_ver` | Detalle completo de un equipo |
| `GET` | `/equipments/listas` | `inv_ver` | Listas auxiliares (marcas, tipos, áreas, configs) |
| `GET` | `/equipments/totales` | `inv_ver` | KPIs del inventario (totales por categoría) |
| `POST` | `/equipments/create` | `inv_crear_editar` | Crear nuevo equipo |
| `POST` | `/equipments/update` | `inv_crear_editar` | Actualizar datos de un equipo existente |
| `POST` | `/equipments/delete` | `inv_eliminar` | Eliminar un equipo del inventario |

---

### 🔧 Mantenimientos

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/maintenance/list` | `tk_mantenimientos` | Listado de equipos con fichas técnicas |
| `GET` | `/maintenance/detail?id=` | `tk_mantenimientos` | Ficha técnica completa con historial de intervenciones |
| `POST` | `/maintenance/save` | `tk_mantenimientos` | Registrar nueva intervención de mantenimiento |
| `POST` | `/maintenance/update` | `tk_mantenimientos` | Actualizar datos técnicos del equipo |

---

### 💿 Licencias

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/licenses` | `inv_licencias` | Listado de licencias de software |
| `GET` | `/licenses/listas` | `inv_licencias` | Listas auxiliares (equipos, áreas) |
| `POST` | `/licenses/create` | `inv_licencias` | Registrar nueva licencia |
| `POST` | `/licenses/update` | `inv_licencias` | Actualizar datos de una licencia |
| `POST` | `/licenses/delete` | `inv_licencias` | Eliminar licencia del registro |

---

### 📋 Asignaciones

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/assignments` | `inv_asignaciones` | Catálogo de artículos e insumos |
| `GET` | `/assignments/asignaciones` | `inv_asignaciones` | Asignaciones activas a funcionarios/equipos/áreas |
| `POST` | `/assignments/save` | `inv_asignaciones` | Crear o editar artículo en el catálogo |
| `POST` | `/assignments/asignar` | `inv_asignaciones` | Registrar nueva asignación (descuenta stock) |
| `POST` | `/assignments/edit-asignacion` | `inv_asignaciones` | Modificar una asignación existente |
| `POST` | `/assignments/delete-asignacion` | `inv_asignaciones` | Eliminar asignación (restaura stock automáticamente) |

---

### ❌ Bajas

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/bajas/search?q=` | `inv_bajas` | Buscar activo por serial para dar de baja |
| `POST` | `/bajas/save` | `inv_bajas` | Registrar baja (desvincula periféricos, licencias y asignaciones) |
| `GET` | `/bajas/list` | `inv_bajas` | Historial completo de bajas |
| `GET` | `/bajas/consolidated` | `inv_bajas` | Consolidado de bajas por categoría de activo |

---

### 📄 Reportes

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/reports/generate` | `rep_generar` | Generar reporte con filtros (`preview` / `csv` / `pdf_all`) |
| `GET` | `/reports/listas` | `rep_generar` | Opciones de filtros disponibles por tipo de reporte |

---

### 🔔 Notificaciones

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/notifications` | login | Lista de notificaciones del usuario activo |
| `POST` | `/notifications/send` | login | Enviar notificación a usuario o grupo |
| `POST` | `/notifications/mark-read` | login | Marcar notificación como leída |
| `POST` | `/notifications/mark-read-by-related` | login | Marcar como leídas todas las relacionadas con una entidad |

---

### 🔍 Búsqueda global

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/search/global?q=` | login | Búsqueda simultánea en todas las entidades del sistema |

---

### ⚙️ Auxiliares y usuarios

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/aux/areas` | login | Listado de áreas |
| `GET` | `/aux/marcas` | login | Listado de marcas |
| `GET` | `/aux/tipos` | login | Tipos de activo disponibles |
| `GET` | `/aux/configuraciones` | login | Configuraciones de hardware registradas |
| `GET` | `/aux/funcionarios` | login | Listado de funcionarios |
| `POST` | `/aux/save` | login | Crear registro auxiliar o iniciar backup de BD |
| `GET` | `/aux/users` | `usr_ver` | Listado paginado de usuarios del sistema |
| `POST` | `/aux/users/save` | `usr_gestionar` | Crear o editar usuario |
| `POST` | `/aux/users/toggle-status` | `usr_gestionar` | Activar o desactivar cuenta de usuario |
| `POST` | `/aux/users/force-logout` | `usr_gestionar` | Forzar cierre de sesión remoto |

---

### 🔒 Permisos y configuración del sistema

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/permissions/roles` | `conf_basica` | Lista de roles con su matriz completa de permisos |
| `POST` | `/permissions/roles/save` | `conf_roles` | Crear o editar un rol |
| `POST` | `/permissions/delete-role` | `conf_roles` | Eliminar un rol |
| `GET` | `/permissions/config-sla` | `conf_sla` | Configuración SLA activa |
| `POST` | `/permissions/save-sla` | `conf_sla` | Actualizar tiempos de SLA |
| `POST` | `/permissions/delete-sla` | `conf_sla` | Eliminar configuración de SLA |
| `GET` | `/permissions/keywords` | `conf_sla` | Palabras clave de prioridad automática |
| `POST` | `/permissions/save-keyword` | `conf_sla` | Agregar nueva palabra clave |
| `POST` | `/permissions/delete-keyword` | `conf_sla` | Eliminar palabra clave |
| `GET` | `/permissions/logs` | `conf_basica` | Log de auditoría del sistema |
| `POST` | `/permissions/clear-logs` | `conf_avanzada` | Limpiar logs con más de 30 días de antigüedad |
| `POST` | `/permissions/import-backup` | `conf_avanzada` | Restaurar base de datos desde archivo SQL |

---

### 📡 SSE — Tiempo real

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/stream` | Stream persistente de eventos en tiempo real |

---

## 🖼️ Módulos del frontend

### Dashboard (`/dashboard`)

Dashboard completamente personalizable mediante drag-and-drop. Cuenta con un catálogo de **22 tipos de widgets**:

- **KPIs numéricos:** totales de PCs, portátiles, impresoras, licencias, tickets abiertos, cumplimiento SLA.
- **Gráficas Chart.js:** barras comparativas, pie de distribución por categoría, doughnut de estado de tickets, línea de tendencia temporal.
- **Listas:** auditoría reciente, SLAs próximos a vencer.

La configuración de widgets se persiste en la columna `usuarios.dashboard_config` (JSON), por lo que cada usuario conserva su layout personalizado entre sesiones.

> Los usuarios sin permisos administrativos son redirigidos automáticamente a `/tickets` al intentar acceder a esta ruta.

---

### Mesa de Servicios (`/tickets`)

Vista de usuario final para la gestión autónoma de solicitudes de soporte:

- Creación de tickets con descripción, archivo adjunto (imagen o documento) y **prioridad automática** por palabras clave.
- Chat bidireccional con el equipo técnico con actualizaciones en tiempo real vía SSE.
- Wizard de calificación post-resolución (1–5 estrellas), disponible al recibir respuesta del técnico.
- **Detección anti-spam:** el sistema detecta tickets duplicados abiertos y alerta al usuario antes de crear uno nuevo.

---

### Gestión de Tickets (`/gestion-tickets`)

Vista exclusiva para el equipo técnico (requiere `tk_ver_global`). Incluye:

- Tabla completa con filtros combinables por estado, prioridad, técnico asignado y categoría.
- **Panel de detalle en tres secciones:**
  1. Información del ticket (datos, SLA, historial de estados)
  2. Chat con burbujas diferenciadas por rol (usuario / técnico)
  3. Timeline cronológico de eventos (creación, cambios de estado, escalamientos)
- Acciones disponibles: cambiar estado, asignar técnico, escalar con motivo obligatorio, responder.

---

### Inventario (`/equipos`)

CRUD completo para **5 tipos de activos tecnológicos:**

| Tipo | Campos específicos |
|---|---|
| 💻 Computadores de escritorio / portátiles | Serial, configuración de hardware, protecciones de seguridad (cifrado, antivirus, firewall), nivel de clasificación, TeamViewer ID |
| 🖨️ Impresoras y escáneres | Tipo de conexión, IP de red |
| 🖥️ Monitores | Tamaño, resolución, tipo de panel |
| ☎️ Teléfonos IP | Extensión, dirección IP |
| 📦 Otros activos | Categoría libre |

Características adicionales: selectores con **Quick Add inline** para crear marcas, tipos, áreas y configuraciones sin salir del formulario. KPIs de totales por categoría en la cabecera de la página.

---

### Asignaciones (`/asignaciones`)

Control de stock de insumos y repuestos con columnas virtuales (`cantidad_total` calculada desde la BD):

- Registro de asignaciones a funcionarios, áreas o equipos específicos.
- La devolución de un artículo restaura automáticamente el stock disponible.
- Historial de asignaciones activas con fecha, receptor y cantidad.

---

### Licencias (`/licencias`)

Registro y seguimiento de licencias de software:

- CRUD completo con serial key y **toggle de visibilidad** (ocultar/mostrar la clave en pantalla).
- Asignación de licencias a equipos específicos o a áreas completas.
- Control de fechas de vencimiento.

---

### Bajas (`/bajas`)

El módulo soporta **tres flujos de baja** diferentes:

1. **Activo en inventario:** búsqueda por número de serial, confirmación y soft-delete. Al darse de baja un equipo, el sistema desvincula automáticamente sus periféricos, licencias activas y asignaciones pendientes.
2. **Activo no inventariado:** formulario manual para registrar bienes sin serial en el sistema.
3. **Insumo genérico:** baja con cantidad apilable para repuestos o consumibles.

---

### Hojas de Vida / Mantenimientos (`/mantenimientos`)

Ficha técnica completa por equipo con historial de intervenciones:

| Tipo de mantenimiento | Requisito |
|---|---|
| 🔵 Preventivo | Descripción de la intervención |
| 🟠 Correctivo | Razón del fallo **obligatoria** |
| 🟣 Repotenciación | Descripción de la actualización de hardware |

Incluye registro de cambios en datos del equipo con justificación obligatoria para garantizar trazabilidad.

---

### Reportes (`/reportes`)

Seis tipos de reporte con filtros dinámicos:

| Reporte | Filtros disponibles |
|---|---|
| 📦 Inventario | Tipo, área, estado, marca |
| 🔩 Repuestos | Área, estado de stock |
| 💿 Licencias | Software, área, vencimiento |
| 🎫 Tickets | Rango de fechas, estado, técnico, prioridad |
| ❌ Bajas | Rango de fechas, categoría |
| 📋 Logs de auditoría | Usuario, acción, fecha |

Opciones de salida: vista previa paginada en pantalla, exportación a **CSV** (con BOM UTF-8 para compatibilidad con Excel) y exportación a **PDF**.

---

### Configuración (`/configuracion`)

Seis pestañas protegidas individualmente por permiso:

| Tab | Permiso | Funcionalidad |
|---|---|---|
| 🎨 Apariencia | — | Modo oscuro y sidebar compacto (80px); persiste en `localStorage` |
| ⚙️ Sistema | `conf_basica` | Información del sistema, backup/restauración de BD, log de auditoría |
| 👥 Usuarios | `usr_ver` | Tabla paginada, CRUD de usuarios, toggle activo/inactivo, force logout remoto |
| 🔐 Roles y Permisos | `conf_roles` | Matriz visual de 18 permisos por rol, crear/editar/eliminar roles |
| ⏱️ SLAs | `conf_sla` | Tiempos de respuesta y resolución por prioridad |
| 🏷️ Prioridades | `conf_sla` | CRUD de palabras clave para asignación automática de prioridad |

---

### Perfil (`/perfil`)

Panel personal del usuario activo:

- Estadísticas individuales: tickets creados, tickets resueltos, equipos asignados a cargo, mantenimientos registrados.
- Cambio de contraseña con **validación de fortaleza en tiempo real:** debe incluir mayúscula, minúscula, número, carácter especial y mínimo 8 caracteres.

---

## 🗺️ Rutas protegidas

| Ruta | Componente | Permiso requerido |
|---|---|---|
| `/login` | Login | Público |
| `/` | HomeRedirect | Redirige automáticamente según rol |
| `/dashboard` | Dashboard | Usuario autenticado con perfil administrativo |
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

```
/ o /login (con sesión activa):
  esAdministrativo() = true  → /dashboard
  esAdministrativo() = false → /tickets

/dashboard sin esAdministrativo() → redirige a /tickets

Ruta protegida sin permiso suficiente → redirige a /dashboard
```

---

## ⚡ Tiempo real con SSE

El endpoint `GET /api/stream` (`backend/stream.php`) mantiene una **conexión HTTP persistente** con cada cliente conectado. Corre bajo Apache —no bajo el servidor integrado de PHP— para evitar bloqueos de proceso.

El cliente React gestiona la conexión en `RealtimeContext.jsx` mediante el hook `useSSE.js`.

### Eventos emitidos

| Evento | Cuándo se dispara |
|---|---|
| `new_notification` | Nueva notificación personal o broadcast |
| `tickets_update` | Cambio de estado en cualquier ticket |
| `chat_update` | Nuevo mensaje en el chat de un ticket |
| `system_update` | Cambio en inventario u otras entidades del sistema |
| `force_logout` | El administrador revocó la sesión del usuario activo |

---

## 🎨 Preferencias de usuario y temas

Las preferencias visuales se almacenan en `localStorage` del navegador y son instantáneas (sin recarga de página):

| Clave | Tipo | Descripción |
|---|---|---|
| `darkMode` | `'true'` / `'false'` | Activa el modo oscuro |
| `sidebarCompact` | `'true'` / `'false'` | Reduce el sidebar a 80px de ancho |

### Prevención de FOUC (Flash of Unstyled Content)

`index.html` contiene un **script inline en el `<head>`** que lee `localStorage` y aplica `data-theme="dark"` al elemento `<html>` *antes* de que el bundle de React cargue, eliminando el parpadeo de tema en la carga inicial. `AppLayout.jsx` aplica ambas preferencias al montar y limpia las clases temporales.

### Variables CSS del sistema de temas

```css
/* Tema claro (por defecto) */
:root {
  --primary-color: #4a6cf7;
  --bg-color:      #f0f2f5;
  --card-bg:       #ffffff;
  --text-color:    #333333;
}

/* Tema oscuro */
[data-theme="dark"] {
  --primary-color: #6aa5e3;
  --bg-color:      #121212;
  --card-bg:       #1e1e1e;
  --text-color:    #e0e0e0;
}
```

---

<div align="center">

*GestionTI — Desarrollado con React 19 + PHP 8.0 + MariaDB*

</div>