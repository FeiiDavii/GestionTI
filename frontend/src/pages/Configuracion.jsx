import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auxAPI, permissionAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import Pagination from '../components/common/Pagination';
import DataTableControls from '../components/common/DataTableControls';

const TABS = [
  { id: 'apariencia', label: 'Apariencia', icon: 'fa-palette' },
  { id: 'usuarios', label: 'Usuarios', icon: 'fa-users' },
  { id: 'roles', label: 'Roles y Permisos', icon: 'fa-shield' },
  { id: 'sla', label: 'SLAs', icon: 'fa-gauge-high' },
  { id: 'prioridades', label: 'Prioridades', icon: 'fa-tag' },
  { id: 'sistema', label: 'Sistema', icon: 'fa-server' },
];

const PERMISOS_LISTA = [
  { key: 'inv_ver', label: 'Inventario - Ver' },
  { key: 'inv_crear_editar', label: 'Inventario - Crear/Editar' },
  { key: 'inv_eliminar', label: 'Inventario - Eliminar' },
  { key: 'inv_asignaciones', label: 'Inventario - Asignaciones' },
  { key: 'inv_licencias', label: 'Inventario - Licencias' },
  { key: 'inv_bajas', label: 'Inventario - Bajas' },
  { key: 'tk_ver_global', label: 'Tickets - Ver Global' },
  { key: 'tk_responder', label: 'Tickets - Responder' },
  { key: 'tk_asignar_otros', label: 'Tickets - Asignar a Otros' },
  { key: 'tk_mantenimientos', label: 'Tickets - Mantenimientos' },
  { key: 'tk_crear', label: 'Tickets - Crear' },
  { key: 'usr_ver', label: 'Usuarios - Ver' },
  { key: 'usr_gestionar', label: 'Usuarios - Gestionar' },
  { key: 'rep_generar', label: 'Reportes - Generar' },
  { key: 'conf_basica', label: 'Configuración - Básica' },
  { key: 'conf_roles', label: 'Configuración - Roles' },
  { key: 'conf_avanzada', label: 'Configuración - Avanzada' },
  { key: 'conf_sla', label: 'Configuración - SLA' }
];

const SLA_DEFAULTS = [
  { id: 1, prioridad: 'Crítica', respuesta: 1, resolucion: 4 },
  { id: 2, prioridad: 'Alta', respuesta: 4, resolucion: 24 },
  { id: 3, prioridad: 'Media', respuesta: 8, resolucion: 48 },
  { id: 4, prioridad: 'Baja', respuesta: 24, resolucion: 72 }
];

const KEYWORDS_PREDEFINIDAS = [
  { keyword: 'servidor', prioridad: 'Crítica' },
  { keyword: 'caído', prioridad: 'Crítica' },
  { keyword: 'caido', prioridad: 'Crítica' },
  { keyword: 'hackeado', prioridad: 'Crítica' },
  { keyword: 'robo', prioridad: 'Crítica' },
  { keyword: 'incendio', prioridad: 'Crítica' },
  { keyword: 'virus', prioridad: 'Crítica' },
  { keyword: 'seguridad', prioridad: 'Crítica' },
  { keyword: 'perdida de datos', prioridad: 'Crítica' },
  { keyword: 'no arranca', prioridad: 'Crítica' },
  { keyword: 'pantalla azul', prioridad: 'Crítica' },
  { keyword: 'urgencia', prioridad: 'Alta' },
  { keyword: 'emergencia', prioridad: 'Alta' },
  { keyword: 'detenido', prioridad: 'Alta' },
  { keyword: 'no funciona', prioridad: 'Alta' },
  { keyword: 'sin acceso', prioridad: 'Alta' },
  { keyword: 'producción', prioridad: 'Alta' },
  { keyword: 'produccion', prioridad: 'Alta' },
  { keyword: 'critico', prioridad: 'Alta' },
  { keyword: 'crítico', prioridad: 'Alta' },
  { keyword: 'critica', prioridad: 'Alta' },
  { keyword: 'crítica', prioridad: 'Alta' },
  { keyword: 'apagon', prioridad: 'Alta' },
  { keyword: 'apagón', prioridad: 'Alta' },
  { keyword: 'no enciende', prioridad: 'Alta' },
  { keyword: 'internet', prioridad: 'Alta' },
  { keyword: 'wifi', prioridad: 'Alta' },
  { keyword: 'correo', prioridad: 'Alta' },
  { keyword: 'impresora', prioridad: 'Alta' },
  { keyword: 'no guarda', prioridad: 'Alta' },
  { keyword: 'error', prioridad: 'Alta' },
  { keyword: 'licencia vencida', prioridad: 'Alta' },
  { keyword: 'office', prioridad: 'Alta' },
  { keyword: 'lento', prioridad: 'Media' },
  { keyword: 'mouse', prioridad: 'Media' },
  { keyword: 'teclado', prioridad: 'Media' },
  { keyword: 'monitor', prioridad: 'Media' },
  { keyword: 'parpadea', prioridad: 'Media' },
  { keyword: 'ruido', prioridad: 'Media' },
  { keyword: 'actualizar', prioridad: 'Media' },
  { keyword: 'programar', prioridad: 'Media' },
  { keyword: 'falla', prioridad: 'Media' },
  { keyword: 'fallo', prioridad: 'Media' },
  { keyword: 'problema', prioridad: 'Media' },
  { keyword: 'soporte', prioridad: 'Media' },
  { keyword: 'ayuda', prioridad: 'Media' },
  { keyword: 'consulta', prioridad: 'Baja' },
  { keyword: 'duda', prioridad: 'Baja' },
  { keyword: 'instalar', prioridad: 'Baja' },
  { keyword: 'instalación', prioridad: 'Baja' },
  { keyword: 'instalacion', prioridad: 'Baja' },
  { keyword: 'configurar', prioridad: 'Baja' },
  { keyword: 'nuevo', prioridad: 'Baja' },
  { keyword: 'revisión', prioridad: 'Baja' },
  { keyword: 'revision', prioridad: 'Baja' },
  { keyword: 'clave', prioridad: 'Baja' },
  { keyword: 'password', prioridad: 'Baja' },
  { keyword: 'contraseña', prioridad: 'Baja' },
  { keyword: 'olvide', prioridad: 'Baja' },
  { keyword: 'olvidé', prioridad: 'Baja' },
  { keyword: 'toner', prioridad: 'Baja' },
  { keyword: 'papel', prioridad: 'Baja' },
  { keyword: 'solicitud', prioridad: 'Baja' },
  { keyword: 'permiso', prioridad: 'Baja' }
];

const ITEMS_PER_PAGE = 10; // mantenido por compatibilidad, ya no se usa directo

