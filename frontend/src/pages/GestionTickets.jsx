import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketAPI, notificationAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import {
  FaHeadset, FaSearch, FaList, FaUserTag, FaEnvelopeOpen,
  FaSpinner, FaCheckCircle, FaLock, FaSlidersH, FaTimes,
  FaSave, FaPaperPlane, FaHandPointUp, FaArrowUp,
  FaStar, FaRegStar, FaComment, FaComments, FaHistory,
  FaQuoteLeft, FaUserTie, FaEye, FaCloudUploadAlt, FaCheck,
  FaPlus, FaInfoCircle, FaTools, FaFileAlt, FaFileWord,
  FaFileExcel, FaFilePdf, FaVideo, FaMusic, FaDownload, FaFile
} from 'react-icons/fa';
import SearchableSelect from '../components/common/SearchableSelect';
import DataTableControls from '../components/common/DataTableControls';

// ─── ICON MAP ───────────────────────────────────────────────────────────────
const statusIcon = {
  Abierto: <FaEnvelopeOpen />,
  'En Proceso': <FaSpinner className="fa-spin" />,
  Resuelto: <FaCheckCircle />,
  Cerrado: <FaLock />
};

// ─── HELPER: DATE FORMAT ────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' • ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

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

function getBadgeClass(estado) {
  const map = {
    Abierto: 'badge-abierto',
    'En Proceso': 'badge-proceso',
    Resuelto: 'badge-resuelto',
    Cerrado: 'badge-cerrado',
  };
  return map[estado] || 'badge-cerrado';
}

