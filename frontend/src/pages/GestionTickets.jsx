import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketAPI, notificationAPI } from '../api/client';
import { showToast, showConfirm } from '../core/toast';
import {
  FaHeadset, FaList, FaUserTag, FaEnvelopeOpen,
  FaSpinner, FaCheckCircle, FaLock, FaSlidersH, FaTimes,
  FaSave, FaPaperPlane, FaHandPointUp, FaArrowUp,
  FaStar, FaRegStar, FaComments, FaHistory,
  FaQuoteLeft, FaUserTie, FaEye, FaCloudUploadAlt,
  FaPlus, FaInfoCircle, FaTools, FaFileAlt, FaFileWord,
  FaFileExcel, FaFilePdf, FaMusic, FaDownload, FaFile,
  FaUsers, FaChartPie, FaExclamationTriangle, FaBell, FaCheck, FaFilter, FaArrowRight
} from 'react-icons/fa';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';

// ─── HELPER: CARGA Y SATISFACCIÓN DE TÉCNICOS ──────────────────────────────
function getWorkloadBadge(activos) {
  const n = parseInt(activos, 10) || 0;
  if (n === 0) return { label: 'Sin Carga', class: 'ui-pill pill-slate', color: 'var(--text-muted)' };
  if (n <= 2)  return { label: 'Baja', class: 'ui-pill pill-emerald', color: 'var(--success-color)' };
  if (n <= 5)  return { label: 'Moderada', class: 'ui-pill pill-blue', color: 'var(--primary-color)' };
  if (n <= 8)  return { label: 'Alta', class: 'ui-pill pill-amber', color: 'var(--warning-color)' };
  return { label: 'Sobrecargado', class: 'ui-pill pill-rose', color: 'var(--error-color)' };
}

function getWorkloadPercent(activos) {
  const n = parseInt(activos, 10) || 0;
  // Escala de capacidad: 10 tickets activos = 100% capacidad recomendada
  return Math.min(100, Math.round((n / 10) * 100));
}

// ─── HELPER: DATE FORMAT ────────────────────────────────────────────────────
function formatDateShort(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getStatusPillClass(estado) {
  const map = {
    Abierto: 'ui-pill pill-amber',
    'En Proceso': 'ui-pill pill-blue',
    Resuelto: 'ui-pill pill-emerald',
    Cerrado: 'ui-pill pill-slate',
  };
  return map[estado] || 'ui-pill pill-slate';
}

function getPriorityPillClass(prioridad) {
  const map = {
    Crítica: 'ui-pill pill-rose',
    Alta: 'ui-pill pill-amber',
    Media: 'ui-pill pill-blue',
    Baja: 'ui-pill pill-emerald',
  };
  return map[prioridad] || 'ui-pill pill-slate';
}

// ─── TABLE ROW COMPONENT (outside main to prevent re-mount/focus loss) ──────
function TicketTableRow({ ticket, onGestionar }) {
  const t = ticket;
  return (
    <tr>
      <td style={{ fontWeight: 700, color: 'var(--primary-color)' }}>#{t.id}</td>
      <td style={{ fontWeight: 600 }}>{t.solicitante || 'Anónimo'}</td>
      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.titulo}>{t.titulo}</td>
      <td>{t.categoria || <span style={{ color: 'var(--gray-text)' }}>—</span>}</td>
      <td>
        <span className={getPriorityPillClass(t.prioridad)}>{t.prioridad}</span>
      </td>
      <td>
        <span className={getStatusPillClass(t.estado)}>{t.estado}</span>
      </td>
      <td>
        {t.tecnico_nombre ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FaUserTie style={{ color: 'var(--primary-color)' }} /> {t.tecnico_nombre}
          </span>
        ) : (
          <span style={{ color: 'var(--gray-text)', fontStyle: 'italic' }}>Sin asignar</span>
        )}
      </td>
      <td className="text-center">
        <button
          className="btn-table"
          onClick={() => onGestionar(t.id)}
          title="Gestionar"
        >
          <FaSlidersH />
        </button>
      </td>
    </tr>
  );
}