export default function Configuracion() {
  const { user, permisos, hasPermission, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Persistir tab activo en sessionStorage para que sobreviva un refresh
  const [tabActivo, setTabActivo] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      sessionStorage.setItem('config_tab', tabParam);
      return tabParam;
    }
    return sessionStorage.getItem('config_tab') || 'apariencia';
  });

  // Escuchar cambios en los parámetros de búsqueda de la URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== tabActivo) {
      setTabActivo(tabParam);
      sessionStorage.setItem('config_tab', tabParam);
    }
  }, [searchParams, tabActivo]);

  const cambiarTab = (id) => {
    setTabActivo(id);
    sessionStorage.setItem('config_tab', id);
    setSearchParams({ tab: id });
  };
  const [loading, setLoading] = useState(false);

  // --- Apariencia ---
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCompacto, setSidebarCompacto] = useState(() => localStorage.getItem('sidebarCompact') === 'true');

  // --- Sistema ---
  const [configSistema, setConfigSistema] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupImporting, setBackupImporting] = useState(false);
  const fileInputRef = useRef(null);
  const [widgetsCompartidos, setWidgetsCompartidos] = useState([]);
  const [logs, setLogs] = useState([]);

  // --- Usuarios ---
  const [usuarios, setUsuarios] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModalUsuario, setShowModalUsuario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formUsuario, setFormUsuario] = useState({
    username: '', nombre: '', password: '', role_id: '', id_funcionario: '', activo: true
  });

  // --- Roles ---
  const [roles, setRoles] = useState([]);
  const [rolesSimple, setRolesSimple] = useState([]); // solo para dropdowns (sin permisos)
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesPageSize, setRolesPageSize] = useState(10);
  const [rolesBusqueda, setRolesBusqueda] = useState('');
  const [showModalRol, setShowModalRol] = useState(false);
  const [editandoRol, setEditandoRol] = useState(null);
  const [formRol, setFormRol] = useState({ nombre: '', descripcion: '' });
  const [permisosRol, setPermisosRol] = useState({});

  // --- SLA ---
  const [slaConfig, setSlaConfig] = useState(SLA_DEFAULTS);
  const [slaOriginal, setSlaOriginal] = useState(null);
  const [slaPage, setSlaPage] = useState(1);
  const [slaPageSize, setSlaPageSize] = useState(10);
  const [slaBusqueda, setSlaBusqueda] = useState('');
  const [showModalSLA, setShowModalSLA] = useState(false);
  const [editandoSLA, setEditandoSLA] = useState(null);
  const [formSLA, setFormSLA] = useState({
    nombre: '', prioridad: 'Media', respuesta: 4, resolucion: 24, activo: true
  });

  // --- Keywords ---
  const [keywords, setKeywords] = useState([]);
  const [nuevaKeyword, setNuevaKeyword] = useState('');
  const [nuevaKeywordPrioridad, setNuevaKeywordPrioridad] = useState('Baja');

  // ============================================================
  // Carga de datos
  // ============================================================
  const cargarTodo = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [];

      if (hasPermission('conf_basica') || hasPermission('conf_avanzada')) {
        promises.push(
          auxAPI.configuraciones().then(r => {
            if (r.data.success) {
              setConfigSistema(r.data.data);
              setDbInfo(r.data.dbInfo || null);
              setWidgetsCompartidos(r.data.widgetsCompartidos || []);
            }
          }).catch(() => {})
        );
        promises.push(
          permissionAPI.logs().then(r => {
            if (r.data.success) setLogs(r.data.data?.data || []);
          }).catch(() => {})
        );
      }

      if (hasPermission('conf_basica') || hasPermission('conf_roles')) {
        promises.push(
          permissionAPI.roles().then(r => {
            if (r.data.success) setRoles(r.data.data || []);
          }).catch(() => {})
        );
      }

      if (hasPermission('conf_sla')) {
        promises.push(
          permissionAPI.configSLA().then(r => {
            if (r.data.success) {
              const mappedSLA = (r.data.data || []).map(s => ({
                ...s,
                prioridad: s.prioridad_ticket || s.prioridad || '',
                respuesta: s.respuesta ?? (s.tiempo_respuesta_minutos ? Math.round(s.tiempo_respuesta_minutos / 60) : 0),
                resolucion: s.resolucion ?? (s.tiempo_resolucion_minutos ? Math.round(s.tiempo_resolucion_minutos / 60) : 0)
              }));
              setSlaConfig(mappedSLA);
              setSlaOriginal(JSON.parse(JSON.stringify(mappedSLA)));
            }
          }).catch(() => {})
        );
        promises.push(
          permissionAPI.keywords().then(r => {
            if (r.data.success) setKeywords(r.data.data || []);
          }).catch(() => {})
        );
      }

      // Usuarios solo si tiene permiso
      if (hasPermission('conf_basica')) {
        promises.push(
          auxAPI.users().then(r => {
            if (r.data.success) {
              setUsuarios(r.data.data?.users || []);
              setFuncionarios(r.data.data?.funcionarios || []);
              // Usar estado separado para no sobreescribir roles completos (con permisos)
              setRolesSimple(r.data.data?.roles || []);
            }
          }).catch(() => {})
        );
      }

      await Promise.allSettled(promises);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  // Shortcut Alt+Shift+N → abrir modal según tab activo
  useEffect(() => {
    const handler = () => {
      switch (tabActivo) {
        case 'usuarios':
          if (hasPermission('usr_gestionar')) abrirModalUsuario(null);
          break;
        case 'roles':
          if (hasPermission('conf_roles')) abrirModalRol(null);
          break;
        case 'sla':
          if (hasPermission('conf_sla')) abrirModalSLA(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener('shortcut:new', handler);
    return () => window.removeEventListener('shortcut:new', handler);
  }, [tabActivo]);

  // ─── Recargas individuales (sin necesidad de reload completo) ───────────────
  const recargarUsuarios = useCallback(async () => {
    try {
      const r = await auxAPI.users();
      if (r.data.success) {
        setUsuarios(r.data.data?.users || []);
        setFuncionarios(r.data.data?.funcionarios || []);
        setRolesSimple(r.data.data?.roles || []);
      }
    } catch { /* ignore */ }
  }, []);

  const recargarRoles = useCallback(async () => {
    try {
      // Recarga roles completos (con permisos) Y rolesSimple (para el selector del modal de usuario)
      const [rolesRes, usersRes] = await Promise.allSettled([
        permissionAPI.roles(),
        auxAPI.users(),
      ]);
      if (rolesRes.status === 'fulfilled' && rolesRes.value.data.success) {
        setRoles(rolesRes.value.data.data || []);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.data.success) {
        setRolesSimple(usersRes.value.data.data?.roles || []);
      }
    } catch { /* ignore */ }
  }, []);

  const recargarSLA = useCallback(async () => {
    try {
      const r = await permissionAPI.configSLA();
      if (r.data.success) {
        const mapped = (r.data.data || []).map(s => ({
          ...s,
          prioridad: s.prioridad_ticket || s.prioridad || '',
          respuesta: s.respuesta ?? (s.tiempo_respuesta_minutos ? Math.round(s.tiempo_respuesta_minutos / 60) : 0),
          resolucion: s.resolucion ?? (s.tiempo_resolucion_minutos ? Math.round(s.tiempo_resolucion_minutos / 60) : 0),
        }));
        setSlaConfig(mapped);
        setSlaOriginal(JSON.parse(JSON.stringify(mapped)));
      }
    } catch { /* ignore */ }
  }, []);

  const recargarKeywords = useCallback(async () => {
    try {
      const r = await permissionAPI.keywords();
      if (r.data.success) setKeywords(r.data.data || []);
    } catch { /* ignore */ }
  }, []);

  // ============================================================
  // SISTEMA
  // ============================================================
  const handleBackupBD = async () => {
    const result = await Swal.fire({
      title: '¿Generar Backup?',
      text: 'Se creará una copia de seguridad completa de la base de datos.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a6cf7',
      cancelButtonColor: '#e74a3b',
      confirmButtonText: '<i class="fa-solid fa-database"></i> Generar Backup',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;

    setBackupRunning(true);
    try {
      // El backend responde con un archivo descargable, creamos un enlace temporal
      const response = await fetch('/api/aux/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'backup_bd' })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'No se pudo generar el backup', 'error');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const nameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = nameMatch ? nameMatch[1] : `backup_${new Date().toISOString().slice(0,10)}.sql`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Backup descargado correctamente', 'success');
    } catch {
      showToast('No se pudo conectar con el servidor', 'error');
    } finally {
      setBackupRunning(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.sql')) {
      showToast('Solo se permiten archivos .sql', 'warning');
      return;
    }
    const result = await Swal.fire({
      title: '¿Restaurar Backup?',
      html: `Se reemplazarán TODOS los datos actuales con el archivo <strong>${file.name}</strong>. Esta operación no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-triangle-exclamation"></i> Sí, restaurar'
    });
    if (!result.isConfirmed) { e.target.value = ''; return; }
    setBackupImporting(true);
    try {
      const formData = new FormData();
      formData.append('backup_file', file);
      const res = await permissionAPI.importBackup(formData);
      if (res.data.success) {
        showToast(res.data.message || 'Backup restaurado', 'success');
      } else {
        showToast(res.data.message || 'Error', 'error');
      }
    } catch {
      showToast('Error al restaurar el backup', 'error');
    }
    setBackupImporting(false);
    e.target.value = '';
  };

  const handleClearLogs = async () => {
    const result = await Swal.fire({
      title: '¿Limpiar Logs Antiguos?',
      text: 'Se eliminarán todos los registros de actividad con más de 30 días.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-trash"></i> Limpiar'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await permissionAPI.clearLogs?.();
      if (res?.data?.success) {
        showToast(res.data.message || 'Logs antiguos eliminados', 'success');
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  const handleSaveConfigSistema = async () => {
    try {
      const res = await auxAPI.save({ action: 'config_sistema', data: configSistema });
      if (res.data.success) {
        showToast('Configuración guardada correctamente', 'success');
      }
    } catch {
      showToast('No se pudo guardar la configuración', 'error');
    }
  };

  // ============================================================
  // USUARIOS
  // ============================================================
  const usuariosFiltrados = usuarios.filter(u =>
    (u.username || '').toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
    (u.nombre || '').toLowerCase().includes(busquedaUsuario.toLowerCase())
  );
  const totalPaginasUsuarios = Math.max(1, Math.ceil(usuariosFiltrados.length / pageSize));
  const usuariosPaginados = usuariosFiltrados.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => setPage(1), [pageSize, busquedaUsuario]);

  // Paginación de Roles
  const rolesFiltrados = roles.filter(r =>
    (r.nombre || '').toLowerCase().includes(rolesBusqueda.toLowerCase()) ||
    (r.descripcion || '').toLowerCase().includes(rolesBusqueda.toLowerCase())
  );
  const totalPaginasRoles = Math.max(1, Math.ceil(rolesFiltrados.length / rolesPageSize));
  const rolesPaginados = rolesFiltrados.slice(
    (rolesPage - 1) * rolesPageSize,
    rolesPage * rolesPageSize
  );
  useEffect(() => setRolesPage(1), [rolesPageSize, rolesBusqueda]);

  // Paginación de SLA
  const slaFiltrados = slaConfig.filter(s =>
    (s.nombre || s.prioridad || '').toLowerCase().includes(slaBusqueda.toLowerCase()) ||
    (s.prioridad || s.prioridad_ticket || '').toLowerCase().includes(slaBusqueda.toLowerCase())
  );
  const totalPaginasSLA = Math.max(1, Math.ceil(slaFiltrados.length / slaPageSize));
  const slaPaginados = slaFiltrados.slice(
    (slaPage - 1) * slaPageSize,
    slaPage * slaPageSize
  );
  useEffect(() => setSlaPage(1), [slaPageSize, slaBusqueda]);

  const abrirModalUsuario = (usuario = null) => {
    if (usuario) {
      // Proteger ADMIN
      if (usuario.username === 'admin' || usuario.username === 'ADMIN') {
        showToast('No se puede editar la cuenta de Administrador', 'warning');
        return;
      }
      // Proteger propio usuario
      if (usuario.id === user?.id || usuario.user_id === user?.id) {
        showToast('No puedes editar tu propio usuario. Ve a tu Perfil.', 'warning');
        return;
      }
      setEditandoUsuario(usuario);
      setFormUsuario({
        username: usuario.username || '',
        nombre: usuario.nombre || '',
        password: '',
        role_id: usuario.role_id || usuario.rol_id || '',
        id_funcionario: usuario.id_funcionario || '',
        activo: usuario.activo !== false
      });
    } else {
      setEditandoUsuario(null);
      setFormUsuario({ username: '', nombre: '', password: '', role_id: '', id_funcionario: '', activo: true });
    }
    setShowModalUsuario(true);
  };

  const handleSaveUsuario = async (e) => {
    e.preventDefault();
    if (!formUsuario.username || !formUsuario.nombre) {
      showToast('Completa todos los campos requeridos', 'warning');
      return;
    }
    try {
      const payload = { ...formUsuario };
      if (editandoUsuario && !payload.password) delete payload.password;
      if (editandoUsuario) payload.id = editandoUsuario.id || editandoUsuario.user_id;
      if (payload.id_funcionario === '') {
        payload.id_funcionario = null;
      }

      const res = await auxAPI.saveUser(payload);
      if (res.data.success) {
        showToast(editandoUsuario ? 'Usuario actualizado' : 'Usuario creado', 'success');
        setShowModalUsuario(false);
        await recargarUsuarios();
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  const handleToggleUsuario = async (usuario) => {
    // Proteger usuario ADMIN
    if (usuario.username === 'admin' || usuario.username === 'ADMIN') {
      showToast('No se puede desactivar la cuenta de Administrador', 'warning');
      return;
    }
    // Proteger propio usuario
    if (usuario.id === user?.id || usuario.user_id === user?.id) {
      showToast('No puedes desactivar tu propia cuenta.', 'warning');
      return;
    }
    const activoActual = usuario.activo == 1 || usuario.activo === true;
    const nuevoEstado = !activoActual;
    const result = await Swal.fire({
      title: `¿${nuevoEstado ? 'Activar' : 'Desactivar'} Usuario?`,
      text: `El usuario "${usuario.nombre || usuario.username}" quedará ${nuevoEstado ? 'activo' : 'inactivo'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: nuevoEstado ? '#1cc88a' : '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: `Sí, ${nuevoEstado ? 'Activar' : 'Desactivar'}`
    });
    if (!result.isConfirmed) return;

    try {
      const res = await auxAPI.toggleStatus({ id: usuario.id || usuario.user_id, activo: nuevoEstado ? 1 : 0 });
      if (res.data.success) {
        showToast('Estado del usuario actualizado', 'success');
        await recargarUsuarios();
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  const handleForceLogoutUsuario = async (usuario) => {
    if (usuario.username === 'admin' || usuario.username === 'ADMIN') {
      showToast('No se puede forzar cierre de sesión del Administrador', 'warning');
      return;
    }
    if (usuario.id === user?.id || usuario.user_id === user?.id) {
      showToast('No puedes cerrar tu propia sesión.', 'warning');
      return;
    }
    const result = await Swal.fire({
      title: '¿Forzar Cierre de Sesión?',
      html: `Se cerrará la sesión de <strong>${usuario.nombre || usuario.username}</strong> en todos los dispositivos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-right-from-bracket"></i> Forzar Cierre'
    });
    if (!result.isConfirmed) return;

    try {
      const res = await auxAPI.forceLogout({ id: usuario.id || usuario.user_id });
      if (res.data.success) {
        showToast('Sesión cerrada exitosamente', 'success');
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  // ============================================================
  // ROLES Y PERMISOS
  // ============================================================
  const abrirModalRol = (rol = null) => {
    if (rol) {
      setEditandoRol(rol);
      setFormRol({ nombre: rol.nombre || '', descripcion: rol.descripcion || '' });
      setPermisosRol({ ...rol.permisos });
    } else {
      setEditandoRol(null);
      setFormRol({ nombre: '', descripcion: '' });
      const permisosDefault = {};
      PERMISOS_LISTA.forEach(p => { permisosDefault[p.key] = false; });
      setPermisosRol(permisosDefault);
    }
    setShowModalRol(true);
  };

  const handleTogglePermiso = (key) => {
    setPermisosRol(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleAllPermisos = (valor) => {
    const nuevos = {};
    PERMISOS_LISTA.forEach(p => { nuevos[p.key] = valor; });
    setPermisosRol(nuevos);
  };

  const handleSaveRol = async (e) => {
    e.preventDefault();
    if (!formRol.nombre.trim()) {
      showToast('El nombre del rol es requerido', 'warning');
      return;
    }
    try {
      const payload = {
        ...formRol,
        permisos: permisosRol
      };
      if (editandoRol) payload.id = editandoRol.id || editandoRol.rol_id;

      const res = await permissionAPI.saveRole(payload);
      if (res.data.success) {
        showToast(editandoRol ? 'Rol actualizado' : 'Rol creado', 'success');
        setShowModalRol(false);
        if (editandoRol && res.data.forceLogout) {
          showToast(`Sesiones cerradas para usuarios del rol "${formRol.nombre}"`, 'info');
        }
        await recargarRoles();
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  const handleDeleteRol = async (rol) => {
    if (rol.nombre === 'Administrador' || rol.nombre === 'admin') {
      showToast('No se puede eliminar el rol de Administrador', 'warning');
      return;
    }
    if (rol.total_usuarios > 0) {
      showToast(`No se puede eliminar el rol "${rol.nombre}" porque tiene ${rol.total_usuarios} usuario(s) asignado(s).`, 'warning');
      return;
    }
    const result = await Swal.fire({
      title: '¿Eliminar Rol?',
      html: `Se eliminará el rol <strong>${rol.nombre}</strong>. Los usuarios con este rol perderán sus permisos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-trash"></i> Eliminar'
    });
    if (!result.isConfirmed) return;

    try {
      const res = await permissionAPI.deleteRole(rol.id || rol.rol_id);
      if (res.data.success) {
        showToast('Rol eliminado correctamente', 'success');
        await recargarRoles();
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  // ============================================================
  // SLA
  // ============================================================
  const abrirModalSLA = (sla = null) => {
    if (sla) {
      setEditandoSLA(sla);
      setFormSLA({
        nombre: sla.nombre || sla.prioridad || '',
        prioridad: sla.prioridad || sla.prioridad_ticket || 'Media',
        respuesta: sla.respuesta ?? (sla.tiempo_respuesta_minutos ? Math.round(sla.tiempo_respuesta_minutos / 60) : 4),
        resolucion: sla.resolucion ?? (sla.tiempo_resolucion_minutos ? Math.round(sla.tiempo_resolucion_minutos / 60) : 24),
        activo: sla.activo !== false && sla.activo !== 0
      });
    } else {
      setEditandoSLA(null);
      setFormSLA({ nombre: '', prioridad: 'Media', respuesta: 4, resolucion: 24, activo: true });
    }
    setShowModalSLA(true);
  };

  const handleSaveSLA = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formSLA.nombre.trim()) {
      showToast('El nombre del SLA es requerido', 'warning');
      return;
    }
    try {
      const payload = [
        {
          id: editandoSLA?.id || null,
          nombre: formSLA.nombre.trim(),
          prioridad: formSLA.prioridad,
          respuesta: parseInt(formSLA.respuesta) || 1,
          resolucion: parseInt(formSLA.resolucion) || 1,
          activo: formSLA.activo ? 1 : 0
        }
      ];
      const res = await permissionAPI.saveSLA({ sla: payload });
      if (res.data.success) {
        showToast(editandoSLA ? 'SLA actualizado' : 'SLA creado', 'success');
        setShowModalSLA(false);
        await recargarSLA();
      } else {
        showToast(res.data.message || 'Error al guardar el SLA', 'error');
      }
    } catch {
      showToast('Error al guardar el SLA', 'error');
    }
  };

  const handleDeleteSLA = async (sla) => {
    const result = await Swal.fire({
      title: '¿Eliminar SLA?',
      html: `Se eliminará el SLA <strong>${sla.nombre || sla.prioridad}</strong>.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-trash"></i> Eliminar'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await permissionAPI.deleteSLA(sla.id);
      if (res.data.success) {
        showToast('SLA eliminado correctamente', 'success');
        await recargarSLA();
      } else {
        showToast(res.data.message || 'No se pudo eliminar el SLA', 'error');
      }
    } catch {
      showToast('Error al eliminar el SLA', 'error');
    }
  };

  const slaModificado = JSON.stringify(slaConfig) !== JSON.stringify(slaOriginal);

  // ============================================================
  // PRIORIDADES (KEYWORDS)
  // ============================================================
  const handleAddKeyword = async () => {
    const keyword = nuevaKeyword.trim().toLowerCase();
    if (!keyword) {
      showToast('Escribe una palabra clave para agregar', 'warning');
      return;
    }
    if (keywords.some(k => (k.palabra_clave || '').toLowerCase() === keyword)) {
      showToast('Esta palabra clave ya existe', 'info');
      return;
    }
    try {
      const res = await permissionAPI.saveKeyword({ keyword, prioridad: nuevaKeywordPrioridad });
      if (res.data.success) {
        setNuevaKeyword('');
        setNuevaKeywordPrioridad('Baja');
        await recargarKeywords();
        showToast(`"${keyword}" registrada como keyword`, 'success');
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  const handleDeleteKeyword = async (kw) => {
    const palabra = kw.palabra_clave || kw.keyword || kw.palabra;
    const result = await Swal.fire({
      title: '¿Eliminar Keyword?',
      text: `Se eliminará la palabra clave "${palabra}".`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e74a3b',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-trash"></i> Eliminar'
    });
    if (!result.isConfirmed) return;

    try {
      const res = await permissionAPI.deleteKeyword(kw.id);
      if (res.data.success) {
        await recargarKeywords();
        showToast('Palabra clave eliminada', 'success');
      } else {
        showToast('Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
  };

  const handleAgregarKeywordsPredefinidas = async () => {
    const result = await Swal.fire({
      title: '¿Agregar Keywords Predefinidas?',
      text: 'Se agregarán las palabras clave predefinidas del sistema con sus prioridades respectivas.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a6cf7',
      cancelButtonColor: '#858796',
      confirmButtonText: '<i class="fa-solid fa-plus"></i> Agregar'
    });
    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      for (const item of KEYWORDS_PREDEFINIDAS) {
        const yaExiste = keywords.some(k => (k.palabra_clave || '').toLowerCase() === item.keyword.toLowerCase());
        if (!yaExiste) {
          try {
            await permissionAPI.saveKeyword({ keyword: item.keyword, prioridad: item.prioridad });
          } catch { /* continuar */ }
        }
      }
      await recargarKeywords();
      showToast('Palabras clave predefinidas agregadas exitosamente', 'success');
    } catch {
      showToast('Error al agregar palabras clave predefinidas', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // APARIENCIA
  // ============================================================
  const handleToggleDarkMode = (val) => {
    setDarkMode(val);
    localStorage.setItem('darkMode', val);
    document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light');
  };

  const handleToggleSidebar = (val) => {
    setSidebarCompacto(val);
    localStorage.setItem('sidebarCompact', val);
    document.body.classList.toggle('sidebar-compact', val);
  };

  // ============================================================
  // CONTROL DE ACCESO POR PERMISOS
  // ============================================================
  const puedeVerTab = (tabId) => {
    switch (tabId) {
      case 'apariencia': return true; // todos pueden ver apariencia
      case 'sistema': return hasPermission('conf_basica') || hasPermission('conf_avanzada');
      case 'usuarios': return hasPermission('conf_basica');
      case 'roles': return hasPermission('conf_roles');
      case 'sla': return hasPermission('conf_sla');
      case 'prioridades': return hasPermission('conf_sla');
      default: return false;
    }
  };

  // Redirigir al primer tab permitido si el actual no es accesible
  useEffect(() => {
    if (!puedeVerTab(tabActivo)) {
      const permitido = TABS.find(t => puedeVerTab(t.id));
      if (permitido) cambiarTab(permitido.id);
    }
  }, [tabActivo, permisos]);

  const tabsPermitidos = TABS.filter(t => puedeVerTab(t.id));

  if (tabsPermitidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" style={{ color: 'var(--text-color)' }}>
        <i className="fa-solid fa-lock text-5xl mb-5" style={{ color: 'var(--gray-text)' }}></i>
        <h2>Acceso Restringido</h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--gray-text)', maxWidth: '500px' }}>
          No tienes permisos para acceder al módulo de Configuración.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-10">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl" style={{ color: 'var(--primary-color)' }}></i>
        <p className="mt-3" style={{ color: 'var(--gray-text)' }}>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="inventory-module">
      <div className="inventory-header">
        <div className="page-title-row">
          <h2><i className="fa-solid fa-gear"></i> Configuración Global</h2>
        </div>
      </div>

      {/* Navegación */}
      <nav className="settings-nav">
        {tabsPermitidos.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${tabActivo === tab.id ? 'active' : ''}`}
            onClick={() => cambiarTab(tab.id)}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ============================================================ */}
      {/* TAB APARIENCIA */}
      {/* ============================================================ */}
      {tabActivo === 'apariencia' && (
        <div className="settings-tab-content">
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-palette"></i> Preferencias Visuales</h3>
            </div>
            <div className="card-body" style={{ padding: '25px' }}>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '13px', color: 'var(--gray-text)', marginBottom: '20px' }}>
                Personaliza la apariencia de la interfaz. Estos cambios se guardan localmente en tu navegador.
              </p>

              {/* Modo Oscuro */}
              <div className="switch-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>
                    <i className="fa-solid fa-moon" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
                    Modo Oscuro
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gray-text)' }}>
                    Interfaz de alto contraste para reducir fatiga visual.
                  </p>
                  <small style={{ fontSize: '11px', color: darkMode ? 'var(--success-color)' : 'var(--gray-text)' }}>
                    {darkMode ? 'Activado' : 'Desactivado'}
                  </small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={(e) => handleToggleDarkMode(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Sidebar Compacto */}
              <div className="switch-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>
                    <i className="fa-solid fa-outdent" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
                    Sidebar Compacto
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gray-text)' }}>
                    Minimizar el menú lateral para ganar espacio de trabajo.
                  </p>
                  <small style={{ fontSize: '11px', color: sidebarCompacto ? 'var(--success-color)' : 'var(--gray-text)' }}>
                    {sidebarCompacto ? 'Compacto' : 'Normal'}
                  </small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={sidebarCompacto}
                    onChange={(e) => handleToggleSidebar(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB SISTEMA */}
      {/* ============================================================ */}
      {tabActivo === 'sistema' && (
        <div className="settings-tab-content">
          {/* Auditoría y Logs */}
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-chart-line"></i> Auditoría y Logs</h3>
              <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
                <button className="action-btn" onClick={cargarTodo} title="Actualizar logs">
                  <i className="fa-solid fa-rotate"></i>
                </button>
                {hasPermission('conf_avanzada') && (
                  <button
                    className="action-btn"
                    style={{ color: 'var(--error-color)' }}
                    title="Limpiar logs antiguos"
                    onClick={handleClearLogs}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <table className="data-table" style={{ marginTop: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }}>Fecha</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Hora</th>
                      <th>Acción</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-text)' }}>
                          No hay registros de actividad recientes.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, i) => {
                        const fecha = new Date(log.fecha);
                        return (
                          <tr key={log.id || i}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                              {fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                              {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </td>
                            <td style={{ fontSize: '13px' }}>
                              <i className="fa-solid fa-circle-dot" style={{ color: 'var(--primary-color)', fontSize: '8px', marginRight: '6px' }}></i>
                              {log.descripcion}
                            </td>
                            <td style={{ fontSize: '13px' }}>{log.nombre_completo || log.usuario_nombre || 'Sistema'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mantenimiento del Sistema */}
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-server"></i> Mantenimiento del Sistema</h3>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '13px', color: 'var(--gray-text)', marginBottom: '15px' }}>
                Realiza operaciones de respaldo y restauración de la base de datos del sistema.
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {hasPermission('conf_avanzada') && (
                  <button className="action-btn" onClick={handleBackupBD} disabled={backupRunning}>
                    <i className={`fa-solid ${backupRunning ? 'fa-circle-notch fa-spin' : 'fa-download'}`}></i>
                    {' '}Exportar BD (.sql)
                  </button>
                )}
                {hasPermission('conf_avanzada') && (
                  <>
                    <input
                      type="file"
                      accept=".sql"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleImportBackup}
                    />
                    <button
                      className="action-btn"
                      style={{ color: 'var(--warning-color)', borderColor: 'var(--warning-color)' }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={backupImporting}
                    >
                      <i className={`fa-solid ${backupImporting ? 'fa-circle-notch fa-spin' : 'fa-upload'}`}></i>
                      {' '}Restaurar BD
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB USUARIOS */}
      {/* ============================================================ */}
      {tabActivo === 'usuarios' && (
        <div className="settings-tab-content">
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-users"></i> Gestión de Usuarios</h3>
              <button className="btn-save" onClick={() => abrirModalUsuario(null)}>
                <i className="fa-solid fa-plus"></i> Nuevo Usuario
              </button>
            </div>
            <div className="card-body" style={{ padding: '25px' }}>
              {/* Búsqueda + controles */}
              <DataTableControls
                pageSize={pageSize}
                setPageSize={setPageSize}
                searchTerm={busquedaUsuario}
                setSearchTerm={(v) => { setBusquedaUsuario(v); setPage(1); }}
                totalItems={usuarios.length}
                filteredItemsCount={usuariosFiltrados.length}
                searchPlaceholder="Buscar por nombre o usuario..."
              />

              {/* Tabla */}
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center" style={{ padding: '30px', color: 'var(--gray-text)' }}>
                          <i className="fa-solid fa-users-slash" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                          {busquedaUsuario ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios registrados.'}
                        </td>
                      </tr>
                    ) : (
                      usuariosPaginados.map(usr => (
                        <tr key={usr.id || usr.user_id}>
                          <td>{usr.id || usr.user_id}</td>
                          <td>
                            <strong>{usr.username}</strong>
                          </td>
                          <td>{usr.nombre || '—'}</td>
                          <td>
                            <span className="badge badge-role">
                              {usr.rol_nombre || usr.role_nombre || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${usr.activo == 1 || usr.activo === true ? 'active' : 'inactive'}`}>
                              {usr.activo == 1 || usr.activo === true ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
                              <div className="switch-container" title={usr.id === user?.id || usr.user_id === user?.id ? 'Tu propio usuario' : (usr.username === 'admin' || usr.username === 'ADMIN' ? 'Protegido' : (usr.activo == 1 ? 'Desactivar' : 'Activar'))}>
                                <label className="switch" style={(usr.id === user?.id || usr.user_id === user?.id) || (usr.username === 'admin' || usr.username === 'ADMIN') ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
                                  <input
                                    type="checkbox"
                                    checked={usr.activo == 1 || usr.activo === true}
                                    onChange={() => handleToggleUsuario(usr)}
                                    disabled={usr.username === 'admin' || usr.username === 'ADMIN'}
                                  />
                                  <span className="slider round"></span>
                                </label>
                              </div>
                              <button
                                className="action-btn"
                                title={usr.id === user?.id || usr.user_id === user?.id ? 'Tu propio usuario' : 'Editar Usuario'}
                                onClick={() => abrirModalUsuario(usr)}
                                disabled={(usr.id === user?.id || usr.user_id === user?.id) || (usr.username === 'admin' || usr.username === 'ADMIN')}
                                style={(usr.id === user?.id || usr.user_id === user?.id) || (usr.username === 'admin' || usr.username === 'ADMIN') ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              <button
                                className="action-btn"
                                title={usr.id === user?.id || usr.user_id === user?.id ? 'Tu propio usuario' : 'Forzar Cierre de Sesión'}
                                onClick={() => handleForceLogoutUsuario(usr)}
                                disabled={(usr.id === user?.id || usr.user_id === user?.id) || (usr.username === 'admin' || usr.username === 'ADMIN')}
                                style={(usr.id === user?.id || usr.user_id === user?.id) || (usr.username === 'admin' || usr.username === 'ADMIN') ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                              >
                                <i className="fa-solid fa-right-from-bracket"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} setPage={setPage} totalPages={totalPaginasUsuarios} totalItems={usuariosFiltrados.length} pageSize={pageSize} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB ROLES Y PERMISOS */}
      {/* ============================================================ */}
      {tabActivo === 'roles' && (
        <div className="settings-tab-content">
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-shield"></i> Roles y Permisos</h3>
              <button className="btn-save" onClick={() => abrirModalRol(null)}>
                <i className="fa-solid fa-plus"></i> Nuevo Rol
              </button>
            </div>
            <div className="card-body" style={{ padding: '15px 20px' }}>
              <DataTableControls
                pageSize={rolesPageSize}
                setPageSize={setRolesPageSize}
                searchTerm={rolesBusqueda}
                setSearchTerm={(v) => { setRolesBusqueda(v); setRolesPage(1); }}
                totalItems={roles.length}
                filteredItemsCount={rolesFiltrados.length}
                searchPlaceholder="Buscar rol..."
              />
            </div>
            <div className="card-body" style={{ padding: '0' }}>
              <div className="table-responsive">
                <table className="data-table" style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>Nombre</th>
                      <th>Descripción</th>
                      <th className="text-center">Permisos</th>
                      <th className="text-center">Usuarios</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center" style={{ padding: '30px', color: 'var(--gray-text)' }}>
                          <i className="fa-solid fa-shield-halved" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                          {rolesBusqueda ? 'No se encontraron roles con ese criterio.' : 'No hay roles registrados.'}
                        </td>
                      </tr>
                    ) : (
                      rolesPaginados.map(rol => {
                        const permisosActivos = rol.permisos
                          ? Object.values(rol.permisos).filter(Boolean).length
                          : 0;
                        const totalPermisos = PERMISOS_LISTA.length;
                        return (
                          <tr key={rol.id || rol.rol_id}>
                            <td style={{ fontWeight: 600, color: 'var(--gray-text)', fontSize: '13px' }}>
                              #{rol.id || rol.rol_id}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-shield" style={{ color: 'var(--primary-color)', fontSize: '13px' }}></i>
                                <strong style={{ fontSize: '14px' }}>{rol.nombre}</strong>
                              </div>
                            </td>
                            <td style={{ fontSize: '13px', color: 'var(--gray-text)' }}>
                              {rol.descripcion || <em>Sin descripción</em>}
                            </td>
                            <td className="text-center">
                              <span className="badge" style={{
                                background: permisosActivos > 0 ? 'rgba(74,108,247,0.15)' : 'var(--bg-secondary)',
                                color: permisosActivos > 0 ? 'var(--primary-color)' : 'var(--gray-text)',
                                padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600
                              }}>
                                {permisosActivos} / {totalPermisos}
                              </span>
                            </td>
                            <td className="text-center">
                              <span style={{ fontSize: '13px', color: 'var(--gray-text)' }}>
                                {rol.total_usuarios !== undefined ? rol.total_usuarios : '—'}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="action-buttons" style={{ justifyContent: 'center' }}>
                                <button
                                  className="action-btn"
                                  title="Editar Rol"
                                  onClick={() => abrirModalRol(rol)}
                                >
                                  <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button
                                  className="action-btn"
                                  onClick={() => handleDeleteRol(rol)}
                                  style={{ color: 'var(--error-color)' }}
                                  disabled={rol.nombre === 'Administrador' || rol.nombre === 'admin' || rol.total_usuarios > 0}
                                  title={rol.total_usuarios > 0 ? `Tiene ${rol.total_usuarios} usuario(s) asignado(s)` : 'Eliminar Rol'}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-body" style={{ padding: '10px 20px 15px' }}>
              <Pagination page={rolesPage} setPage={setRolesPage} totalPages={totalPaginasRoles} totalItems={rolesFiltrados.length} pageSize={rolesPageSize} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB SLA */}
      {/* ============================================================ */}
      {tabActivo === 'sla' && (
        <div className="settings-tab-content">
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-gauge-high"></i> Acuerdos de Nivel de Servicio (SLA)</h3>
              <button className="btn-save" onClick={() => abrirModalSLA(null)}>
                <i className="fa-solid fa-plus"></i> Nuevo SLA
              </button>
            </div>
            <div className="card-body" style={{ padding: '15px 20px' }}>
              <DataTableControls
                pageSize={slaPageSize}
                setPageSize={setSlaPageSize}
                searchTerm={slaBusqueda}
                setSearchTerm={(v) => { setSlaBusqueda(v); setSlaPage(1); }}
                totalItems={slaConfig.length}
                filteredItemsCount={slaFiltrados.length}
                searchPlaceholder="Buscar SLA..."
              />
            </div>
            <div className="card-body" style={{ padding: '0' }}>
              <div className="table-responsive">
                <table className="data-table" style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>Nombre</th>
                      <th>Prioridad</th>
                      <th className="text-center">T. Respuesta</th>
                      <th className="text-center">T. Resolución</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slaPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center" style={{ padding: '30px', color: 'var(--gray-text)' }}>
                          <i className="fa-solid fa-gauge-simple" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}></i>
                          {slaBusqueda ? 'No se encontraron SLAs con ese criterio.' : 'No hay SLAs configurados. Haz clic en "Nuevo SLA" para comenzar.'}
                        </td>
                      </tr>
                    ) : (
                      slaPaginados.map(sla => {
                        const colorClass =
                          (sla.prioridad === 'Crítica' || sla.prioridad_ticket === 'Crítica') ? 'critica' :
                          (sla.prioridad === 'Alta'    || sla.prioridad_ticket === 'Alta')    ? 'alta' :
                          (sla.prioridad === 'Media'   || sla.prioridad_ticket === 'Media')   ? 'media' : 'baja';
                        const prioridadLabel = sla.prioridad || sla.prioridad_ticket || '—';
                        const nombreLabel    = sla.nombre || prioridadLabel;
                        const activo = sla.activo !== false && sla.activo !== 0;
                        return (
                          <tr key={sla.id}>
                            <td style={{ fontWeight: 600, color: 'var(--gray-text)', fontSize: '13px' }}>
                              #{sla.id}
                            </td>
                            <td>
                              <strong style={{ fontSize: '14px' }}>{nombreLabel}</strong>
                            </td>
                            <td>
                              <span className={`priority-badge ${colorClass}`}>
                                {prioridadLabel}
                              </span>
                            </td>
                            <td className="text-center">
                              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-color)' }}>
                                {sla.respuesta}h
                              </span>
                            </td>
                            <td className="text-center">
                              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-color)' }}>
                                {sla.resolucion}h
                              </span>
                            </td>
                            <td className="text-center">
                              <span className={`status-badge ${activo ? 'active' : 'inactive'}`}>
                                {activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="action-buttons" style={{ justifyContent: 'center' }}>
                                <button
                                  className="action-btn"
                                  title="Editar SLA"
                                  onClick={() => abrirModalSLA(sla)}
                                >
                                  <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button
                                  className="action-btn"
                                  title="Eliminar SLA"
                                  onClick={() => handleDeleteSLA(sla)}
                                  style={{ color: 'var(--error-color)' }}
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-body" style={{ padding: '10px 20px 15px' }}>
              <Pagination page={slaPage} setPage={setSlaPage} totalPages={totalPaginasSLA} totalItems={slaFiltrados.length} pageSize={slaPageSize} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB PRIORIDADES (KEYWORDS) */}
      {/* ============================================================ */}
      {tabActivo === 'prioridades' && (
        <div className="settings-tab-content">
          <div className="settings-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-tag"></i> Palabras Clave para Prioridad Automática</h3>
              <div className="header-actions">
                <button className="btn-save" onClick={handleAgregarKeywordsPredefinidas} style={{ background: '#36b9cc' }}>
                  <i className="fa-solid fa-list"></i> Agregar Predefinidas
                </button>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '13px', color: 'var(--gray-text)', marginBottom: '20px' }}>
                Las palabras clave se utilizan para asignar automáticamente la prioridad a los tickets
                según el contenido de la solicitud. El sistema analiza el texto del ticket y asigna la
                prioridad más alta que coincida.
              </p>

              {/* Agregar keyword */}
              <div className="add-keyword-row" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Escribe una nueva palabra clave..."
                  value={nuevaKeyword}
                  onChange={(e) => setNuevaKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  style={{ flex: 1 }}
                />

                <select
                  className="form-control"
                  value={nuevaKeywordPrioridad}
                  onChange={(e) => setNuevaKeywordPrioridad(e.target.value)}
                  style={{ width: '160px' }}
                >
                  <option value="Crítica">Crítica</option>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>

                <button className="btn-save" onClick={handleAddKeyword}>
                  <i className="fa-solid fa-plus"></i> Agregar
                </button>
              </div>

              {/* Keywords existentes */}
              {keywords.length > 0 ? (
                (() => {
                  const keywordsPorPrioridad = {
                    'Crítica': keywords.filter(k => k.prioridad_asignada === 'Crítica'),
                    'Alta': keywords.filter(k => k.prioridad_asignada === 'Alta'),
                    'Media': keywords.filter(k => k.prioridad_asignada === 'Media'),
                    'Baja': keywords.filter(k => k.prioridad_asignada === 'Baja')
                  };

                  return (
                    <div className="grid-2" style={{ gap: '20px', marginTop: '20px' }}>
                      {Object.entries(keywordsPorPrioridad).map(([prioridad, list]) => {
                        let badgeClass = 'baja';
                        let titleColor = 'var(--text-color)';
                        let borderColor = 'var(--border-color)';
                        let icon = 'fa-info-circle';
                        
                        if (prioridad === 'Crítica') {
                          badgeClass = 'critica';
                          titleColor = '#e74a3b';
                          borderColor = 'rgba(231, 74, 59, 0.2)';
                          icon = 'fa-triangle-exclamation';
                        } else if (prioridad === 'Alta') {
                          badgeClass = 'alta';
                          titleColor = '#f6c23e';
                          borderColor = 'rgba(246, 194, 62, 0.2)';
                          icon = 'fa-circle-exclamation';
                        } else if (prioridad === 'Media') {
                          badgeClass = 'media';
                          titleColor = '#4e73df';
                          borderColor = 'rgba(78, 115, 223, 0.2)';
                          icon = 'fa-circle-dot';
                        } else if (prioridad === 'Baja') {
                          badgeClass = 'baja';
                          titleColor = 'var(--gray-text)';
                          borderColor = 'var(--border-color)';
                          icon = 'fa-tag';
                        }

                        return (
                          <div key={prioridad} className="settings-card" style={{ border: `1px solid ${borderColor}`, marginBottom: 0 }}>
                            <div className="card-header" style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ margin: 0, color: titleColor, fontSize: '14px', fontWeight: 600 }}>
                                <i className={`fa-solid ${icon}`} style={{ marginRight: '8px' }}></i>
                                Prioridad {prioridad}
                              </h4>
                              <span className="badge" style={{ fontSize: '11px', background: 'var(--input-bg)', color: 'var(--text-color)', padding: '2px 8px', borderRadius: '12px' }}>
                                {list.length} palabras
                              </span>
                            </div>
                            <div className="card-body" style={{ padding: '15px', minHeight: '80px' }}>
                              {list.length === 0 ? (
                                <p style={{ fontSize: '12px', color: 'var(--gray-text)', margin: 0, textAlign: 'center', paddingTop: '15px' }}>
                                  Sin palabras clave registradas.
                                </p>
                              ) : (
                                <div className="keywords-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {list.map(kw => (
                                    <div key={kw.id} className={`keyword-chip ${badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                                      <span className="keyword-text">{kw.palabra_clave}</span>
                                      <button
                                        className="keyword-remove"
                                        onClick={() => handleDeleteKeyword(kw)}
                                        title="Eliminar"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, fontSize: '11px', color: 'var(--gray-text)' }}
                                      >
                                        <i className="fa-solid fa-xmark"></i>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="empty-state" style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-text)' }}>
                  <i className="fa-solid fa-tags" style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }}></i>
                  <p>No hay palabras clave registradas. Agrega palabras clave o usa las predefinidas.</p>
                </div>
              )}

              {/* Palabras predefinidas no agregadas aún */}
              {keywords.length < KEYWORDS_PREDEFINIDAS.length && (
                <div style={{ marginTop: '25px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--text-color)' }}>
                    <i className="fa-solid fa-bookmark"></i> Palabras Clave Predefinidas Disponibles
                  </h4>
                  <div className="keywords-grid" style={{ opacity: 0.7 }}>
                    {KEYWORDS_PREDEFINIDAS
                      .filter(item => !keywords.some(k => (k.palabra_clave || '').toLowerCase() === item.keyword.toLowerCase()))
                      .map((item, i) => (
                        <div key={i} className="keyword-chip predefined">
                          <span className="keyword-text">{item.keyword}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL USUARIO */}
      {/* ============================================================ */}
      {showModalUsuario && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowModalUsuario(false)}>
          <div className="modal-content" style={{ width: '500px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-user" style={{ color: 'var(--primary-color)' }}></i>
                {editandoUsuario ? ' Editar Usuario' : ' Nuevo Usuario'}
              </h3>
              <button className="action-btn" onClick={() => setShowModalUsuario(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveUsuario}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Usuario *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formUsuario.username}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, username: e.target.value }))}
                    required minLength={3}
                    disabled={!!editandoUsuario}
                    placeholder="Nombre de usuario"
                  />
                </div>
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formUsuario.nombre}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña {!editandoUsuario && '*'}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={formUsuario.password}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, password: e.target.value }))}
                    required={!editandoUsuario}
                    minLength={6}
                    placeholder={editandoUsuario ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                  />
                </div>

                <div className="form-group">
                  <label>Rol</label>
                  <select
                    className="form-control"
                    value={formUsuario.role_id}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, role_id: e.target.value }))}
                  >
                    <option value="">Seleccionar Rol...</option>
                    {(rolesSimple.length > 0 ? rolesSimple : roles).map(rol => (
                      <option key={rol.id || rol.rol_id} value={rol.id || rol.rol_id}>
                        {rol.nombre || rol.nombre_rol}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Asociar Funcionario (Opcional)</label>
                  <select
                    className="form-control"
                    value={formUsuario.id_funcionario}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, id_funcionario: e.target.value }))}
                  >
                    <option value="">-- Sin asociación --</option>
                    {funcionarios.map(func => (
                      <option key={func.id} value={func.id}>
                        {func.nombre_completo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <div className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={formUsuario.activo}
                        onChange={(e) => setFormUsuario(prev => ({ ...prev, activo: e.target.checked }))}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span style={{ fontSize: '14px' }}>
                      {formUsuario.activo ? 'Usuario Activo' : 'Usuario Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="action-btn" onClick={() => setShowModalUsuario(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save">
                  <i className="fa-solid fa-floppy-disk"></i>
                  {editandoUsuario ? ' Actualizar Usuario' : ' Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL ROL */}
      {/* ============================================================ */}
      {showModalRol && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowModalRol(false)}>
          <div className="modal-content" style={{ width: '650px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-shield" style={{ color: 'var(--primary-color)' }}></i>
                {editandoRol ? ' Editar Rol' : ' Nuevo Rol'}
              </h3>
              <button className="action-btn" onClick={() => setShowModalRol(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveRol}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre del Rol *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formRol.nombre}
                    onChange={(e) => setFormRol(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                    placeholder="Ej: Técnico, Supervisor, Auditor"
                  />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    className="form-control"
                    value={formRol.descripcion}
                    onChange={(e) => setFormRol(prev => ({ ...prev, descripcion: e.target.value }))}
                    rows={2}
                    placeholder="Descripción del rol..."
                  />
                </div>

                <div className="permisos-section" style={{ marginTop: '20px' }}>
                  <div className="perm-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>
                      <i className="fa-solid fa-key"></i> Permisos del Rol
                    </h4>
                    <div className="perm-actions" style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="action-btn" onClick={() => handleToggleAllPermisos(true)}>
                        <i className="fa-solid fa-check-double"></i> Seleccionar Todos
                      </button>
                      <button type="button" className="action-btn" onClick={() => handleToggleAllPermisos(false)}>
                        <i className="fa-solid fa-xmark"></i> Deseleccionar Todos
                      </button>
                    </div>
                  </div>

                  <div className="permisos-grid">
                    {PERMISOS_LISTA.map(perm => (
                      <div key={perm.key} className="permiso-item">
                        <div className="switch-container">
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={!!permisosRol[perm.key]}
                              onChange={() => handleTogglePermiso(perm.key)}
                            />
                            <span className="slider round"></span>
                          </label>
                        </div>
                        <span className="permiso-label">{perm.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de permisos */}
                  <div className="perm-resumen" style={{
                    marginTop: '15px', padding: '10px', background: 'var(--bg-secondary)',
                    borderRadius: '8px', fontSize: '13px', color: 'var(--gray-text)'
                  }}>
                    <i className="fa-solid fa-info-circle"></i>{' '}
                    Permisos activos: {Object.values(permisosRol).filter(Boolean).length} de {PERMISOS_LISTA.length}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="action-btn" onClick={() => setShowModalRol(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save">
                  <i className="fa-solid fa-floppy-disk"></i>
                  {editandoRol ? ' Actualizar Rol' : ' Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL SLA */}
      {/* ============================================================ */}
      {showModalSLA && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowModalSLA(false)}>
          <div className="modal-content" style={{ width: '500px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-gauge-high" style={{ color: 'var(--primary-color)' }}></i>
                {editandoSLA ? ' Editar SLA' : ' Nuevo SLA'}
              </h3>
              <button className="action-btn" onClick={() => setShowModalSLA(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveSLA}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre del SLA *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formSLA.nombre}
                    onChange={(e) => setFormSLA(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                    placeholder="Ej: SLA Crítico, SLA Prioritario..."
                  />
                </div>
                <div className="form-group">
                  <label>Prioridad Asociada *</label>
                  <select
                    className="form-control"
                    value={formSLA.prioridad}
                    onChange={(e) => setFormSLA(prev => ({ ...prev, prioridad: e.target.value }))}
                  >
                    <option value="Crítica">Crítica</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
                <div className="grid-2" style={{ gap: '15px' }}>
                  <div className="form-group">
                    <label>Tiempo de Respuesta (horas) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formSLA.respuesta}
                      onChange={(e) => setFormSLA(prev => ({ ...prev, respuesta: e.target.value }))}
                      required min={1} max={168}
                      placeholder="Ej: 4"
                    />
                    <small style={{ fontSize: '11px', color: 'var(--gray-text)' }}>
                      Máx. tiempo para primera respuesta al ticket
                    </small>
                  </div>
                  <div className="form-group">
                    <label>Tiempo de Resolución (horas) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formSLA.resolucion}
                      onChange={(e) => setFormSLA(prev => ({ ...prev, resolucion: e.target.value }))}
                      required min={1} max={720}
                      placeholder="Ej: 24"
                    />
                    <small style={{ fontSize: '11px', color: 'var(--gray-text)' }}>
                      Máx. tiempo para cerrar/resolver el ticket
                    </small>
                  </div>
                </div>
                <div className="form-group">
                  <div className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={formSLA.activo}
                        onChange={(e) => setFormSLA(prev => ({ ...prev, activo: e.target.checked }))}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span style={{ fontSize: '14px' }}>
                      {formSLA.activo ? 'SLA Activo' : 'SLA Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="action-btn" onClick={() => setShowModalSLA(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save">
                  <i className="fa-solid fa-floppy-disk"></i>
                  {editandoSLA ? ' Actualizar SLA' : ' Crear SLA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