// ─── PAGINATION COMPONENT (outside main component) ──────────────────────────
function PaginationBar({ currentPage, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const getPages = () => {
    const pages = [];
    let s = Math.max(1, currentPage - 2);
    let e = Math.min(totalPages, currentPage + 2);
    if (s > 1) { pages.push(1); if (s > 2) pages.push('...'); }
    for (let i = s; i <= e; i++) pages.push(i);
    if (e < totalPages) { if (e < totalPages - 1) pages.push('...'); pages.push(totalPages); }
    return pages;
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 2px', marginTop: 6, flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '.82rem', color: 'var(--gray-text)' }}>
        Mostrando <strong style={{ color: 'var(--text-color)' }}>{start}–{end}</strong> de <strong style={{ color: 'var(--text-color)' }}>{total}</strong>
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button className="pag-btn" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>‹</button>
        {getPages().map((p, i) =>
          p === '...' ? <span key={`d${i}`} style={{ padding: '0 4px', color: 'var(--gray-text)' }}>…</span> : (
            <button key={p} className={`pag-btn ${p === currentPage ? 'pag-active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
          )
        )}
        <button className="pag-btn" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>›</button>
      </div>
    </div>
  );
}

// ─── TABLE ROW COMPONENT (outside main to prevent re-mount/focus loss) ──────
function TicketTableRow({ ticket, onGestionar }) {
  const statusPillClass = (estado) => {
    if (estado === 'Abierto') return 'pill-Abierto';
    if (estado === 'En Proceso') return 'pill-EnProceso';
    if (estado === 'Resuelto') return 'pill-Resuelto';
    return 'pill-Cerrado';
  };

  const t = ticket;
  return (
    <tr
      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <td style={{ fontWeight: 700, color: 'var(--primary-color)', padding: '12px 15px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>#{t.id}</td>
      <td style={{ fontWeight: 600, padding: '12px 15px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-color)' }}>{t.solicitante || 'Anónimo'}</td>
      <td style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-color)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</td>
      <td style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-color)' }}>{t.categoria || <span style={{ color: '#ccc' }}>--</span>}</td>
      <td style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
        <span style={{
          color: t.prioridad === 'Crítica' ? '#dc3545' : t.prioridad === 'Alta' ? '#e67e22' : t.prioridad === 'Media' ? '#856404' : '#28a745',
          background: t.prioridad === 'Crítica' ? 'rgba(220,53,69,0.12)' : t.prioridad === 'Alta' ? 'rgba(230,126,34,0.12)' : t.prioridad === 'Media' ? 'rgba(255,193,7,0.12)' : 'rgba(40,167,69,0.12)',
          padding: '4px 10px', borderRadius: 6, fontWeight: 600, fontSize: 12
        }}>{t.prioridad}</span>
      </td>
      <td style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <span className={`status-pill ${statusPillClass(t.estado)}`}>{t.estado}</span>
      </td>
      <td style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-color)' }}>
        {t.tecnico_nombre ? (
          <><FaUserTie style={{ color: '#4e73df', marginRight: '5px' }} /> {t.tecnico_nombre}</>
        ) : (
          <span style={{ color: '#ccc', fontStyle: 'italic' }}>Sin asignar</span>
        )}
      </td>
      <td style={{ textAlign: 'center', padding: '12px 15px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className="btn-action-modern"
          onClick={() => onGestionar(t.id)}
          title="Gestionar"
          style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'rgba(78,115,223,0.1)', color: 'var(--primary-color)', cursor: 'pointer', transition: 'all .2s' }}
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
    calificacion: 'fa-star', reapertura: 'fa-undo'
  };
  const colorMap = {
    creacion: '#4a6cf7', asignacion: '#28a745',
    escalacion: '#ffc107', estado: '#17a2b8',
    calificacion: '#f6c23e', reapertura: '#e74a3b'
  };
  const icon = iconMap[item.tipo] || 'fa-circle';
  const iconColor = colorMap[item.tipo] || '#6c757d';
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

  // ── State ────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeTab, setActiveTab] = useState('Todos');
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SSE bus ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!puedeVerGlobal && !puedeResponder && !puedeReasignar) return;
    const handleTicketsUpdate = () => cargarTickets();
    window.addEventListener('rt:tickets_update', handleTicketsUpdate);
    return () => window.removeEventListener('rt:tickets_update', handleTicketsUpdate);
  }, [puedeVerGlobal, puedeResponder, puedeReasignar, cargarTickets]);

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
  };

  // ── CARGAR TIMELINE (inicial, al abrir modal) ───────────────────────────
  const cargarTimeline = useCallback(async (id) => {
    try {
      const res = await ticketAPI.timeline(id);
      // El backend devuelve json_success(array) → res.data.data = array de eventos
      const timelineArr = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.timeline)
          ? res.data.timeline
          : [];
      setTimelineData(timelineArr);
      // Registrar IDs conocidos para SSE incremental
      timelineKnownIds.current = new Set(
        timelineArr.map(item => item.tipo + '_' + item.fecha)
      );
    } catch { /* ignore */ }
  }, []);

  // ── CARGAR TIMELINE (al cambiar de tab manualmente) ─────────────────────
  const loadAdminTimeline = useCallback(async (id) => {
    try {
      const res = await ticketAPI.timeline(id);
      // El backend devuelve json_success(array) → res.data.data = array de eventos
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
  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    const jsonData = {
      ticket_id: currentTicket.id,
      estado: formEstado,
      categoria: formCategoria,
      prioridad: currentTicket.prioridad,
      tecnico_id: formTecnicoId,
    };

    try {
      const res = await ticketAPI.update(jsonData);
      if (res.data?.success) {
        await Swal.fire({ icon: 'success', title: 'Guardado', text: 'Cambios guardados exitosamente', timer: 1500, showConfirmButton: false });
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
  const asignarAMi = () => {
    if (!currentTicket || !currentUserId) return;
    Swal.fire({
      title: '¿Tomar este caso?',
      text: 'Te asignarás este ticket automáticamente',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a6cf7',
      confirmButtonText: 'Sí, asignarme',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
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
    });
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
          ? <FaStar key={i} style={{ color: '#f6c23e', marginRight: 2 }} />
          : <FaRegStar key={i} style={{ color: '#ddd', marginRight: 2 }} />
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
        <p style={{ fontSize: '1.2rem', color: 'var(--gray-text)', maxWidth: 500 }}>
          No tienes permisos para acceder a la Gestión de Tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="inventory-module">


      <div className="inventory-header">
        <div className="page-title-row">
          <h2><FaHeadset /> Mesa de Ayuda</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="search-box-modern" style={{ padding: '8px 16px', width: '260px' }}>
              <FaSearch style={{ color: 'var(--gray-text)', marginRight: '8px', fontSize: '14px' }} />
              <input
                type="text"
                placeholder="Buscar ticket..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', color: 'var(--text-color)' }}
              />
            </div>
            {puedeCrear && (
              <button
                onClick={abrirNuevoModal}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: tieneTicketAbierto ? '#888' : 'var(--primary-color)',
                  color: '#fff',
                  border: 'none', padding: '10px 20px', borderRadius: 25,
                  cursor: tieneTicketAbierto ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.9rem',
                  boxShadow: tieneTicketAbierto ? 'none' : '0 4px 10px rgba(78,115,223,0.3)',
                  transition: 'all .2s',
                  whiteSpace: 'nowrap',
                  opacity: tieneTicketAbierto ? 0.5 : 1
                }}
                title={tieneTicketAbierto ? 'Ya tienes un ticket en curso' : 'Crear Nuevo Ticket'}
              >
                <FaPlus /> Nuevo Ticket
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="inventory-tabs">
        {[
          { key: 'Todos', icon: <FaList />, label: 'Todos' },
          { key: 'Asignados', icon: <FaUserTag />, label: 'Asignados a mí' },
          { key: 'Abierto', icon: <FaEnvelopeOpen />, label: 'Abiertos' },
          { key: 'En Proceso', icon: <FaSpinner className="fa-spin" />, label: 'En Proceso' },
          { key: 'Resuelto', icon: <FaCheckCircle />, label: 'Resueltos' },
          { key: 'Cerrado', icon: <FaLock />, label: 'Cerrados' }
        ].map(tab => (
          <button
            key={tab.key}
            className={`inv-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'Asignados' && (
        <div style={{ display: 'block', padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-text)' }}>Filtrar estado de mis tickets:</label>
            <select
              className="form-control-modern"
              style={{ width: 200, padding: 6 }}
              value={assignedSubFilter}
              onChange={e => setAssignedSubFilter(e.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="Abierto">Abierto</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Resuelto">Resuelto</option>
              <option value="Cerrado">Cerrado</option>
            </select>
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
            showSearch={false}
          />
          <div className="table-scroll">
            <table className="data-table" id="ticketsTable">
              <thead>
                <tr>
                  <th width="50">ID</th>
                  <th>Solicitante</th>
                  <th>Asunto</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Técnico</th>
                  <th width="80" className="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-color)' }}>
                      <FaSpinner className="fa-spin" style={{ marginRight: 8 }} /> Cargando...
                    </td>
                  </tr>
                ) : paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-text)' }}>No hay tickets.</td>
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

          {/* Pagination */}
          {!loading && filteredTickets.length > 0 && (
            <div style={{ padding: '4px 10px' }}>
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                total={filteredTickets.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

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
            display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden',
            background: 'var(--card-bg)'
          }}>
            {/* Modal Header */}
            <div className="modal-header-custom">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(78,115,223,0.1)', color: 'var(--primary-color)', borderRadius: 8, width: 35, height: 35, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaTools />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Ticket #{t.id}</h3>
                  <small style={{ color: 'var(--gray-text)' }}>Panel de Soporte Técnico</small>
                </div>
              </div>
              <button className="action-btn" onClick={cerrarModal}><FaTimes /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', flexGrow: 1, overflow: 'hidden' }}>
              {/* ─── SIDEBAR PANEL ──────────────────────────────────────────── */}
              <div className="sidebar-panel">
                <div className="info-card mb-3">
                  <label>SOLICITANTE</label>
                  <div className="user-name">{t.solicitante}</div>
                </div>

                <form id="formGestion" onSubmit={handleGuardarCambios}>
                  <div className="form-group mb-3">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>ESTADO</label>
                    <select
                      className="form-control-modern"
                      value={formEstado}
                      onChange={e => setFormEstado(e.target.value)}
                      disabled={ticketCerrado}
                    >
                      <option value="Abierto">Abierto</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Resuelto">Resuelto</option>
                      <option value="Cerrado" disabled>Cerrado (Solo usuario)</option>
                    </select>
                  </div>

                  <div className="form-group mb-3">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>CATEGORÍA</label>
                    <select
                      className="form-control-modern"
                      value={formCategoria}
                      onChange={e => setFormCategoria(e.target.value)}
                      disabled={ticketCerrado}
                    >
                      <option value="">-- Seleccionar Categoría --</option>
                      {categorias.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group mb-3">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>PRIORIDAD (Fija)</label>
                    <input
                      type="text"
                      className="form-control-modern"
                      value={t.prioridad}
                      readOnly
                      style={{ background: 'var(--input-bg)', color: 'var(--gray-text)', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-group mb-4">
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>TÉCNICO ASIGNADO</label>
                    <select
                      className="form-control-modern"
                      value={formTecnicoId}
                      onChange={e => setFormTecnicoId(e.target.value)}
                      disabled={ticketCerrado || (!puedeReasignar && !!t.tecnico_id && !esMiTicket)}
                    >
                      <option value="">-- Sin asignar --</option>
                      {tecnicos.map(tec => (
                        <option key={tec.id} value={String(tec.id)}>{tec.nombre_completo}</option>
                      ))}
                    </select>

                    {!ticketCerrado && puedeResponder && (
                      <div 
                        className="assign-me" 
                        onClick={t.tecnico_id != currentUserId ? asignarAMi : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '10px 16px',
                          marginTop: 10,
                          marginBottom: 0,
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          cursor: t.tecnico_id == currentUserId ? 'default' : 'pointer',
                          opacity: t.tecnico_id == currentUserId ? 0.6 : 1,
                          background: t.tecnico_id == currentUserId ? 'rgba(78,115,223,0.1)' : 'linear-gradient(135deg,#4e73df,#36b9cc)',
                          color: t.tecnico_id == currentUserId ? '#4e73df' : '#fff',
                          border: t.tecnico_id == currentUserId ? '1px solid #4e73df' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        <FaHandPointUp /> {t.tecnico_id == currentUserId ? 'Ya tienes este caso asignado' : 'Tomar este caso'}
                      </div>
                    )}

                    {(puedeReasignar || puedeResponder) && puedoEscalar && !ticketCerrado && (
                      <button
                        type="button"
                        id="btnEscalar"
                        onClick={abrirModalEscalar}
                        style={{
                          display: 'flex',
                          width: '100%',
                          padding: '10px 16px',
                          border: '1px solid #f6c23e',
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          transition: 'all 0.2s',
                          background: 'rgba(246,194,62,0.1)',
                          color: '#f6c23e',
                          marginTop: 10,
                          cursor: 'pointer',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <FaArrowUp /> Escalar Ticket
                      </button>
                    )}
                  </div>

                  {!ticketCerrado && (
                    <button 
                      type="submit" 
                      className="btn-save-modern" 
                      id="btnGuardarCambios"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '10px 16px',
                        marginTop: 10,
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}
                    >
                      <FaSave /> Guardar Cambios
                    </button>
                  )}

                  {ticketCerrado && (
                    <div style={{ display: 'block', marginTop: 15, padding: 10, background: 'rgba(231,74,59,0.1)', color: '#e74a3b', fontSize: '0.8rem', borderRadius: 5, textAlign: 'center', fontWeight: 600 }}>
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
                        onClick={() => {
                          setPreviewFile(t.archivo_adjunto);
                          setShowPreviewModal(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: 'var(--text-color)',
                          padding: 0,
                        }}
                      >
                        <FaEye style={{ color: 'var(--primary-color)' }} /> Ver Archivo
                      </button>
                    ) : (
                      <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.85rem' }}>No hay adjuntos</span>
                    )}
                  </div>
                </div>

                {/* Calificación admin */}
                {t.estado === 'Cerrado' && t.calificacion > 0 && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 15, background: 'rgba(246,194,62,0.1)', borderRadius: 8, padding: 15 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f6c23e' }}>
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
                        onClick={asignarAMi}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'linear-gradient(135deg,#4e73df,#36b9cc)',
                          color: '#fff', border: 'none', padding: '9px 18px',
                          borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                          fontSize: '0.88rem', width: '100%', justifyContent: 'center'
                        }}
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
                      <div style={{ textAlign: 'center', padding: 30, color: '#aaa' }}>
                        <FaSpinner className="fa-spin" /> Cargando...
                      </div>
                    ) : chatHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 30, color: '#ccc' }}>
                        <FaComments style={{ fontSize: '2.5rem', marginBottom: 10 }} /><br />Sin mensajes previos
                      </div>
                    ) : (
                      chatHistory.map((h, idx) => {
                        const esTecnico = h.es_tecnico == 1;
                        const align = esTecnico ? 'flex-end' : 'flex-start';
                        const bg = esTecnico ? '#e3f2fd' : 'var(--card-bg)';
                        const border = esTecnico ? 'none' : '1px solid var(--border-color)';
                        const autor = esTecnico ? 'Soporte TI' : h.usuario_nombre || h.nombre_completo || 'Usuario';
                        const txtColor = esTecnico ? '#333' : 'var(--text-color)';
                        return (
                          <div key={h.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: align, marginBottom: 15 }}>
                            <div style={{ background: bg, border, padding: '10px 15px', borderRadius: 10, maxWidth: '85%', fontSize: '0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', color: txtColor }}>
                              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary-color)', marginBottom: 4 }}>{autor}</div>
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
                      <form id="formChat" onSubmit={handleSendChat} style={{ display: 'flex', gap: 10, width: '100%' }}>
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
                    </div>
                  )}
                </div>

                {/* Timeline Panel */}
                <div style={{ display: adminTab === 'timeline' ? 'flex' : 'none', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                  <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 20px 20px 30px', background: 'var(--bg-color)', borderRadius: 8 }}>
                    {timelineData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 30, color: '#ddd' }}>
                        <FaHistory style={{ fontSize: 30, marginBottom: 10 }} /><br />No hay actividad registrada
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
          <div className="modal-content" style={{ width: 480, maxWidth: '95%', padding: 0, borderRadius: 15, overflow: 'hidden', background: 'var(--card-bg)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-color)' }}>
                <FaArrowUp style={{ color: '#e74a3b', marginRight: 8 }} /> Escalar Caso
              </h3>
              <button type="button" className="action-btn" onClick={cerrarModalEscalar} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--input-bg)', color: 'var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaTimes />
              </button>
            </div>
            {/* Body */}
            <form onSubmit={(e) => { e.preventDefault(); confirmarEscalar(); }}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
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
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                    rows={3}
                    placeholder="Ej: Requiere conocimiento especializado en redes..."
                    value={escalarMotivo}
                    onChange={e => setEscalarMotivo(e.target.value)}
                  />
                </div>
              </div>
              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={cerrarModalEscalar} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', background: 'var(--input-bg)', color: 'var(--text-color)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#e74a3b,#f6c23e)', color: 'white', fontSize: '0.9rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
          <div className="modal-content" style={{ width: 500, maxWidth: '95%', padding: 0, borderRadius: 15, overflow: 'hidden', background: 'var(--card-bg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-color)' }}><FaHeadset style={{ color: 'var(--primary-color)', marginRight: 8 }} /> Nuevo Ticket</h3>
              <button className="action-btn" onClick={() => setShowNuevoModal(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--input-bg)', color: 'var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleNuevoSubmit} style={{ padding: 25 }}>
              <div className="form-group">
                <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 8, display: 'block' }}>
                  Descripción del problema <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea
                  className="form-control-modern"
                  value={nuevoDesc}
                  onChange={e => setNuevoDesc(e.target.value)}
                  rows={5}
                  minLength={10}
                  maxLength={5000}
                  placeholder="Describe detalladamente el inconveniente..."
                  required
                />
                <small style={{ color: 'var(--gray-text)', marginTop: 5, display: 'block' }}>
                  <FaInfoCircle style={{ marginRight: 4 }} /> Mínimo 10 caracteres.
                </small>
              </div>

              <div className="form-group" style={{ marginTop: 20 }}>
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

              <div className="form-group" style={{ marginTop: 20 }}>
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

              <div style={{ textAlign: 'right', marginTop: 25 }}>
                <button
                  type="button"
                  onClick={() => setShowNuevoModal(false)}
                  style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', background: 'var(--input-bg)', color: 'var(--text-color)', marginRight: 10, fontSize: '0.9rem', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    background: creating ? '#888' : 'var(--primary-color)', color: 'white',
                    padding: '10px 25px', borderRadius: 25, border: 'none',
                    cursor: creating ? 'not-allowed' : 'pointer', display: 'inline-flex',
                    alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.9rem',
                    transition: '0.2s', boxShadow: '0 4px 10px rgba(78,115,223,0.3)'
                  }}
                >
                  {creating ? <><FaSpinner className="fa-spin" /> Guardando...</> : 'Crear Solicitud'}
                </button>
              </div>
            </form>
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

        // Icon and label for non-renderable files
        const fileIconMap = {
          docx: <FaFileWord style={{ fontSize: 48, color: '#2b579a' }} />,
          doc:  <FaFileWord style={{ fontSize: 48, color: '#2b579a' }} />,
          xlsx: <FaFileExcel style={{ fontSize: 48, color: '#217346' }} />,
          xls:  <FaFileExcel style={{ fontSize: 48, color: '#217346' }} />,
          pdf:  <FaFilePdf   style={{ fontSize: 48, color: '#e74c3c' }} />,
        };
        const FileIcon = fileIconMap[ext] || <FaFile style={{ fontSize: 48, color: 'var(--primary-color)' }} />;

        return (
          <div
            className="modal-overlay active"
            style={{
              position: 'fixed',
              top: 0, left: 0,
              width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 30000,
              backdropFilter: 'blur(5px)',
            }}
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className="modal-content"
              style={{
                width: '820px',
                maxWidth: '92vw',
                height: '88vh',
                background: 'var(--card-bg)',
                borderRadius: '15px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div style={{
                padding: '15px 25px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--card-bg)',
                flexShrink: 0,
              }}>
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
                    style={{
                      padding: '7px 16px',
                      borderRadius: 20,
                      background: 'var(--primary-color)',
                      color: 'white',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FaDownload /> Descargar
                  </a>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    style={{
                      width: 32, height: 32,
                      borderRadius: 8, border: 'none',
                      cursor: 'pointer',
                      background: 'var(--input-bg)',
                      color: 'var(--text-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
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
                background: isImage ? '#111' : 'var(--bg-color)',
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
                      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
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
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          background: 'var(--primary-color)', color: '#fff',
                          padding: '10px 24px', borderRadius: 25,
                          textDecoration: 'none', fontWeight: 600,
                          fontSize: '0.9rem',
                          boxShadow: '0 4px 12px rgba(78,115,223,0.35)',
                        }}
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
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'var(--primary-color)', color: '#fff',
                        padding: '10px 24px', borderRadius: 25,
                        textDecoration: 'none', fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(78,115,223,0.35)',
                      }}
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