// ─── TIMELINE ITEM (outside main component) ─────────────────────────────────
function TimelineItem({ item }) {
  const iconMap = {
    creacion: 'fa-plus-circle', asignacion: 'fa-user-tag',
    escalacion: 'fa-arrow-up', estado: 'fa-rotate',
    calificacion: 'fa-star', reapertura: 'fa-undo',
    resolucion: 'fa-check-circle'
  };
  const colorMap = {
    creacion: 'var(--primary-color)', asignacion: 'var(--success-color)',
    escalacion: 'var(--warning-color)', estado: 'var(--info-color)',
    calificacion: 'var(--warning-color)', reapertura: 'var(--error-color)',
    resolucion: 'var(--success-color)'
  };
  const icon = iconMap[item.tipo] || 'fa-circle';
  const iconColor = colorMap[item.tipo] || 'var(--gray-text)';
  return (
    <div style={{ position: 'relative', marginBottom: 20, paddingLeft: 15 }}>
      <div style={{
        position: 'absolute',
        left: '-22px',
        top: 0,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1
      }}>
        <i className={`fa-solid ${icon}`} style={{ color: '#fff', fontSize: 10 }}></i>
      </div>
      <div style={{
        background: 'var(--card-bg)',
        padding: '12px 15px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)' }}>{item.descripcion}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--gray-text)', marginTop: 5, display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>{item.nombre_completo || ''}</span>
          <span>{formatDateShort(item.fecha)}{formatTime(item.fecha) ? ' • ' + formatTime(item.fecha) : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function GestionTickets() {
  const { user, permisos, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = user?.id;
  const puedeResponder = hasPermission('tk_responder');
  const puedeReasignar = hasPermission('tk_asignar_otros');
  const puedeVerGlobal = hasPermission('tk_ver_global');
  const puedeCrear = hasPermission('tk_crear');
  const puedeVerSupervision = puedeVerGlobal || puedeReasignar;

  // ── State ────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const [mainView, setMainView] = useState('tickets'); // 'tickets' | 'tecnicos'
  const [activeTab, setActiveTab] = useState('Todos');
  const [techStats, setTechStats] = useState(null);
  const [loadingTechStats, setLoadingTechStats] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [selectedTechForAlert, setSelectedTechForAlert] = useState(null);
  const [selectedTicketForAlert, setSelectedTicketForAlert] = useState(null);
  const [alertCustomMsg, setAlertCustomMsg] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [assignedSubFilter, setAssignedSubFilter] = useState('Todos');
  const [tecnicos, setTecnicos] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Modal de gestión
  const [modalOpen, setModalOpen] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [adminTab, setAdminTab] = useState('chat');
  const [chatMessage, setChatMessage] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Form state for the management panel (controlled selects — avoids defaultValue issues)
  const [formEstado, setFormEstado] = useState('');
  const [formCategoria, setFormCategoria] = useState('');
  const [formTecnicoId, setFormTecnicoId] = useState('');

  // Modal escalar
  const [escalarModalOpen, setEscalarModalOpen] = useState(false);
  const [escalarTicketId, setEscalarTicketId] = useState(null);
  const [escalarTecnico, setEscalarTecnico] = useState('');
  const [escalarMotivo, setEscalarMotivo] = useState('');

  // Modal de resolución
  const [resolucionModalOpen, setResolucionModalOpen] = useState(false);
  const [conceptoTecnico, setConceptoTecnico] = useState('');

  // Nuevo ticket modal
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [nuevoDesc, setNuevoDesc] = useState('');
  const [nuevoFile, setNuevoFile] = useState(null);
  const [nuevoFileName, setNuevoFileName] = useState('Ningún archivo seleccionado');
  const [nuevoAutoAsignar, setNuevoAutoAsignar] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef(null);

  // Refs
  const chatHistoryRef = useRef(null);
  const chatInputRef = useRef(null);
  const timelineKnownIds = useRef(new Set());
  const timelineTicketId = useRef(null);

  // ── CARGAR ESTADÍSTICAS DE TÉCNICOS & CARGAS ─────────────────────────────
  const cargarTechStats = useCallback(async () => {
    setLoadingTechStats(true);
    try {
      const res = await ticketAPI.technicianStats();
      if (res.data?.success) {
        setTechStats(res.data.data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingTechStats(false);
    }
  }, []);

  // ── ENVIAR ALERTA OPERATIVA ──────────────────────────────────────────────
  const handleEnviarAlerta = async (e) => {
    e.preventDefault();
    if (!selectedTechForAlert) return;
    setSendingAlert(true);
    try {
      const res = await ticketAPI.sendAlert({
        tecnico_id: selectedTechForAlert.id,
        ticket_id: selectedTicketForAlert ? selectedTicketForAlert.id : null,
        mensaje: alertCustomMsg.trim()
      });
      if (res.data?.success) {
        showToast(res.data.message || 'Alerta enviada correctamente al técnico', 'success');
        setAlertModalOpen(false);
        setSelectedTechForAlert(null);
        setSelectedTicketForAlert(null);
        setAlertCustomMsg('');
        cargarTechStats();
      } else {
        showToast(res.data?.message || 'Error al enviar alerta', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error de conexión';
      showToast(msg, 'error');
    } finally {
      setSendingAlert(false);
    }
  };

  // ── CARGAR TICKETS ───────────────────────────────────────────────────────
  const cargarTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ticketAPI.allTickets();
      if (res.data?.success) {
        const d = res.data.data || {};
        setTickets(d.tickets || []);
        if (d.tecnicos) setTecnicos(d.tecnicos);
        if (d.categorias) setCategorias(d.categorias);
      } else {
        setTickets([]);
        showToast('Error de conexión', 'error');
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── CARGAR HISTORIAL CHAT ────────────────────────────────────────────────
  const cargarHistorial = useCallback(async (id) => {
    setChatLoading(true);
    try {
      const res = await ticketAPI.detail(id);
      if (res.data?.success) {
        const dataObj = res.data.data || {};
        setChatHistory(dataObj.chat || res.data.chat || []);
      } else {
        setChatHistory([]);
      }
    } catch {
      setChatHistory([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  // ── Load initial data ────────────────────────────────────────────────────
  useEffect(() => {
    // Cargar tickets si tiene permiso para ver global, responder, o asignar a otros
    if (!puedeVerGlobal && !puedeResponder && !puedeReasignar) return;
    cargarTickets();
    if (puedeVerSupervision) {
      cargarTechStats();
    }
  }, [cargarTechStats, puedeVerSupervision]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SSE bus ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!puedeVerGlobal && !puedeResponder && !puedeReasignar) return;
    const handleTicketsUpdate = () => {
      cargarTickets();
      if (puedeVerSupervision) {
        cargarTechStats();
      }
    };
    window.addEventListener('rt:tickets_update', handleTicketsUpdate);
    return () => window.removeEventListener('rt:tickets_update', handleTicketsUpdate);
  }, [puedeVerGlobal, puedeResponder, puedeReasignar, cargarTickets]);

  // Shortcut Alt+Shift+N → abrir modal de nuevo ticket
  useEffect(() => {
    const handler = () => {
      if (puedeCrear) abrirNuevoModal();
    };
    window.addEventListener('shortcut:new', handler);
    return () => window.removeEventListener('shortcut:new', handler);
  }, [puedeCrear]);

  // ── Open from URL (?ticket_id=X) ─────────────────────────────────────────
  useEffect(() => {
    const ticketIdParam = searchParams.get('ticket_id');
    if (!ticketIdParam || loading || tickets.length === 0) return;
    const id = parseInt(ticketIdParam, 10);
    if (!id) return;
    setSearchParams({}, { replace: true });
    abrirGestion(id);
  }, [tickets, loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chat SSE ─────────────────────────────────────────────────────────────
  const modalOpenRef = useRef(false);
  const currentTicketRef = useRef(null);
  useEffect(() => { modalOpenRef.current = modalOpen; }, [modalOpen]);
  useEffect(() => { currentTicketRef.current = currentTicket; }, [currentTicket]);

  useEffect(() => {
    if (!puedeVerGlobal && !puedeResponder) return;
    const handleChatUpdate = () => {
      if (modalOpenRef.current && currentTicketRef.current?.id) {
        cargarHistorial(currentTicketRef.current.id);
      }
    };
    window.addEventListener('rt:chat_update', handleChatUpdate);
    return () => window.removeEventListener('rt:chat_update', handleChatUpdate);
  }, [puedeVerGlobal, puedeResponder, cargarHistorial]);

  // ── Filter ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let result = [...tickets];
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(t =>
        (t.titulo && t.titulo.toLowerCase().includes(s)) ||
        (t.solicitante && t.solicitante.toLowerCase().includes(s)) ||
        (t.tecnico_nombre && t.tecnico_nombre.toLowerCase().includes(s)) ||
        (t.categoria && t.categoria.toLowerCase().includes(s)) ||
        (t.prioridad && t.prioridad.toLowerCase().includes(s)) ||
        t.id.toString().includes(s)
      );
    }
    if (activeTab === 'Asignados') {
      result = result.filter(t => t.tecnico_id == currentUserId);
      if (assignedSubFilter !== 'Todos') {
        result = result.filter(t => t.estado === assignedSubFilter);
      }
    } else if (activeTab !== 'Todos') {
      result = result.filter(t => t.estado === activeTab);
    }
    setFilteredTickets(result);
    setCurrentPage(1);
  }, [tickets, activeTab, searchTerm, assignedSubFilter, currentUserId]);

  // ── Auto-scroll chat ─────────────────────────────────────────────────────
  useEffect(() => {
    if (chatHistoryRef.current && (adminTab === 'chat' || chatHistory.length > 0)) {
      setTimeout(() => {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
      }, 50);
    }
  }, [chatHistory, adminTab]);

  // ── PAGINACIÓN ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // ── ABRIR GESTIÓN ───────────────────────────────────────────────────────
  const abrirGestion = async (id, skipChatRefresh = false) => {
    const t = tickets.find(x => x.id == id);
    if (!t) return;
    setCurrentTicket(t);
    // Sync controlled form fields
    setFormEstado(t.estado || 'Abierto');
    setFormCategoria(t.categoria || '');
    setFormTecnicoId(t.tecnico_id ? String(t.tecnico_id) : '');
    setModalOpen(true);

    // Marcar notificaciones como leídas
    try {
      await fetch('/api/notifications/mark-read-by-related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticket_id: id })
      });
    } catch { /* ignore */ }

    if (timelineTicketId.current !== String(id)) {
      timelineTicketId.current = String(id);
      timelineKnownIds.current.clear();
    }

    if (!skipChatRefresh) {
      await cargarHistorial(id);
      setAdminTab('chat');
    }

    await cargarTimeline(id);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setCurrentTicket(null);
    setChatHistory([]);
    setTimelineData([]);
    timelineKnownIds.current = new Set();
    timelineTicketId.current = null;
    setFormEstado('');
    setFormCategoria('');
    setFormTecnicoId('');
    setChatMessage('');
    setResolucionModalOpen(false);
    setConceptoTecnico('');
  };

  // ── CARGAR TIMELINE (inicial, al abrir modal) ───────────────────────────
  const cargarTimeline = useCallback(async (id) => {
    try {
      const res = await ticketAPI.timeline(id);
      const timelineArr = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.timeline)
          ? res.data.timeline
          : [];
      setTimelineData(timelineArr);
      timelineKnownIds.current = new Set(
        timelineArr.map(item => item.tipo + '_' + item.fecha)
      );
    } catch { /* ignore */ }
  }, []);

  // ── CARGAR TIMELINE (al cambiar de tab manualmente) ─────────────────────
  const loadAdminTimeline = useCallback(async (id) => {
    try {
      const res = await ticketAPI.timeline(id);
      const tl = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.timeline)
          ? res.data.timeline
          : [];
      setTimelineData(tl);
      timelineKnownIds.current = new Set(
        tl.map(item => item.tipo + '_' + item.fecha)
      );
    } catch {
      setTimelineData([]);
    }
  }, []);

  const switchAdminTab = (tabName) => {
    setAdminTab(tabName);
    if (tabName === 'timeline' && currentTicket) {
      loadAdminTimeline(currentTicket.id);
    }
  };

  // ── GUARDAR CAMBIOS ──────────────────────────────────────────────────────
  const handleGuardarCambios = async (e, forceConcepto = null) => {
    if (e) e.preventDefault();

    if (formEstado === 'Resuelto' && currentTicket.estado !== 'Resuelto' && forceConcepto === null) {
      setConceptoTecnico('');
      setResolucionModalOpen(true);
      return;
    }

    const jsonData = {
      ticket_id: currentTicket.id,
      estado: formEstado,
      categoria: formCategoria,
      prioridad: currentTicket.prioridad,
      tecnico_id: formTecnicoId,
    };
    if (forceConcepto !== null) {
      jsonData.concepto_tecnico = forceConcepto;
    }

    try {
      const res = await ticketAPI.update(jsonData);
      if (res.data?.success) {
        showToast('Cambios guardados exitosamente', 'success');
        cerrarModal();
        await cargarTickets();
      } else {
        showToast(res.data?.message || 'Error al guardar los cambios del ticket', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al guardar los cambios';
      showToast(errorMessage, 'error');
    }
  };

  const confirmarResolucion = () => {
    if (!conceptoTecnico || conceptoTecnico.trim().length < 5) {
      showToast('Por favor ingrese un concepto técnico detallado (mínimo 5 caracteres)', 'warning');
      return;
    }
    setResolucionModalOpen(false);
    handleGuardarCambios(null, conceptoTecnico.trim());
  };

  // ── ENVIAR CHAT ──────────────────────────────────────────────────────────
  const handleSendChat = async (e) => {
    e.preventDefault();
    const msg = chatMessage.trim();
    if (!msg || msg.length < 6) {
      showToast('El mensaje debe tener al menos 6 caracteres', 'warning');
      return;
    }
    if (!currentTicket) return;
    try {
      const res = await ticketAPI.reply({
        ticket_id: currentTicket.id,
        mensaje: msg,
        es_tecnico: 1
      });
      if (res.data?.success) {
        setChatMessage('');
        await cargarHistorial(currentTicket.id);
        if (chatInputRef.current) chatInputRef.current.focus();
      } else {
        showToast(res.data?.message || 'Error al enviar el mensaje', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al enviar el mensaje';
      showToast(errorMessage, 'error');
    }
  };

  // ── AUTO-ASIGNARME ───────────────────────────────────────────────────────
  const asignarAMi = async () => {
    if (!currentTicket || !currentUserId) return;
    const result = await showConfirm({
      title: '¿Tomar este caso?',
      text: 'Te asignarás este ticket automáticamente',
      icon: 'question',
      confirmButtonText: 'Sí, asignarme',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await ticketAPI.update({
        ticket_id: currentTicket.id,
        tecnico_id: currentUserId
      });
      if (res.data?.success) {
        await cargarTickets();
        setCurrentTicket(prev => ({ ...prev, tecnico_id: currentUserId, tecnico: user?.nombre_completo }));
        setFormTecnicoId(String(currentUserId));
        showToast('Asignado exitosamente', 'success');
      } else {
        showToast(res.data?.message || 'Error al asignarse el ticket', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al asignarse el ticket';
      showToast(errorMessage, 'error');
    }
  };

  // ── ESCALAR TICKET ───────────────────────────────────────────────────────
  const abrirModalEscalar = () => {
    if (!currentTicket) return;
    setEscalarTicketId(currentTicket.id);
    setEscalarTecnico('');
    setEscalarMotivo('');
    setEscalarModalOpen(true);
  };

  const cerrarModalEscalar = () => {
    setEscalarModalOpen(false);
    setEscalarTicketId(null);
    setEscalarTecnico('');
    setEscalarMotivo('');
  };

  const confirmarEscalar = async () => {
    if (!escalarTecnico) {
      showToast('Selecciona un técnico', 'warning');
      return;
    }
    if (escalarTecnico == currentUserId) {
      showToast('No puedes escalar a ti mismo', 'warning');
      return;
    }
    if (!escalarMotivo || escalarMotivo.trim().length < 5) {
      showToast('El motivo es obligatorio y debe tener al menos 5 caracteres', 'warning');
      return;
    }
    try {
      const res = await ticketAPI.escalate({
        ticket_id: escalarTicketId,
        tecnico_id: escalarTecnico,
        motivo: escalarMotivo.trim()
      });
      if (res.data?.success) {
        cerrarModalEscalar();
        cerrarModal();
        await cargarTickets();
        showToast('Ticket escalado exitosamente', 'success');
      } else {
        showToast(res.data?.message || 'Error al escalar el ticket', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al escalar el ticket';
      showToast(errorMessage, 'error');
    }
  };

  // ── NUEVO TICKET ─────────────────────────────────────────────────────────
  const tieneTicketAbierto = tickets.find(t => 
    t.usuario_id == currentUserId && t.estado !== 'Cerrado'
  );

  const abrirNuevoModal = () => {
    if (!puedeCrear) {
      showToast('No tienes permisos para crear tickets.', 'warning');
      return;
    }
    // Verificar si el usuario ya tiene un ticket abierto
    if (tieneTicketAbierto) {
      showToast('Ya tienes un ticket en curso. Debes cerrarlo antes de crear otro.', 'warning');
      return;
    }
    setNuevoDesc('');
    setNuevoFile(null);
    setNuevoFileName('Ningún archivo seleccionado');
    setNuevoAutoAsignar(false);
    setShowNuevoModal(true);
  };

  const handleNuevoSubmit = async (e) => {
    e.preventDefault();
    if (nuevoDesc.trim().length < 10) {
      showToast('La descripción debe tener al menos 10 caracteres', 'warning');
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('descripcion', nuevoDesc.trim());
      fd.append('auto_asignar', nuevoAutoAsignar ? '1' : '0');
      if (nuevoFile) {
        fd.append('archivo', nuevoFile);
        fd.append('adjunto', nuevoFile);
      }

      const res = await ticketAPI.create(fd);
      if (res.data?.success) {
        setShowNuevoModal(false);
        await cargarTickets();
        showToast('Ticket creado exitosamente', 'success');
      } else {
        showToast(res.data?.message || 'Error al crear el ticket', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al crear el ticket';
      showToast(errorMessage, 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── CHAT KEY DOWN ────────────────────────────────────────────────────────
  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat(e);
    }
  };

  // ── RENDER ESTRELLAS ─────────────────────────────────────────────────────
  const renderEstrellas = (calificacion) => {
    let stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        i <= calificacion
          ? <FaStar key={i} style={{ color: 'var(--warning-color)', marginRight: 2 }} />
          : <FaRegStar key={i} style={{ color: 'var(--border-color)', marginRight: 2 }} />
      );
    }
    return stars;
  };

  // ── DERIVED STATE FOR MODAL ──────────────────────────────────────────────
  const t = currentTicket;
  const esMiTicket = t?.tecnico_id && t?.tecnico_id == currentUserId;
  const puedoEscalar = esMiTicket || puedeReasignar;
  const ticketCerrado = t?.estado === 'Cerrado';

  // ── RENDER ───────────────────────────────────────────────────────────────
  if (!puedeVerGlobal && !puedeResponder && !puedeReasignar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', color: 'var(--text-color)' }}>
        <FaHeadset style={{ fontSize: '3rem', color: 'var(--primary-color)', marginBottom: 20 }} />
        <h1>Sin Acceso</h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--gray-text)', maxWidth: 500 }}>
          No tienes permisos para acceder a la Gestión de Tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="inventory-module">
      <div className="inventory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-title-row" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2><FaHeadset /> Mesa de Ayuda</h2>
          {puedeVerSupervision && (
            <div style={{ display: 'inline-flex', background: 'var(--surface-secondary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className={`segmented-tab ${mainView === 'tickets' ? 'active' : ''}`}
                onClick={() => setMainView('tickets')}
                style={{ padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}
              >
                <FaList /> Tickets
              </button>
              <button
                type="button"
                className={`segmented-tab ${mainView === 'tecnicos' ? 'active' : ''}`}
                onClick={() => { setMainView('tecnicos'); cargarTechStats(); }}
                style={{ padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}
              >
                <FaUsers /> Técnicos y Cargas
                {techStats?.resumen?.total_represados > 0 && (
                  <span className="ui-pill pill-rose" style={{ padding: '1px 6px', fontSize: '11px', fontWeight: 700, marginLeft: 6 }}>
                    {techStats.resumen.total_represados}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
        {puedeCrear && (
          <button
            className="btn btn-primary"
            onClick={abrirNuevoModal}
            style={{
              cursor: tieneTicketAbierto ? 'not-allowed' : 'pointer',
              opacity: tieneTicketAbierto ? 0.55 : 1
            }}
            title={tieneTicketAbierto ? 'Ya tienes un ticket en curso' : 'Crear Nuevo Ticket'}
          >
            <FaPlus /> Nuevo Ticket
          </button>
        )}
      </div>

      {puedeVerSupervision && mainView === 'tecnicos' && (
        <div className="technicians-management-view" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Métricas Globales de la Mesa de Ayuda */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
          }}>
            <div className="kpi-card" style={{ padding: '16px 20px', background: 'var(--surface-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Técnicos Activos
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-color)', marginTop: 4 }}>
                    {techStats?.tecnicos?.length || 0}
                  </div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <FaUsers />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Equipo de soporte registrado
              </div>
            </div>

            <div className="kpi-card" style={{ padding: '16px 20px', background: 'var(--surface-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Casos Activos
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary-color)', marginTop: 4 }}>
                    {techStats?.resumen?.total_activos || 0}
                  </div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(37,99,235,0.11)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <FaSpinner />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                {techStats?.resumen?.total_abiertos || 0} Abiertos • {techStats?.resumen?.total_en_proceso || 0} En Proceso
              </div>
            </div>

            <div className="kpi-card" style={{ padding: '16px 20px', background: 'var(--surface-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tickets Represados
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: (techStats?.resumen?.total_represados > 0 ? 'var(--error-color)' : 'var(--text-color)'), marginTop: 4 }}>
                    {techStats?.resumen?.total_represados || 0}
                  </div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.11)', color: 'var(--error-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <FaExclamationTriangle />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Vencidos por SLA o &gt;3 días sin solución
              </div>
            </div>

            <div className="kpi-card" style={{ padding: '16px 20px', background: 'var(--surface-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Satisfacción Promedio
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning-color)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {techStats?.resumen?.pct_satisfaccion_global ? `${techStats.resumen.pct_satisfaccion_global}%` : 'N/D'}
                    {techStats?.resumen?.rating_global && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        ({techStats.resumen.rating_global} ★)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.12)', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <FaStar />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Calificaciones de usuarios atendidos
              </div>
            </div>
          </div>

          {/* Tarjetas de Carga y Desempeño por Técnico */}
          <div className="settings-card" style={{ padding: 22, background: 'var(--surface-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaUserTie style={{ color: 'var(--primary-color)' }} /> Monitoreo y Carga Operativa por Técnico
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Visualiza la capacidad asignada, porcentaje de satisfacción y emite alertas directas ante represamientos.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => cargarTechStats()}
                disabled={loadingTechStats}
              >
                <FaSpinner className={loadingTechStats ? 'fa-spin' : ''} /> Actualizar Cargas
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16
            }}>
              {loadingTechStats && !techStats ? (
                <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FaSpinner className="fa-spin" style={{ fontSize: '1.8rem', color: 'var(--primary-color)', marginBottom: 12 }} />
                  <div>Cargando estadísticas de soporte técnico...</div>
                </div>
              ) : techStats?.tecnicos?.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron técnicos registrados con permisos activos.
                </div>
              ) : (
                techStats?.tecnicos?.map(tec => {
                  const badge = getWorkloadBadge(tec.activos);
                  const pct = getWorkloadPercent(tec.activos);
                  const tieneRepresados = parseInt(tec.represados, 10) > 0;

                  return (
                    <div
                      key={tec.id}
                      style={{
                        background: 'var(--surface-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14,
                        boxShadow: 'var(--shadow-xs)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease'
                      }}
                    >
                      {/* Cabecera Técnico */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: 'var(--primary-light)',
                              color: 'var(--primary-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 14
                            }}>
                              {tec.nombre_completo ? tec.nombre_completo.charAt(0).toUpperCase() : 'T'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-color)', lineHeight: 1.2 }}>
                                {tec.nombre_completo}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                @{tec.username}
                              </span>
                            </div>
                          </div>
                          <span className={badge.class} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Barra de Capacidad / Carga */}
                        <div style={{ marginTop: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 5 }}>
                            <span>Carga Actual: <strong>{tec.activos} tickets activos</strong></span>
                            <span>{pct}% capacidad</span>
                          </div>
                          <div style={{ width: '100%', height: 7, background: 'var(--border-color)', borderRadius: 999, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: pct > 80 ? 'var(--error-color)' : pct > 50 ? 'var(--warning-color)' : 'var(--primary-color)',
                                borderRadius: 999,
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </div>

                        {/* Grid de desglose */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 6,
                          background: 'var(--surface-primary)',
                          borderRadius: 10,
                          padding: '10px 8px',
                          marginTop: 14,
                          textAlign: 'center',
                          border: '1px solid var(--border-color)'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Abiertos</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)', marginTop: 2 }}>{tec.abiertos}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>En Proceso</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-color)', marginTop: 2 }}>{tec.en_proceso}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Cerrados</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success-color)', marginTop: 2 }}>{tec.cerrados}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Represados</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: tieneRepresados ? 'var(--error-color)' : 'var(--text-muted)', marginTop: 2 }}>
                              {tec.represados}
                            </div>
                          </div>
                        </div>

                        {/* Fila de Satisfacción */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Satisfacción:</span>
                          <span style={{ fontWeight: 700, color: tec.pct_satisfaccion ? 'var(--warning-color)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FaStar style={{ fontSize: 13 }} />
                            {tec.pct_satisfaccion ? `${tec.pct_satisfaccion}% (${tec.rating_promedio} ★)` : 'Sin calificaciones'}
                          </span>
                        </div>
                      </div>

                      {/* Botón de Alerta / Filtrado */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => {
                            setSearchTerm(tec.nombre_completo);
                            setActiveTab('Todos');
                            setMainView('tickets');
                          }}
                          title="Ver los tickets asignados a este técnico"
                        >
                          <FaList /> Ver Tickets
                        </button>
                        <button
                          type="button"
                          className={tieneRepresados ? "btn btn-danger btn-sm" : "btn btn-soft btn-sm"}
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => {
                            setSelectedTechForAlert(tec);
                            setSelectedTicketForAlert(null);
                            setAlertCustomMsg(`Estimado/a ${tec.nombre_completo}, se detectan tickets en estado crítico o represados en tu bandeja. Por favor priorizar su resolución.`);
                            setAlertModalOpen(true);
                          }}
                          title="Enviar notificación de alerta a este técnico"
                        >
                          <FaBell /> Alertar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Tabla de Tickets Represados y Alertas Críticas */}
          <div className="settings-card" style={{ padding: 22, background: 'var(--surface-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaExclamationTriangle style={{ color: 'var(--error-color)' }} /> Bandeja de Tickets Represados y Alertas de SLA
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Tickets con plazos de primera respuesta o resolución vencidos, o con más de 3 días sin resolver.
                </p>
              </div>
              <span className="ui-pill pill-rose" style={{ padding: '3px 10px', fontWeight: 700 }}>
                {techStats?.tickets_represados?.length || 0} Incidentes Requieren Atención
              </span>
            </div>

            {techStats?.tickets_represados?.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface-secondary)', borderRadius: 10, color: 'var(--success-color)' }}>
                <FaCheckCircle style={{ fontSize: 32, marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>¡Excelente! No hay tickets represados en este momento.</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>Todos los casos activos están dentro de los acuerdos de nivel de servicio (SLA).</div>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>Ticket</th>
                      <th>Asunto</th>
                      <th>Prioridad</th>
                      <th>Técnico Asignado</th>
                      <th>Motivo de Alerta</th>
                      <th>Fecha Creación</th>
                      <th style={{ width: '130px' }} className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techStats?.tickets_represados?.map(rep => (
                      <tr key={rep.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary-color)' }}>#{rep.id}</td>
                        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rep.titulo}>
                          {rep.titulo}
                        </td>
                        <td>
                          <span className={getPriorityPillClass(rep.prioridad)}>{rep.prioridad}</span>
                        </td>
                        <td>
                          {rep.tecnico_nombre ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                              <FaUserTie style={{ color: 'var(--primary-color)' }} /> {rep.tecnico_nombre}
                            </span>
                          ) : (
                            <span className="ui-pill pill-amber" style={{ fontSize: '11px', fontWeight: 600 }}>
                              Sin Asignar
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="ui-pill pill-rose" style={{ fontSize: '11px', fontWeight: 600 }}>
                            {rep.motivo_alerta}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {formatDateShort(rep.fecha_creacion)}
                        </td>
                        <td className="text-center">
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn-table"
                              onClick={() => {
                                abrirGestion(rep.id);
                              }}
                              title="Gestionar este ticket"
                            >
                              <FaSlidersH />
                            </button>
                            {rep.tecnico_id && (
                              <button
                                type="button"
                                className="btn-table"
                                style={{ color: 'var(--error-color)' }}
                                onClick={() => {
                                  setSelectedTechForAlert({ id: rep.tecnico_id, nombre_completo: rep.tecnico_nombre });
                                  setSelectedTicketForAlert(rep);
                                  setAlertCustomMsg(`Urgente: El ticket #${rep.id} (${rep.titulo}) se encuentra represado por: ${rep.motivo_alerta}. Por favor atender de forma prioritaria.`);
                                  setAlertModalOpen(true);
                                }}
                                title="Enviar alerta directa al técnico asignado"
                              >
                                <FaBell />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {mainView === 'tickets' && (
      <>
      <div className="inventory-tabs">
        {[
          { key: 'Todos', icon: <FaList />, label: puedeVerGlobal ? 'Todos' : 'Mis Tickets', count: tickets.length },
          ...(puedeVerGlobal ? [{ key: 'Asignados', icon: <FaUserTag />, label: 'Asignados a mí', count: tickets.filter(tk => tk.tecnico_id == currentUserId).length }] : []),
          { key: 'Abierto', icon: <FaEnvelopeOpen />, label: 'Abiertos', count: tickets.filter(tk => tk.estado === 'Abierto').length },
          { key: 'En Proceso', icon: <FaSpinner />, label: 'En Proceso', count: tickets.filter(tk => tk.estado === 'En Proceso').length },
          { key: 'Resuelto', icon: <FaCheckCircle />, label: 'Resueltos', count: tickets.filter(tk => tk.estado === 'Resuelto').length },
          { key: 'Cerrado', icon: <FaLock />, label: 'Cerrados', count: tickets.filter(tk => tk.estado === 'Cerrado').length }
        ].map(tab => (
          <button
            key={tab.key}
            className={`inv-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
            <span className="ui-pill pill-slate" style={{ marginLeft: '6px', padding: '1px 7px', fontSize: '0.7rem' }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'Asignados' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '12px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-text)', margin: 0 }}>Filtrar estado de mis tickets:</label>
          <div style={{ width: '210px' }}>
            <SearchableSelect
              value={assignedSubFilter}
              onChange={(val) => setAssignedSubFilter(val || 'Todos')}
              options={[
                { value: 'Todos', label: 'Todos' },
                { value: 'Abierto', label: 'Abierto' },
                { value: 'En Proceso', label: 'En Proceso' },
                { value: 'Resuelto', label: 'Resuelto' },
                { value: 'Cerrado', label: 'Cerrado' }
              ]}
              isClearable={false}
            />
          </div>
        </div>
      )}

      <div className="inv-tab-content">
        <div className="table-wrapper">
          <DataTableControls
            pageSize={pageSize}
            setPageSize={(v) => { setPageSize(v); setCurrentPage(1); }}
            searchTerm={searchTerm}
            setSearchTerm={(v) => { setSearchTerm(v); setCurrentPage(1); }}
            totalItems={tickets.length}
            filteredItemsCount={filteredTickets.length}
            searchPlaceholder="Buscar por ID, solicitante, técnico, asunto..."
          />
          <div className="table-scroll">
            <table className="data-table" id="ticketsTable">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>ID</th>
                  <th>Solicitante</th>
                  <th>Asunto</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Técnico</th>
                  <th style={{ width: '80px' }} className="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center p-4" style={{ color: 'var(--text-color)' }}>
                      <FaSpinner className="fa-spin" style={{ marginRight: 8, display: 'inline' }} /> Cargando...
                    </td>
                  </tr>
                ) : paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-4" style={{ color: 'var(--gray-text)' }}>No hay tickets.</td>
                  </tr>
                ) : (
                  paginatedTickets.map(ticket => (
                    <TicketTableRow
                      key={ticket.id}
                      ticket={ticket}
                      onGestionar={abrirGestion}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={currentPage}
            setPage={setCurrentPage}
            totalPages={totalPages}
            totalItems={filteredTickets.length}
            pageSize={pageSize}
          />
        </div>
      </div>
      </>
      )}

      {/* ─── MODAL DE ALERTA OPERATIVA A TÉCNICO ────────────────────────────── */}
      {alertModalOpen && selectedTechForAlert && (() => {
        // Obtener los tickets en estado de alerta pertenecientes a este técnico o activos
        const ticketsRepresadosTecnico = (techStats?.tickets_represados || []).filter(
          t => t.tecnico_id === selectedTechForAlert.id
        );
        const otrosTicketsActivosTecnico = tickets.filter(
          t => t.tecnico_id === selectedTechForAlert.id &&
               ['Abierto', 'En Proceso'].includes(t.estado) &&
               !ticketsRepresadosTecnico.some(rt => rt.id === t.id)
        );

        return (
          <div
            className="modal-overlay active"
            style={{ zIndex: 10002 }}
            onClick={(e) => { if (e.target === e.currentTarget) setAlertModalOpen(false); }}
          >
            <div className="modal-content" style={{ maxWidth: 620, width: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: 'var(--error-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    <FaBell />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-color)' }}>
                      Emitir Alerta Operativa
                    </h3>
                    <small style={{ color: 'var(--gray-text)' }}>
                      Destinatario: <strong>{selectedTechForAlert.nombre_completo}</strong>
                    </small>
                  </div>
                </div>
                <button type="button" className="btn-icon btn-ghost" onClick={() => setAlertModalOpen(false)}>
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleEnviarAlerta} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
                  {/* Selector / Listado de Tickets en Alerta */}
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span>Seleccionar Ticket en Alerta a Vincular:</span>
                      {selectedTicketForAlert && (
                        <button
                          type="button"
                          className="btn-link"
                          style={{ fontSize: '0.75rem', color: 'var(--primary-color)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                          onClick={() => {
                            setSelectedTicketForAlert(null);
                            setAlertCustomMsg(`Estimado/a ${selectedTechForAlert.nombre_completo}, se detectan tickets en estado crítico o represados en tu bandeja. Por favor priorizar su resolución.`);
                          }}
                        >
                          Desvincular ticket (Alerta general de bandeja)
                        </button>
                      )}
                    </label>

                    {ticketsRepresadosTecnico.length === 0 && otrosTicketsActivosTecnico.length === 0 ? (
                      <div style={{ background: 'var(--surface-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        Este técnico no tiene tickets con SLA vencido actualmente. Se enviará una alerta general de carga de trabajo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                        {/* Tickets con alerta crítica / represados */}
                        {ticketsRepresadosTecnico.map(tk => {
                          const isSelected = selectedTicketForAlert?.id === tk.id;
                          return (
                            <div
                              key={tk.id}
                              onClick={() => {
                                setSelectedTicketForAlert(tk);
                                setAlertCustomMsg(`Urgente: El ticket #${tk.id} (${tk.titulo}) requiere tu atención inmediata por: ${tk.motivo_alerta}.`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: isSelected ? '2px solid var(--error-color)' : '1px solid var(--border-color)',
                                background: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexGrow: 1 }}>
                                <div style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  border: isSelected ? '5px solid var(--error-color)' : '2px solid var(--border-color)',
                                  background: '#fff', flexShrink: 0
                                }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>#{tk.id}</span>
                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                      {tk.titulo}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--error-color)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FaExclamationTriangle /> {tk.motivo_alerta}
                                  </div>
                                </div>
                              </div>
                              <span className={getPriorityPillClass(tk.prioridad)} style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0 }}>
                                {tk.prioridad}
                              </span>
                            </div>
                          );
                        })}

                        {/* Otros tickets activos del técnico */}
                        {otrosTicketsActivosTecnico.map(tk => {
                          const isSelected = selectedTicketForAlert?.id === tk.id;
                          return (
                            <div
                              key={tk.id}
                              onClick={() => {
                                setSelectedTicketForAlert(tk);
                                setAlertCustomMsg(`Atención: Por favor revisar y avanzar con el ticket activo #${tk.id} (${tk.titulo}).`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                background: isSelected ? 'var(--primary-light)' : 'var(--surface-primary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexGrow: 1 }}>
                                <div style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  border: isSelected ? '5px solid var(--primary-color)' : '2px solid var(--border-color)',
                                  background: '#fff', flexShrink: 0
                                }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>#{tk.id}</span>
                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                      {tk.titulo}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    Estado: {tk.estado} • {tk.categoria || 'Sin categoría'}
                                  </div>
                                </div>
                              </div>
                              <span className={getPriorityPillClass(tk.prioridad)} style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0 }}>
                                {tk.prioridad}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedTicketForAlert && (
                    <div style={{ background: 'var(--surface-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Ticket vinculado a la alerta:</span>{' '}
                      <strong>#{selectedTicketForAlert.id} - {selectedTicketForAlert.titulo}</strong>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)', display: 'block', marginBottom: 6 }}>
                      Mensaje de la Alerta:
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={alertCustomMsg}
                      onChange={(e) => setAlertCustomMsg(e.target.value)}
                      placeholder="Escriba las instrucciones o motivo de la alerta para el técnico..."
                      required
                      style={{ resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.76rem', margin: 0 }}>
                        El técnico recibirá esta notificación con un botón de acceso directo que abrirá de inmediato la gestión del ticket seleccionado.
                      </small>
                      {alertCustomMsg.length > 0 && (
                        <span style={{ fontSize: '0.76rem', color: alertCustomMsg.trim().length >= 5 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                          {alertCustomMsg.trim().length} caracteres
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setAlertModalOpen(false)}
                    disabled={sendingAlert}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={sendingAlert}
                  >
                    {sendingAlert ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />} Enviar Alerta
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── MODAL DE GESTIÓN ───────────────────────────────────────────────── */}
      {modalOpen && t && (
        <div
          className="modal-overlay active"
          id="gestionModal"
          style={{ zIndex: 10000 }}
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="modal-content" style={{
            width: 1100, maxWidth: '96vw', height: '88vh', padding: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaTools />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Ticket #{t.id}
                    <span className={getStatusPillClass(t.estado)}>{t.estado}</span>
                  </h3>
                  <small style={{ color: 'var(--gray-text)' }}>Panel de Soporte Técnico</small>
                </div>
              </div>
              <button type="button" className="btn-icon btn-ghost" onClick={cerrarModal}><FaTimes /></button>
            </div>

            <div className="ticket-modal-split">
              {/* ─── SIDEBAR PANEL ──────────────────────────────────────────── */}
              <div className="sidebar-panel">
                <div className="info-card mb-3">
                  <label>SOLICITANTE</label>
                  <div className="user-name">{t.solicitante}</div>
                </div>

                <form id="formGestion" onSubmit={handleGuardarCambios}>
                  <div className="form-group mb-3">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>ESTADO</label>
                    <SearchableSelect
                      value={formEstado}
                      onChange={(val) => setFormEstado(val || 'Abierto')}
                      options={[
                        { value: 'Abierto', label: 'Abierto' },
                        { value: 'En Proceso', label: 'En Proceso' },
                        { value: 'Resuelto', label: 'Resuelto' },
                        ...(formEstado === 'Cerrado' ? [{ value: 'Cerrado', label: 'Cerrado (Solo usuario)' }] : [])
                      ]}
                      isClearable={false}
                      disabled={ticketCerrado}
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>CATEGORÍA</label>
                    <SearchableSelect
                      value={formCategoria}
                      onChange={(val) => setFormCategoria(val || '')}
                      options={categorias.map(cat => ({ value: cat, label: cat }))}
                      placeholder="-- Seleccionar Categoría --"
                      isClearable={true}
                      disabled={ticketCerrado}
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>PRIORIDAD (Fija)</label>
                    <div style={{ marginTop: '4px' }}>
                      <span className={getPriorityPillClass(t.prioridad)}>{t.prioridad}</span>
                    </div>
                  </div>

                  <div className="form-group mb-4">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>TÉCNICO ASIGNADO</label>
                    <SearchableSelect
                      value={formTecnicoId}
                      onChange={(val) => setFormTecnicoId(val ? String(val) : '')}
                      options={tecnicos.map(tec => ({ value: String(tec.id), label: tec.nombre_completo }))}
                      placeholder="-- Sin asignar --"
                      isClearable={puedeReasignar}
                      disabled={ticketCerrado || !puedeReasignar}
                    />

                    {!ticketCerrado && puedeResponder && (
                      <button
                        type="button"
                        className={t.tecnico_id == currentUserId ? 'btn btn-soft' : 'btn btn-primary'}
                        onClick={t.tecnico_id != currentUserId ? asignarAMi : undefined}
                        disabled={t.tecnico_id == currentUserId}
                        style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      >
                        <FaHandPointUp /> {t.tecnico_id == currentUserId ? 'Ya tienes este caso asignado' : 'Tomar este caso'}
                      </button>
                    )}

                    {(puedeReasignar || puedeResponder) && puedoEscalar && !ticketCerrado && (
                      <button
                        type="button"
                        id="btnEscalar"
                        className="btn btn-secondary"
                        onClick={abrirModalEscalar}
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          marginTop: 10,
                          borderColor: 'var(--warning-color)',
                          color: 'var(--warning-color)',
                          background: 'var(--warning-bg)',
                        }}
                      >
                        <FaArrowUp /> Escalar Ticket
                      </button>
                    )}
                  </div>

                  {!ticketCerrado && (puedeReasignar || esMiTicket || (!t.tecnico_id && puedeResponder)) && (
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      id="btnGuardarCambios"
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                    >
                      <FaSave /> Guardar Cambios
                    </button>
                  )}

                  {ticketCerrado && (
                    <div style={{ display: 'block', marginTop: 15, padding: 10, background: 'var(--error-bg)', color: 'var(--error-color)', fontSize: '0.8rem', borderRadius: 8, textAlign: 'center', fontWeight: 600 }}>
                      <FaLock style={{ marginRight: 6 }} /> TICKET CERRADO - SOLO LECTURA
                    </div>
                  )}
                </form>

                {/* Adjuntos */}
                <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 15 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EVIDENCIA ADJUNTA</label>
                  <div style={{ marginTop: 8 }}>
                    {t.archivo_adjunto ? (
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => {
                          setPreviewFile(t.archivo_adjunto);
                          setShowPreviewModal(true);
                        }}
                      >
                        <FaEye /> Ver Archivo
                      </button>
                    ) : (
                      <span style={{ color: 'var(--gray-text)', fontStyle: 'italic', fontSize: '0.85rem' }}>No hay adjuntos</span>
                    )}
                  </div>
                </div>

                {/* Calificación admin */}
                {t.estado === 'Cerrado' && t.calificacion > 0 && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', background: 'var(--warning-bg)', borderRadius: 10, padding: 14 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning-color)' }}>
                      <FaStar /> CALIFICACIÓN DEL USUARIO
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2, margin: '8px 0' }}>
                      {renderEstrellas(t.calificacion)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-color)', fontStyle: 'italic' }}>
                      {t.feedback_usuario ? `"${t.feedback_usuario}"` : ''}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── CHAT PANEL ─────────────────────────────────────────────── */}
              <div className="chat-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Descripción inicial */}
                <div className="desc-box" style={{ position: 'relative' }}>
                  <label><FaQuoteLeft /> REPORTE INICIAL</label>
                  <p style={{ marginTop: 5 }}>{t.descripcion}</p>

                  {!ticketCerrado && !t.tecnico_id && puedeResponder && (
                    <div style={{ display: 'block', marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={asignarAMi}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <FaHandPointUp /> Tomar este caso
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs: Chat / Timeline */}
                <div style={{ padding: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', marginBottom: 0 }}>
                  <button
                    type="button"
                    className={`tab-btn ${adminTab === 'chat' ? 'active' : ''}`}
                    onClick={() => switchAdminTab('chat')}
                  >
                    <FaComments style={{ marginRight: 6 }} /> CHAT
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${adminTab === 'timeline' ? 'active' : ''}`}
                    onClick={() => switchAdminTab('timeline')}
                  >
                    <FaHistory style={{ marginRight: 6 }} /> LÍNEA DE TIEMPO
                  </button>
                </div>

                {/* Chat Panel */}
                <div style={{ display: adminTab === 'chat' ? 'flex' : 'none', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                  <div
                    className="chat-history"
                    ref={chatHistoryRef}
                    style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 20px', background: 'var(--bg-color)' }}
                  >
                    {chatLoading ? (
                      <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray-text)' }}>
                        <FaSpinner className="fa-spin" /> Cargando...
                      </div>
                    ) : chatHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray-text)' }}>
                        <FaComments style={{ fontSize: '2.5rem', marginBottom: 10, color: 'var(--border-color)' }} /><br />Sin mensajes previos
                      </div>
                    ) : (
                      chatHistory.map((h, idx) => {
                        const esTecnico = h.es_tecnico == 1;
                        const align = esTecnico ? 'flex-end' : 'flex-start';
                        const bg = esTecnico ? 'var(--primary-light)' : 'var(--surface-primary)';
                        const border = esTecnico ? '1px solid rgba(37, 99, 235, 0.22)' : '1px solid var(--border-color)';
                        const autor = esTecnico ? 'Soporte TI' : h.usuario_nombre || h.nombre_completo || 'Usuario';
                        const txtColor = 'var(--text-color)';
                        return (
                          <div key={h.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: align, marginBottom: 15 }}>
                            <div style={{ background: bg, border, padding: '10px 15px', borderRadius: 14, maxWidth: '85%', fontSize: '0.9rem', boxShadow: 'var(--shadow-xs)', color: txtColor }}>
                              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: esTecnico ? 'var(--primary-color)' : 'var(--text-secondary)', marginBottom: 4 }}>{autor}</div>
                              {h.mensaje}
                            </div>
                            <small style={{ color: 'var(--gray-text)', fontSize: '0.7rem', marginTop: 3 }}>{h.fecha}</small>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {!ticketCerrado && (puedeResponder || esMiTicket) && (
                    <div className="chat-input-area" style={{ flexShrink: 0 }}>
                      <form id="formChat" onSubmit={handleSendChat} style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
                        <textarea
                          ref={chatInputRef}
                          className="input-chat"
                          rows={1}
                          placeholder="Escriba una respuesta técnica..."
                          required
                          minLength={6}
                          maxLength={2000}
                          value={chatMessage}
                          onChange={e => setChatMessage(e.target.value)}
                          onKeyDown={handleChatKeyDown}
                          style={{ flex: 1 }}
                        />
                        <button type="submit" className="btn-send-chat">
                          <FaPaperPlane />
                        </button>
                      </form>
                      {chatMessage.length > 0 && (
                        <div style={{ padding: '4px 10px 0 10px', fontSize: '0.72rem', color: chatMessage.trim().length >= 6 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600, textAlign: 'right' }}>
                          {chatMessage.trim().length} / 2000 caracteres (mín. 6)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Timeline Panel */}
                <div style={{ display: adminTab === 'timeline' ? 'flex' : 'none', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                  <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 20px 20px 30px', background: 'var(--bg-color)', borderRadius: 8 }}>
                    {timelineData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray-text)' }}>
                        <FaHistory style={{ fontSize: 30, marginBottom: 10, color: 'var(--border-color)' }} /><br />No hay actividad registrada
                      </div>
                    ) : (
                      <div className="timeline-container" style={{ position: 'relative', paddingLeft: '30px' }}>
                        {timelineData.map((item, i) => (
                          <TimelineItem key={item.tipo + '_' + item.fecha + '_' + i} item={item} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ESCALAR ──────────────────────────────────────────────────── */}
      {escalarModalOpen && (
        <div
          className="modal-overlay active"
          id="escalarModal"
          style={{ zIndex: 10001 }}
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModalEscalar(); }}
        >
          <div className="modal-content" style={{ maxWidth: 480 }}>
            {/* Header */}
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaArrowUp style={{ color: 'var(--warning-color)' }} /> Escalar Caso
              </h3>
              <button type="button" className="btn-icon btn-ghost" onClick={cerrarModalEscalar}>
                <FaTimes />
              </button>
            </div>
            {/* Body */}
            <form onSubmit={(e) => { e.preventDefault(); confirmarEscalar(); }}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 8, display: 'block', fontSize: '13.5px' }}>Escalar a <span style={{ color: 'var(--error-color)' }}>*</span></label>
                  <SearchableSelect
                    value={escalarTecnico}
                    onChange={setEscalarTecnico}
                    options={tecnicos.filter(tc => String(tc.id) !== String(currentUserId)).map(tc => ({ value: tc.id, label: tc.nombre_completo }))}
                  />
                </div>
                <div className="form-group mb-3" style={{ marginTop: 16 }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 8, display: 'block', fontSize: '13.5px' }}>Motivo <span style={{ color: 'var(--error-color)' }}>*</span></label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Ej: Requiere conocimiento especializado en redes..."
                    value={escalarMotivo}
                    onChange={e => setEscalarMotivo(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{ fontSize: '0.76rem', color: escalarMotivo.trim().length >= 5 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                      Mínimo 5 caracteres. {escalarMotivo.length > 0 && <span>{escalarMotivo.trim().length} caracteres</span>}
                    </span>
                  </div>
                </div>
              </div>
              {/* Footer */}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarModalEscalar}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--warning-color)' }}>
                  <FaArrowUp /> Confirmar Escalado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL NUEVO TICKET ─────────────────────────────────────────────── */}
      {showNuevoModal && (
        <div
          className="modal-overlay active"
          style={{ zIndex: 10001 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNuevoModal(false); }}
        >
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaHeadset style={{ color: 'var(--primary-color)' }} /> Nuevo Ticket
              </h3>
              <button type="button" className="btn-icon btn-ghost" onClick={() => setShowNuevoModal(false)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleNuevoSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 8, display: 'block' }}>
                    Descripción del problema <span style={{ color: 'var(--error-color)' }}>*</span>
                  </label>
                  <textarea
                    className="form-control"
                    value={nuevoDesc}
                    onChange={e => setNuevoDesc(e.target.value)}
                    rows={5}
                    minLength={10}
                    maxLength={5000}
                    placeholder="Describe detalladamente el inconveniente..."
                    required
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                    <small style={{ color: 'var(--gray-text)', margin: 0 }}>
                      <FaInfoCircle style={{ marginRight: 4 }} /> Mínimo 10 caracteres.
                    </small>
                    {nuevoDesc.length > 0 && (
                      <span style={{ fontSize: '0.78rem', color: nuevoDesc.trim().length >= 10 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                        {nuevoDesc.trim().length} / 5000 caracteres
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 18 }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 8, display: 'block' }}>Evidencia (Opcional)</label>
                  <div className="file-upload-container">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="file-input-hidden"
                      id="fileAdjuntoNuevo"
                      onChange={e => {
                        if (e.target.files[0]) {
                          setNuevoFile(e.target.files[0]);
                          setNuevoFileName(e.target.files[0].name);
                        }
                      }}
                    />
                    <label htmlFor="fileAdjuntoNuevo" className="file-upload-label">
                      <FaCloudUploadAlt /> Seleccionar Archivo
                    </label>
                    <span className="file-name-display">
                      {nuevoFileName}
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label className="switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        id="nuevoAutoAsignar"
                        checked={nuevoAutoAsignar}
                        onChange={e => setNuevoAutoAsignar(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                    <label htmlFor="nuevoAutoAsignar" style={{ fontWeight: 600, color: 'var(--text-color)', cursor: 'pointer', margin: 0, fontSize: '0.9rem' }}>
                      Auto-asignarme este ticket
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNuevoModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? <><FaSpinner className="fa-spin" /> Guardando...</> : 'Crear Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {resolucionModalOpen && (
        <div
          className="modal-overlay active"
          style={{ zIndex: 99999 }}
          onClick={() => setResolucionModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: 500 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header" style={{ background: 'var(--success-bg)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <FaCheckCircle style={{ color: 'var(--success-color)', fontSize: '1.1rem' }} />
                Resolución de Ticket #{currentTicket?.id}
              </h3>
              <button
                type="button"
                className="btn-icon btn-ghost"
                onClick={() => setResolucionModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            {/* Body */}
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: 'var(--gray-text)', marginBottom: '16px', lineHeight: 1.6 }}>
                Para marcar este ticket como <strong style={{ color: 'var(--success-color)' }}>Resuelto</strong>, ingrese el concepto técnico o solución aplicada.
                Esta información quedará registrada en la línea de tiempo y será exportable en los reportes.
              </p>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--gray-text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Concepto Técnico / Solución *
              </label>
              <textarea
                autoFocus
                rows="5"
                className="form-control"
                value={conceptoTecnico}
                onChange={e => setConceptoTecnico(e.target.value)}
                placeholder="Describa detalladamente la solución aplicada al problema del usuario..."
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--gray-text)', marginTop: 6, marginBottom: 0 }}>
                Mínimo 5 caracteres. {conceptoTecnico.length > 0 && <span style={{ color: conceptoTecnico.trim().length >= 5 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>{conceptoTecnico.trim().length} caracteres</span>}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResolucionModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--success-color)' }}
                onClick={confirmarResolucion}
              >
                <FaCheckCircle /> Confirmar Resolución
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── PREVIEW MODAL ────────────────────────────────────────────── */}
      {showPreviewModal && previewFile && (() => {
        const fileUrl = `/api/uploads/tickets/${previewFile}`;
        const ext = (previewFile.split('.').pop() || '').toLowerCase();
        const isImage   = /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(ext);
        const isPdf     = ext === 'pdf';
        const isText    = /^(txt|csv|json|xml|html|htm|md|log|yaml|yml|ini|cfg|sh|bat|py|js|ts|jsx|tsx|css|scss|sql)$/.test(ext);
        const isVideo   = /^(mp4|webm|ogg|mov|avi|mkv)$/.test(ext);
        const isAudio   = /^(mp3|wav|ogg|aac|flac|m4a)$/.test(ext);
        const isDoc     = /^(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/.test(ext);

        const fileIconMap = {
          docx: <FaFileWord style={{ fontSize: 48, color: 'var(--primary-color)' }} />,
          doc:  <FaFileWord style={{ fontSize: 48, color: 'var(--primary-color)' }} />,
          xlsx: <FaFileExcel style={{ fontSize: 48, color: 'var(--success-color)' }} />,
          xls:  <FaFileExcel style={{ fontSize: 48, color: 'var(--success-color)' }} />,
          pdf:  <FaFilePdf   style={{ fontSize: 48, color: 'var(--error-color)' }} />,
        };
        const FileIcon = fileIconMap[ext] || <FaFile style={{ fontSize: 48, color: 'var(--primary-color)' }} />;

        return (
          <div
            className="modal-overlay active"
            style={{ zIndex: 30000 }}
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className="modal-content"
              style={{
                width: '820px',
                maxWidth: '92vw',
                height: '88vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaEye style={{ color: 'var(--primary-color)' }} /> Vista Previa
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)', fontWeight: 400, marginLeft: 4 }}>
                    — {previewFile}
                  </span>
                </h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <a
                    href={fileUrl}
                    download
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    <FaDownload /> Descargar
                  </a>
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    onClick={() => setShowPreviewModal(false)}
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* ── Body ── */}
              <div style={{
                flexGrow: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: isImage || isVideo || isAudio ? 'center' : 'stretch',
                background: isImage ? '#0F172A' : 'var(--bg-color)',
                overflow: 'hidden',
              }}>
                {isImage && (
                  <img
                    src={fileUrl}
                    alt="Evidencia"
                    style={{
                      maxWidth: '100%', maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: 8,
                    }}
                  />
                )}

                {(isPdf || isText) && (
                  <iframe
                    src={fileUrl}
                    title="Vista previa"
                    style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                  />
                )}

                {isVideo && (
                  <video
                    src={fileUrl}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }}
                  />
                )}

                {isAudio && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
                    <FaMusic style={{ fontSize: 64, color: 'var(--primary-color)', opacity: 0.7 }} />
                    <p style={{ color: 'var(--text-color)', fontWeight: 600 }}>{previewFile}</p>
                    <audio src={fileUrl} controls style={{ width: '100%', maxWidth: 400 }} />
                  </div>
                )}

                {isDoc && (
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 20, padding: 40, textAlign: 'center',
                  }}>
                    {FileIcon}
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-color)', margin: '0 0 8px' }}>
                        {previewFile}
                      </p>
                      <p style={{ color: 'var(--gray-text)', fontSize: '0.88rem', margin: '0 0 20px' }}>
                        Este tipo de archivo no puede previsualizarse directamente en el navegador.
                      </p>
                      <a
                        href={fileUrl}
                        download
                        className="btn btn-primary"
                        style={{ textDecoration: 'none' }}
                      >
                        <FaDownload /> Descargar archivo
                      </a>
                    </div>
                  </div>
                )}

                {!isImage && !isPdf && !isText && !isVideo && !isAudio && !isDoc && (
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 16, padding: 40, textAlign: 'center',
                  }}>
                    <FaFileAlt style={{ fontSize: 56, color: 'var(--primary-color)', opacity: 0.7 }} />
                    <p style={{ fontWeight: 700, color: 'var(--text-color)', margin: 0 }}>{previewFile}</p>
                    <p style={{ color: 'var(--gray-text)', fontSize: '0.88rem', margin: 0 }}>
                      Vista previa no disponible para este tipo de archivo.
                    </p>
                    <a
                      href={fileUrl}
                      download
                      className="btn btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      <FaDownload /> Descargar
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
