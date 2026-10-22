<div align="center">

# 🖥️ GestionTI

### Plataforma Integral de Gestión de Inventario TI, Mesa de Servicios y Control de Activos

[![Versión](https://img.shields.io/badge/versión-3.9.0-4a6cf7?style=for-the-badge&logo=git)](.)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PHP](https://img.shields.io/badge/PHP-8.2%20%7C%208.0+-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![MariaDB](https://img.shields.io/badge/MariaDB-10.4+-003545?style=for-the-badge&logo=mariadb&logoColor=white)](https://mariadb.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04%20LTS-E95420?style=for-the-badge&logo=ubuntu&logoColor=white)](https://ubuntu.com/)

*Ecosistema web corporativo para centralizar el ciclo de vida de infraestructura tecnológica, monitoreo de SLA, línea de tiempo de casos, mesa de ayuda con distribución técnica, topología de red interactiva y seguridad basada en permisos granulares (PBAC).*

---

</div>

## 📑 Tabla de Contenidos

1. [Descripción General](#-descripción-general)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Stack Tecnológico](#-stack-tecnológico)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Modelo de Datos](#-modelo-de-datos)
6. [Autenticación y Permisos (PBAC)](#-autenticación-y-permisos-pbac)
7. [Referencia de la API REST](#-referencia-de-la-api-rest)
8. [Módulos del Frontend](#-módulos-del-frontend)
9. [Tiempo Real (SSE)](#-tiempo-real-con-sse)
10. [Instalación en Entorno Local (Windows / XAMPP)](#-instalación-en-entorno-local-windows--xampp)
11. [Guía de Despliegue en Servidor Linux Ubuntu / VPS](#-guía-de-despliegue-en-servidor-linux-ubuntu--vps)
12. [Docker y Contenedores](#-docker-y-contenedores)
13. [Historial de Cambios (Changelog)](#-historial-de-cambios)

---

## 🧭 Descripción General

**GestionTI** es una solución integral diseñada para optimizar los procesos de soporte y administración de TI en organizaciones medianas y grandes. Combina la trazabilidad técnica de activos físicos y lógicos con una mesa de servicios ágil y predictiva.

### Capacidades Principales

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                GESTION TI                                    │
├─────────────────────┬──────────────────────────┬─────────────────────────────┤
│ 💻 GESTIÓN ACTIVOS  │ 🎫 MESA DE SERVICIOS     │ 🛡️ GOBERNANZA & CONTROL     │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ • Inventario 5 tipos│ • Panel Cargas Técnicos  │ • PBAC (19 Flags por rol)   │
│ • Hojas de Vida     │ • SLA con semáforo       │ • Topología de Red (Canvas) │
│ • Insumos/Repuestos │ • Chat interactivo SSE   │ • Auditoría de acciones     │
│ • Licencias Softw.  │ • Línea de Vida (Eventos)│ • Reportes PDF / CSV UTF-8  │
│ • Archivo de Bajas  │ • Prioridad Automática   │ • Backup / Restore SQL      │
└─────────────────────┴──────────────────────────┴─────────────────────────────┘
```

---

## 🏗️ Arquitectura del Sistema

```
                             ┌───────────────────────────────┐
                             │       CLIENTE WEB (SPA)       │
                             │    React 19 + TailwindCSS 4   │
                             └───────────────┬───────────────┘
                                             │ HTTP / HTTPS (Axios)
                                             │ EventSource (SSE)
                                             ▼
                             ┌───────────────────────────────┐
                             │    SERVIDOR WEB / PROXY       │
                             │    Nginx (Prod) / Apache      │
                             └───────┬───────────────┬───────┘
                     Peticiones REST │               │ Eventos /api/stream
                                     ▼               ▼
                      ┌──────────────────────┐ ┌──────────────────────┐
                      │ backend/index.php    │ │ backend/stream.php   │
                      │ Router (~84 rutas)   │ │ Loop SSE no bloqueante│
                      └──────────┬───────────┘ └──────────┬───────────┘
                                 │                        │
                                 ▼                        │
                      ┌──────────────────────┐            │
                      │   16 Controladores   │            │
                      │   Auth & PBAC Check  │            │
                      └──────────┬───────────┘            │
                                 │ PDO                    │ PDO
                                 ▼                        ▼
                      ┌───────────────────────────────────────┐
                      │       MARIADB 10.4+ / MYSQL 8.0       │
                      │          (inventario_db)              │
                      └───────────────────────────────────────┘
```

### Principios de Diseño
- **Backend desacoplado:** Configuración limpia mediante `backend/config/env.php` con jerarquía `Variables de Sistema > backend/.env > Defaults locales`.
- **CORS dinámico:** Gestionado mediante la variable `APP_ORIGINS` sin depender de directivas estáticas en `.htaccess`.
- **Sesiones PHP Seguras:** Cookies con atributos `path=/`, `SameSite=Lax` y regeneración en login/logout.
- **SSE desacoplado de sesión:** `stream.php` libera el cerrojo de sesión (`session_write_close()`) de inmediato para evitar inanición de requests concurrentes.

---

## 🛠️ Stack Tecnológico

### Frontend
| Herramienta | Versión | Rol |
|---|---|---|
| **React** | 19.0.0 | Núcleo de componentes reactivos y gestión de interfaz |
| **Vite** | 6.0.0+ | Bundler ultrarrápido y servidor de desarrollo HMR |
| **TailwindCSS** | 4.0.0+ | Motor de estilos moderno y diseño responsive |
| **React Router** | 7.0.0+ | Enrutamiento SPA con verificación PBAC integrada |
| **@xyflow/react** | 12.11.2 | Motor de diagramación interactivo para Topología de Red |
| **Chart.js** | 4.4.0+ | Visualización analítica de métricas y cumplimiento SLA |
| **Axios** | 1.16.0+ | Cliente HTTP centralizado con interceptores y credenciales |
| **SweetAlert2** | 11.0.0+ | Modales de confirmación con diseño corporativo |
| **jsPDF / AutoTable**| 4.2 / 5.0 | Motor de generación de reportes PDF vectoriales |

### Backend
| Herramienta | Versión | Rol |
|---|---|---|
| **PHP** | 8.2 / 8.0+ | Entorno de ejecución con tipado estricto y extensiones nativas |
| **PDO MySQL** | Nativo | Conexión relacional optimizada con consultas parametrizadas |
| **Nginx / Apache** | 1.24+ / 2.4+ | Servidores HTTP de alto rendimiento y terminación TLS |
| **SSE Engine** | Nativo | Servidor de eventos unidireccionales de baja latencia |

---

## 📁 Estructura del Proyecto

```
GestionTI/
├── SQL_sripts/
│   └── inventario_db_set_up.sql       # Script canónico de creación e inicialización (30 tablas)
│
├── backend/
│   ├── .env.example                   # Plantilla de variables de entorno para backend
│   ├── .htaccess                      # Configuración de reescritura Apache y headers SSE
│   ├── Dockerfile                     # Imagen de contenedor PHP 8.2 Apache
│   ├── index.php                      # Enrutador central de la API (~84 endpoints)
│   ├── router.php                     # Enrutador para servidor de desarrollo PHP CLI
│   ├── stream.php                     # Endpoint SSE en tiempo real
│   │
│   ├── config/
│   │   ├── env.php                    # Cargador de variables de entorno sin dependencias
│   │   ├── db.php                     # Conexión PDO, timezone y formateador de errores
│   │   └── ai_context.txt             # Contexto de sistema para el asistente IA
│   │
│   ├── controllers/                   # 16 Controladores de lógica de negocio
│   │   ├── AIController.php           # Consultas al asistente inteligente
│   │   ├── AssignmentController.php   # Artículos, repuestos y asignaciones
│   │   ├── AuthController.php         # Login, logout, perfil y cambio de contraseña
│   │   ├── AuxiliaryController.php    # Áreas, marcas, tipos, hardware y usuarios
│   │   ├── BajasController.php        # Registro y trazabilidad de bajas de activos
│   │   ├── DashboardController.php    # KPIs, métricas de SLA y widgets modulares
│   │   ├── EquipmentController.php    # CRUD de inventario (5 tipos de equipos)
│   │   ├── LicenseController.php      # Gestión de licencias y software
│   │   ├── MaintenanceController.php  # Hojas de vida y mantenimientos técnicos
│   │   ├── NotificationController.php # Notificaciones personales y broadcast
│   │   ├── PermissionController.php   # Roles, matriz PBAC, SLA, keywords y logs
│   │   ├── ReportController.php       # Exportación CSV y previsualización de reportes
│   │   ├── SearchController.php       # Motor de búsqueda global multi-entidad
│   │   ├── StreamController.php       # Despacho de eventos SSE
│   │   ├── TicketController.php       # Ciclo de vida de tickets, chat y supervisión
│   │   └── TopologyController.php     # Persistencia y relaciones de topología de red
│   │
│   ├── middleware/
│   │   ├── Auth.php                   # Gestión de sesiones y 19 constantes de permisos
│   │   └── Permission.php             # Controladores de acceso PBAC (require/has/requireAny)
│   │
│   ├── includes/
│   │   └── functions.php              # Sanitización, validadores y helpers
│   │
│   └── uploads/
│       └── tickets/                   # Almacenamiento seguro de evidencias de soporte
│
└── frontend/
    ├── .env.example                   # Variables del frontend (Vite)
    ├── package.json                   # Dependencias y scripts NPM
    ├── vite.config.js                 # Proxy reverso, headers de cookies y Tailwind 4
    ├── index.html                     # Entrada HTML con script anti-FOUC de tema
    │
    └── src/
        ├── App.jsx                    # Configuración de rutas protegidas
        ├── main.jsx                   # Montaje de la aplicación React
        ├── index.css                  # Sistema de diseño con variables CSS corporativas
        ├── config.js                  # Configuración de URLs y avatars
        │
        ├── api/
        │   └── client.js              # Cliente Axios con baseURL='/api' y withCredentials
        │
        ├── context/
        │   ├── AuthContext.jsx        # Estado de sesión y verificación de permisos
        │   └── RealtimeContext.jsx    # Listener SSE y gestión de notificaciones
        │
        ├── components/
        │   ├── common/                # Componentes transversales (Paginación, Selects)
        │   └── layout/                # Shell de la app (Sidebar, TopBar, AppLayout)
        │
        └── pages/                     # 13 Vistas del sistema
            ├── Login.jsx              # Autenticación y recuperación de credenciales
            ├── Dashboard.jsx          # Panel personalizable con widgets dinámicos
            ├── Tickets.jsx            # Mesa de ayuda para usuarios solicitantes
            ├── GestionTickets.jsx     # Mesa técnica, supervisión, cargas y alertas
            ├── Equipos.jsx            # Inventario general de hardware
            ├── Topology.jsx           # Mapa interactivo de infraestructura
            ├── Asignaciones.jsx       # Repuestos e insumos vinculados
            ├── Licencias.jsx          # Software corporativo y seriales
            ├── Bajas.jsx              # Archivo de desincorporación de activos
            ├── Mantenimientos.jsx     # Hojas de vida y registro técnico
            ├── Reportes.jsx           # Generador de reportes PDF/CSV
            ├── Configuracion.jsx      # Usuarios, roles, SLA, auditoría y backup
            └── Perfil.jsx             # Panel personal y seguridad de cuenta
```

---

## 🗄️ Modelo de Datos

El archivo `SQL_sripts/inventario_db_set_up.sql` inicializa la base de datos `inventario_db` conformada por **30 tablas normalizadas**:

```
┌─── USUARIOS Y SEGURIDAD ──────┐   ┌─── INVENTARIO Y ACTIVOS ───────────┐
│ usuarios                      │   │ equipos_de_computo                 │
│ roles (19 columnas PBAC)      │   │ monitores                          │
│ funcionarios                  │   │ impresoras_escaneres               │
└───────────────────────────────┘   │ telefonos                          │
                                    │ otros                              │
┌─── TICKETS Y SUPERVISIÓN ─────┐   │ articulos (stock e insumos)        │
│ tickets                       │   │ asignaciones                       │
│ tickets_chat                  │   │ licencias                          │
│ ticket_eventos (Línea de vida)│   │ historial_equipos                  │
│ tickets_trazabilidad          │   │ bajas                              │
│ config_prioridades            │   └────────────────────────────────────┘
└───────────────────────────────┘
                                    ┌─── SLA Y OPERACIÓN ────────────────┐
┌─── NOTIFICACIONES Y AUDITORÍA ┐   │ config_slas                        │
│ notificaciones                │   │ sla_config                         │
│ acciones (Log de auditoría)   │   │ sla_registros                      │
└───────────────────────────────┘   └────────────────────────────────────┘

┌─── TOPOLOGÍA Y CONFIGURACIÓN ─┐   ┌─── DATOS AUXILIARES ───────────────┐
│ topology_nodes / edges        │   │ areas, marcas, tipos, modulos      │
│ widget_templates              │   │ configuraciones (RAM/ROM)          │
└───────────────────────────────┘   └────────────────────────────────────┘
```

---

## 🔐 Autenticación y Permisos (PBAC)

GestionTI utiliza un modelo de **Control de Acceso Basado en Permisos (PBAC)**. Cada rol almacena directamente sus permisos en columnas booleanas (`tinyint(1)`), permitiendo una verificación en memoria ultraeficiente sin JOINs costosos.

### Matriz de los 19 Permisos

| Permiso | Descripción Operativa | Vistas Vinculadas |
|---|---|---|
| `inv_ver` | Visualizar el inventario general de activos | `/equipos` |
| `inv_crear_editar` | Registrar y modificar equipos, insumos y hardware | Formularios de inventario |
| `inv_eliminar` | Eliminar equipos o darlos de baja definitiva | Acciones de borrado |
| `inv_asignaciones` | Gestionar repuestos, insumos y destinos | `/asignaciones` |
| `inv_licencias` | Registrar licencias de software y seriales | `/licencias` |
| `inv_bajas` | Consultar y procesar archivo histórico de bajas | `/bajas` |
| `inv_topology` | Visualizar y modificar el canvas de topología | `/topology` |
| `tk_crear` | Radicar nuevos tickets de soporte técnico | `/tickets` |
| `tk_responder` | Atender, responder y resolver tickets | `/gestion-tickets` |
| `tk_ver_global` | Ver todos los tickets de la organización | Mesa técnica global |
| `tk_asignar_otros` | Reasignar casos y enviar alertas operativas | Panel de técnicos |
| `tk_mantenimientos` | Crear mantenimientos y modificar fichas técnicas | `/mantenimientos` |
| `usr_ver` | Ver listado de usuarios de la organización | `/configuracion` (Usuarios) |
| `usr_gestionar` | Crear, editar, activar/desactivar y forzar logout | Acciones de usuario |
| `rep_generar` | Generar y exportar reportes (PDF / CSV) | `/reportes` |
| `conf_basica` | Ver logs de auditoría y parámetros básicos | `/configuracion` (Sistema) |
| `conf_roles` | Crear y editar roles y sus matrices de permisos | `/configuracion` (Roles) |
| `conf_sla` | Modificar acuerdos de servicio y palabras clave | `/configuracion` (SLA/Keywords) |
| `conf_avanzada` | Generar y restaurar copias de seguridad de BD | `/configuracion` (Backups) |

---

## 📡 Referencia de la API REST

Todas las respuestas utilizan la estructura unificada de transporte:
```json
{
  "success": true,
  "message": "Operación ejecutada correctamente",
  "data": { ... }
}
```

### Endpoints Principales

| Módulo | Método | Endpoint | Permiso Requerido |
|---|---|---|---|
| **Auth** | `POST` | `/auth/login` | Público |
| **Auth** | `POST` | `/auth/logout` | Sesión activa |
| **Auth** | `GET` | `/auth/me` | Sesión activa |
| **Tickets** | `GET` | `/tickets/my` | Sesión activa |
| **Tickets** | `GET` | `/tickets/all` | `tk_ver_global` o `tk_responder` |
| **Tickets** | `GET` | `/tickets/technician-stats`| `tk_ver_global` o `tk_asignar_otros` |
| **Tickets** | `POST` | `/tickets/send-alert` | `tk_ver_global` o `tk_asignar_otros` |
| **Tickets** | `GET` | `/tickets/timeline?id={id}`| Creador o técnico asignado |
| **Inventario** | `GET` | `/equipments` | `inv_ver` |
| **Inventario** | `POST` | `/equipments/create` | `inv_crear_editar` |
| **Topología** | `GET` | `/topology/data` | `inv_topology` |
| **Topología** | `POST` | `/topology/save` | `inv_topology` |
| **Mantenimientos**| `GET` | `/maintenance/list` | `tk_mantenimientos` |
| **Reportes** | `POST` | `/reports/generate` | `rep_generar` |
| **Configuración** | `POST` | `/permissions/import-backup` | `conf_avanzada` |
| **SSE** | `GET` | `/stream` | Sesión activa |

---

## 🖼️ Módulos del Frontend

### 1. Panel de Supervisión y Técnicos (`/gestion-tickets`)
Vista operativa de doble dimensión:
- **Gestión de Tickets:** Filtros por estado, prioridad y asignación, modal de resolución con concepto obligatorio y chat directo.
- **Panel de Carga y Rendimiento Técnico:** Vista global con porcentaje de capacidad recomendada por técnico, índice de satisfacción en estrellas, tickets represados y modal de emisión de **Alertas Operativas** dirigidas con enlace directo al ticket afectado.

### 2. Línea de Vida del Ticket (Timeline)
Visualización vertical de eventos en tiempo real: creación, cambios de estado, escalamientos con motivo, autoasignaciones, resolución con dictamen técnico y reaperturas.

### 3. Validador y Conteo de Caracteres en Tiempo Real
Todos los formularios con restricciones de caracteres mínimos o máximos (descripciones, motivos de escalado, conceptos de resolución, justificaciones de mantenimiento) cuentan con retroalimentación visual en tiempo real (indicador verde/rojo según cumplimiento).

### 4. Topología de Red Interactiva (`/topology`)
Canvas interactivo construido sobre `@xyflow/react` para diseñar, agrupar y trazar enlaces entre nodos de red, servidores y terminales con persistencia en base de datos.

---

## ⚡ Tiempo Real con SSE

GestionTI cuenta con un bus de eventos unidireccional vía **Server-Sent Events** (`/api/stream`):
- Notificaciones push de tickets asignados o escalados.
- Actualización en vivo del chat interno sin necesidad de recargar la página.
- Desconexión forzosa remota (`force_logout`) cuando el administrador revoca accesos.
- Alertas sonoras e insignias en el encabezado con contador de no leídos.

---

## 💻 Instalación en Entorno Local (Windows / XAMPP)

### Requisitos
- **XAMPP** con Apache 2.4 y PHP 8.0 o superior.
- **MariaDB** 10.4+.
- **Node.js** 18+ y **npm** 9+.

### Pasos de Configuración

1. **Ubicación del Proyecto:**
   Clona o copia el proyecto en el directorio `htdocs` de XAMPP:
   ```powershell
   C:\xampp\htdocs\GestionTI\
   ```

2. **Cargar Base de Datos:**
   Inicia Apache y MySQL desde el panel de XAMPP. Abre una terminal o phpMyAdmin e importa el script SQL:
   ```sql
   CREATE DATABASE inventario_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE inventario_db;
   SOURCE C:/xampp/htdocs/GestionTI/SQL_sripts/inventario_db_set_up.sql;
   ```

3. **Variables de Entorno (Opcional en local):**
   Si deseas personalizar credenciales, copia `backend/.env.example` a `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_NAME=inventario_db
   DB_USER=root
   DB_PASS=
   APP_ORIGINS=http://localhost:5173
   ```

4. **Instalar Dependencias y Ejecutar Frontend:**
   ```bash
   cd C:\xampp\htdocs\GestionTI\frontend
   npm install
   npm run dev
   ```

5. **Acceso:**
   Navega a `http://localhost:5173`. El usuario inicial es `ADMIN` (contraseña en el script SQL).

---

## 🐧 Guía de Despliegue en Servidor Linux Ubuntu / VPS

Esta guía describe el despliegue profesional para **Ubuntu 22.04 / 24.04 LTS** utilizando **Nginx**, **PHP 8.2-FPM** y **MariaDB**, con soporte de HTTPS y Server-Sent Events (SSE).

### 1. Actualizar el Sistema e Instalar Paquetes Base

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip ufw software-properties-common
```

### 2. Instalar MariaDB Server

```bash
sudo apt install -y mariadb-server
sudo systemctl enable mariadb
sudo systemctl start mariadb

# Asegurar la instalación
sudo mysql_secure_installation
```

Crea la base de datos y el usuario de producción:
```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE inventario_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gestionti_user'@'localhost' IDENTIFIED BY 'TuPasswordUltraSegura_2026!';
GRANT ALL PRIVILEGES ON inventario_db.* TO 'gestionti_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Importa la estructura inicial:
```bash
# Asumiendo que clonarás en /var/www/GestionTI
sudo mysql -u gestionti_user -p inventario_db < /var/www/GestionTI/SQL_sripts/inventario_db_set_up.sql
```

### 3. Instalar PHP 8.2 y Extensiones Requeridas

```bash
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-intl
sudo systemctl enable php8.2-fpm
sudo systemctl start php8.2-fpm
```

### 4. Instalar Node.js y Compilar el Frontend

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clonar el proyecto
cd /var/www
sudo git clone https://github.com/FeiiDavii/GestionTI.git
sudo chown -R $USER:$USER /var/www/GestionTI

# Compilar frontend
cd /var/www/GestionTI/frontend
npm install
npm run build
```

### 5. Configurar Variables de Entorno del Backend

Crea el archivo `/var/www/GestionTI/backend/.env`:
```bash
nano /var/www/GestionTI/backend/.env
```
Contenido:
```ini
DB_HOST=localhost
DB_NAME=inventario_db
DB_USER=gestionti_user
DB_PASS=TuPasswordUltraSegura_2026!
APP_ORIGINS=https://tu-dominio.com,http://tu-dominio.com
AVATAR_URL=
```

Ajusta los permisos del directorio de uploads:
```bash
sudo mkdir -p /var/www/GestionTI/backend/uploads/tickets
sudo chown -R www-data:www-data /var/www/GestionTI/backend/uploads
sudo chmod -R 775 /var/www/GestionTI/backend/uploads
```

### 6. Configurar Nginx para SPA + REST API + SSE

Instala Nginx:
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

Crea el archivo de configuración para el sitio:
```bash
sudo nano /etc/nginx/sites-available/gestionti
```

Agrega la siguiente configuración optimizada:
```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Directorio de los archivos estáticos de React compilados
    root /var/www/GestionTI/frontend/dist;
    index index.html;

    client_max_body_size 30M;

    # 1. Frontend SPA: todas las rutas del cliente van a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Archivos adjuntos y evidencias
    location /uploads/ {
        alias /var/www/GestionTI/backend/uploads/;
        access_log off;
        expires 30d;
    }

    # 3. Endpoint SSE (Tiempo Real sin buffering)
    location /api/stream {
        rewrite ^/api/stream$ /stream.php break;
        root /var/www/GestionTI/backend;

        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index stream.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/GestionTI/backend/stream.php;

        # Parámetros críticos para Server-Sent Events
        proxy_buffering off;
        fastcgi_buffering off;
        fastcgi_read_timeout 86400s;
        fastcgi_send_timeout 86400s;
        tcp_nodelay on;
    }

    # 4. API REST: reescribir /api/* hacia index.php
    location /api/ {
        root /var/www/GestionTI/backend;
        rewrite ^/api/(.*)$ /index.php/$1 last;
    }

    # Procesar archivos PHP del backend
    location ~ ^/(index|stream)\.php(/|$) {
        root /var/www/GestionTI/backend;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_split_path_info ^(.+\.php)(/.*)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/GestionTI/backend$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_read_timeout 300s;
    }

    # Denegar acceso a archivos sensibles
    location ~ /\.(ht|env|git) {
        deny all;
    }
}
```

Habilita el sitio y valida la sintaxis:
```bash
sudo ln -s /etc/nginx/sites-available/gestionti /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Certificado SSL Gratuito con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

### 8. Configurar Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🐳 Docker y Contenedores

El repositorio incluye un `Dockerfile` en `backend/` para despliegues contenerizados:

```bash
# Construir la imagen del backend
docker build -t gestionti-backend ./backend

# Ejecutar el contenedor conectando a MariaDB
docker run -d --name gestionti-api \
  -p 8080:80 \
  -e DB_HOST=ip_de_tu_servidor \
  -e DB_NAME=inventario_db \
  -e DB_USER=gestionti_user \
  -e DB_PASS=TuPasswordSegura \
  -e APP_ORIGINS=https://tu-dominio.com \
  gestionti-backend
```

---

## 📝 Historial de Cambios

### v3.9.0 (Actual)
- 🚀 **Panel de Técnicos & Mesa de Ayuda:** Visualización de cargas de trabajo de soporte, satisfacción promedio y tickets represados.
- 🔔 **Alertas Operativas Dirigidas:** Sistema para alertar a técnicos asignados sobre casos atrasados con acceso directo en 1 clic.
- ⏱️ **Línea de Vida y Resolución:** Incorporación de eventos cronológicos en tickets y dictamen técnico obligatorio para resolución.
- 🔤 **Conteo Dinámico de Caracteres:** Contadores en tiempo real con retroalimentación visual en campos obligatorios de la aplicación.
- 🛡️ **Depuración PBAC:** Bloqueo y ocultamiento estricto de botones, columnas y formularios no permitidos según el perfil activo.
- 🌐 **Despliegue Linux/Nginx:** Guía exhaustiva de puesta en producción para Ubuntu LTS y VPS cloud.

---

<div align="center">

**GestionTI** · *Ingeniería y Gestión de Servicios Tecnológicos*

</div>
