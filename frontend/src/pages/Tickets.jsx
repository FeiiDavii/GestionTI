import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketAPI, notificationAPI } from '../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import { FaEye, FaStar, FaRegStar, FaPaperPlane, FaSearch, FaPlus, FaTimes, FaHeadset, FaUserTie, FaCheck, FaUndo, FaComments, FaHistory, FaPaperclip, FaFileAlt, FaCheckCircle, FaInfoCircle, FaCloudUploadAlt, FaSpinner, FaUserCheck, FaUser, FaDownload, FaFileWord, FaFileExcel, FaFilePdf, FaFile, FaMusic } from 'react-icons/fa';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  Abierto: { class: 'badge badge-abierto', label: 'Abierto' },
  'En Proceso': { class: 'badge badge-proceso', label: 'En Proceso' },
  Resuelto: { class: 'badge badge-resuelto', label: 'Resuelto' },
  Cerrado: { class: 'badge badge-cerrado', label: 'Cerrado' },
};

function getBadgeClass(estado) {
  const map = {
    Abierto: 'badge-abierto',
    'En Proceso': 'badge-proceso',
    Resuelto: 'badge-resuelto',
    Cerrado: 'badge-cerrado',
  };
  return map[estado] || 'badge-cerrado';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ─── PAGINATION COMPONENT ────────────────────────────────────────────────────

function PaginationBar({ currentPage, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  const getPages = () => {
    const pages = [];
    let s = Math.max(1, currentPage - 2);
    let e = Math.min(totalPages, currentPage + 2);
    if (s > 1) {
      pages.push(1);
      if (s > 2) pages.push('...');
    }
    for (let i = s; i <= e; i++) pages.push(i);
    if (e < totalPages) {
      if (e < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pag-bar" style={{ display: 'flex' }}>
      <span className="pag-info">
        Mostrando <strong>{start}–{end}</strong> de <strong>{total}</strong>
      </span>
      <div className="pag-buttons">
        <button
          className={`pag-btn ${currentPage === 1 ? 'disabled' : ''}`}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <FaTimes style={{ transform: 'rotate(0deg)', fontSize: '0.7rem' }} />
        </button>
        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="pag-dots">…</span>
          ) : (
            <button
              key={p}
              className={`pag-btn ${p === currentPage ? 'pag-active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className={`pag-btn ${currentPage === totalPages ? 'disabled' : ''}`}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <FaTimes style={{ transform: 'rotate(180deg)', fontSize: '0.7rem' }} />
        </button>
      </div>
    </div>
  );
}

// ─── TICKET MODULE ──────────────────────────────────────────────────────────

const STARS = [1, 2, 3, 4, 5];

export default function Tickets() {
  const { user, permisos, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isTech = !!permisos?.tk_responder;
  const canCreate = hasPermission('tk_crear');
  const canReply = hasPermission('tk_responder');
  const canClose = hasPermission('tk_close');
  const canEscalate = hasPermission('tk_escalate');
  const canViewGlobal = hasPermission('tk_ver_global');

  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTickets, setFilteredTickets] = useState([]);

  // Pagination
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDesc, setCreateDesc] = useState('');
  const [createFile, setCreateFile] = useState(null);
  const [createFileName, setCreateFileName] = useState('Ningún archivo seleccionado');
  const [autoAsignar, setAutoAsignar] = useState(false);
  const [creating, setCreating] = useState(false);
  const [canCreateTicket, setCanCreateTicket] = useState(true);
  const [blockReason, setBlockReason] = useState('');

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [chatMessage, setChatMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1=resuelto?, 2=rate, 3=reopen
  const [rating, setRating] = useState(0);
  const [rateFeedback, setRateFeedback] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [existingRating, setExistingRating] = useState(null);
  const [existingFeedback, setExistingFeedback] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Refs
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatHistoryRef = useRef(null);

  // ─── LOAD TICKETS ──────────────────────────────────────────────────────

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ticketAPI.myTickets();
      if (res.data?.success) {
        const data = res.data.data || [];
        setTickets(data);

        // Check if user can create a new ticket
        let block = false;
        let reason = '';
        for (const t of data) {
          if (t.estado !== 'Cerrado') {
            block = true;
            reason = 'Tienes un ticket en curso';
            break;
          } else if (t.estado === 'Cerrado' && (!t.calificacion || t.calificacion === 0 || t.calificacion === '0')) {
            block = true;
            reason = 'Tienes un ticket cerrado pendiente de calificación';
            break;
          }
        }
        setCanCreateTicket(!block && canCreate);
        setBlockReason(reason);
      } else {
        setTickets([]);
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Error de conexión al cargar tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // ── Escuchar eventos SSE del bus global ──────────────────────────────────
  useEffect(() => {
    const handleTicketsUpdate = () => loadTickets();
    window.addEventListener('rt:tickets_update', handleTicketsUpdate);
    return () => window.removeEventListener('rt:tickets_update', handleTicketsUpdate);
  }, [loadTickets]);

  // ── Abrir ticket desde URL (?ticket_id=X) — para links de notificaciones ──
  useEffect(() => {
    const ticketIdParam = searchParams.get('ticket_id');
    if (!ticketIdParam || loading || tickets.length === 0) return;
    const id = parseInt(ticketIdParam, 10);
    if (!id) return;
    // Limpiar el param de la URL sin recargar la página
    setSearchParams({}, { replace: true });
    // Abrir el modal del ticket
    viewTicketDetail(id);
  }, [tickets, loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh chat mientras el modal esté abierto (SSE dispara rt:chat_update)
  const viewTicketIdRef = useRef(null);
  const showViewModalRef = useRef(false);
  useEffect(() => { viewTicketIdRef.current = viewTicket?.id; }, [viewTicket]);
  useEffect(() => { showViewModalRef.current = showViewModal; }, [showViewModal]);

  const refreshChat = useCallback(async (ticketId) => {
    const id = ticketId || viewTicketIdRef.current;
    if (!id || !showViewModalRef.current) return;
    try {
      const res = await ticketAPI.detail(id);
      if (res.data?.success) {
        const dataObj = res.data.data || {};
        setChatHistory(dataObj.chat || res.data.chat || res.data.history || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const handleChatUpdate = () => refreshChat();
    window.addEventListener('rt:chat_update', handleChatUpdate);
    return () => window.removeEventListener('rt:chat_update', handleChatUpdate);
  }, [refreshChat]);

  // ─── FILTER ────────────────────────────────────────────────────────────

  useEffect(() => {
    let filtered = tickets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = tickets.filter(
        (t) =>
          String(t.id).includes(q) ||
          (t.titulo || '').toLowerCase().includes(q) ||
          (t.prioridad || '').toLowerCase().includes(q) ||
          (t.estado || '').toLowerCase().includes(q) ||
          (t.tecnico || '').toLowerCase().includes(q)
      );
    }
    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [searchQuery, tickets]);

  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));

  // ─── CREATE TICKET ────────────────────────────────────────────────────

  const openCreateModal = () => {
    if (!canCreate) {
      showToast('No tienes permisos para crear tickets.', 'warning');
      return;
    }
    if (!canCreateTicket) {
      showToast(`No puedes crear un nuevo ticket. ${blockReason}.`, 'warning');
      return;
    }
    setCreateDesc('');
    setCreateFile(null);
    setCreateFileName('Ningún archivo seleccionado');
    setAutoAsignar(false);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createDesc.trim().length < 10) {
      showToast('La descripción debe tener al menos 10 caracteres', 'warning');
      return;
    }

    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('descripcion', createDesc.trim());
      fd.append('auto_asignar', autoAsignar ? '1' : '0');
      if (createFile) {
        fd.append('archivo', createFile);
        fd.append('adjunto', createFile);
      }

      const res = await ticketAPI.create(fd);
      if (res.data?.success) {
        setShowCreateModal(false);
        await loadTickets();
        showToast(res.data.message || 'Ticket creado exitosamente', 'success');
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

  // ─── VIEW TICKET ──────────────────────────────────────────────────────

  const viewTicketDetail = useCallback(async (id) => {
    setLoadingDetail(true);
    setShowViewModal(true);
    setActiveTab('chat');
    setShowWizard(false);
    setRating(0);
    setRateFeedback('');
    setReopenReason('');
    setWizardStep(1);
    setExistingRating(null);
    setExistingFeedback('');

    try {
      const res = await ticketAPI.detail(id);
      if (res.data?.success) {
        const t = res.data.data?.ticket || res.data.ticket || {};
        setViewTicket(t);

        // Chat
        const dataObj = res.data.data || {};
        setChatHistory(dataObj.chat || res.data.chat || res.data.history || []);

        // Timeline
        setTimelineData(dataObj.timeline || res.data.timeline || []);

        // Wizard logic
        if (t.estado === 'Resuelto' || t.estado === 'Cerrado') {
          if (!t.calificacion || t.calificacion === 0 || t.calificacion === '0') {
            setShowWizard(true);
          } else {
            setShowWizard(false);
            setExistingRating(parseInt(t.calificacion));
            setExistingFeedback(t.feedback_usuario || '');
          }
        } else {
          setShowWizard(false);
        }
      } else {
        showToast(res.data?.message || 'Error al cargar el ticket', 'error');
        setShowViewModal(false);
      }
    } catch (err) {
      console.error('Error viewing ticket:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al cargar el ticket';
      showToast(errorMessage, 'error');
      setShowViewModal(false);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ─── SEND REPLY ───────────────────────────────────────────────────────

  const sendReply = async () => {
    if (!chatMessage.trim()) return;
    if (chatMessage.trim().length < 6) {
      showToast('El mensaje debe tener al menos 6 caracteres', 'warning');
      return;
    }
    setSendingReply(true);
    try {
      const res = await ticketAPI.reply({
        ticket_id: viewTicket.id,
        mensaje: chatMessage.trim(),
      });
      if (res.data?.success) {
        setChatMessage('');
        // Reload detail to get new messages
        const detailRes = await ticketAPI.detail(viewTicket.id);
        if (detailRes.data?.success) {
          setChatHistory(detailRes.data.history || []);
          setTimelineData(detailRes.data.timeline || []);
        }
        showToast(res.data.message || 'Mensaje enviado exitosamente', 'success');
      } else {
        showToast(res.data?.message || 'Error al enviar el mensaje', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al enviar el mensaje';
      showToast(errorMessage, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  // ─── WIZARD ───────────────────────────────────────────────────────────

  const wizardNext = (isSuccess) => {
    if (isSuccess) {
      setWizardStep(2); // Rate
    } else {
      setWizardStep(3); // Reopen
    }
  };

  const wizardForceRate = () => {
    setWizardStep(2);
  };

  const submitRating = async () => {
    if (rating === 0) {
      showToast('Por favor selecciona al menos una estrella', 'warning');
      return;
    }
    try {
      const res = await ticketAPI.rate({
        ticket_id: viewTicket.id,
        rating,
        feedback: rateFeedback,
      });
      if (res.data?.success) {
        showToast(res.data.message || '¡Gracias por tu calificación!', 'success');
        await viewTicketDetail(viewTicket.id);
        await loadTickets();
      } else {
        showToast(res.data?.message || 'Error al enviar la calificación', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al enviar la calificación';
      showToast(errorMessage, 'error');
    }
  };

  const submitReopen = async () => {
    if (!reopenReason.trim()) {
      showToast('Por favor selecciona al menos una estrella', 'warning');
      return;
    }
    if (reopenReason.trim().length < 10) {
      showToast('El mensaje debe tener al menos 6 caracteres', 'warning');
      return;
    }
    try {
      const res = await ticketAPI.reopen({
        ticket_id: viewTicket.id,
        motivo: reopenReason.trim(),
      });
      if (res.data?.success) {
        showToast(res.data.message || 'Ticket reabierto exitosamente', 'success');
        await viewTicketDetail(viewTicket.id);
        await loadTickets();
      } else {
        showToast(res.data?.message || 'Error al reabrir el ticket', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al reabrir el ticket';
      showToast(errorMessage, 'error');
    }
  };

  // ─── SCROLL CHAT TO BOTTOM ───────────────────────────────────────────

  useEffect(() => {
    if (chatHistoryRef.current && activeTab === 'chat') {
      setTimeout(() => {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
      }, 50);
    }
  }, [chatHistory, activeTab]);

  // ─── MARK NOTIFICATIONS AS READ ──────────────────────────────────────

  const markRead = useCallback(async (ticketId) => {
    try {
      await notificationAPI.markReadByRelated({ ticket_id: ticketId });
    } catch { /* silent */ }
  }, []);

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <>


      <div className="ticket-container" style={{
        background: 'var(--card-bg)',
        borderRadius: '15px',
        boxShadow: '0 5px 20px var(--shadow-color)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
      }}>
        {/* Module Header */}
        <div className="module-header" style={{
          padding: '25px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          flexWrap: 'wrap',
          gap: '15px',
        }}>
          <div className="module-title">
            <h3 style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: '1.2rem' }}>
              <FaHeadset style={{ marginRight: '8px' }} /> Mesa de Servicios
            </h3>
            <p style={{ margin: '5px 0 0', color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              Historial y seguimiento de solicitudes
            </p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box-modern" style={{
              background: 'var(--input-bg)',
              borderRadius: '25px',
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              width: '280px',
              border: '1px solid var(--border-color)',
              transition: '0.3s',
            }}>
              <FaSearch style={{ color: 'var(--gray-text)' }} />
              <input
                type="text"
                placeholder="Buscar ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  marginLeft: '10px',
                  color: 'var(--text-color)',
                }}
              />
            </div>
            {canCreate && (
              <button
                className="btn-main"
                onClick={openCreateModal}
                style={{
                  background: canCreateTicket ? 'var(--primary-color)' : '#888',
                  color: 'white',
                  padding: '10px 25px',
                  borderRadius: '25px',
                  border: 'none',
                  cursor: canCreateTicket ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: '0.2s',
                  boxShadow: '0 4px 10px rgba(78, 115, 223, 0.3)',
                  opacity: canCreateTicket ? 1 : 0.5,
                }}
                title={!canCreateTicket ? `Bloqueado: ${blockReason}` : 'Crear Nuevo Ticket'}
              >
                <FaPlus /> Nuevo Ticket
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive" style={{ padding: 0 }}>
          <table className="data-table" style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}>
            <thead>
              <tr>
                {/* ID — 5% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'left', width: '5%',
                }}>ID</th>
                {/* Asunto — 32% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'left', width: '32%',
                }}>Asunto</th>
                {/* Prioridad — 10% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'left', width: '10%',
                }}>Prioridad</th>
                {/* Estado — 11% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'left', width: '11%',
                }}>Estado</th>
                {/* Técnico — 22% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'left', width: '22%',
                }}>Técnico</th>
                {/* Fecha — 14% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'left', width: '14%',
                }}>Fecha</th>
                {/* Ver — 6% */}
                <th style={{
                  background: 'var(--input-bg)', color: 'var(--gray-text)', fontWeight: 700,
                  textTransform: 'uppercase', fontSize: '0.75rem', padding: '12px 16px',
                  borderBottom: '2px solid var(--border-color)', textAlign: 'center', width: '6%',
                }}>Ver</th>
              </tr>
            </thead>
            <tbody id="ticketsTableBody">
              {/* Loading state */}
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-color)' }}>
                    <FaSpinner className="fa-spin" style={{ marginRight: '8px' }} /> Cargando...
                  </td>
                </tr>
              )}

              {/* Error state */}
              {!loading && error && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#e74a3b' }}>
                    <FaTimes style={{ marginRight: '8px' }} /> {error}
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!loading && !error && filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-text)' }}>
                    <FaFileAlt style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.4 }} />
                    <br />
                    {searchQuery ? 'Sin resultados para tu búsqueda.' : 'No tienes tickets registrados.'}
                  </td>
                </tr>
              )}

              {/* Tickets */}
              {!loading && !error && paginatedTickets.map((t) => {
                const badgeClass = getBadgeClass(t.estado);
                const priorityStyle =
                  t.prioridad === 'Crítica' ? { color: '#e74a3b', fontWeight: 'bold' } :
                  t.prioridad === 'Alta' ? { color: '#f6c23e', fontWeight: 'bold' } : {};
                const hasPendingRating =
                  t.estado === 'Cerrado' && (!t.calificacion || t.calificacion === 0 || t.calificacion === '0');

                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = ''}
                  >
                    {/* ID */}
                    <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.9rem' }}>
                      #{t.id}
                    </td>
                    {/* Asunto — truncado con tooltip */}
                    <td style={{
                      padding: '13px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      fontWeight: 500,
                      color: 'var(--text-color)',
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={t.titulo}>
                      {t.titulo}
                    </td>
                    {/* Prioridad */}
                    <td style={{
                      padding: '13px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      ...priorityStyle
                    }}>
                      {t.prioridad}
                    </td>
                    {/* Estado */}
                    <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <span className={`status-badge ${badgeClass}`}>{t.estado}</span>
                    </td>
                    {/* Técnico — truncado con tooltip */}
                    <td style={{
                      padding: '13px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.9rem',
                      color: 'var(--text-color)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={t.tecnico_nombre || 'Pendiente'}>
                      {t.tecnico_nombre ? (
                        <><FaUserTie style={{ color: '#4e73df', marginRight: '5px', flexShrink: 0 }} />{t.tecnico_nombre}</>
                      ) : (
                        <span style={{ color: '#ccc', fontStyle: 'italic' }}>Pendiente</span>
                      )}
                    </td>
                    {/* Fecha */}
                    <td style={{
                      padding: '13px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                      color: 'var(--gray-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDate(t.fecha_creacion)}
                    </td>
                    {/* Ver */}
                    <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <button
                        className="btn-icon-action"
                        style={{
                          width: '35px',
                          height: '35px',
                          borderRadius: '50%',
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--gray-text)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: '0.2s',
                          position: 'relative',
                        }}
                        onClick={() => viewTicketDetail(t.id)}
                        title="Ver ticket"
                      >
                        <FaEye />
                        {hasPendingRating && (
                          <FaStar style={{ color: '#f6c23e', fontSize: '0.6rem', position: 'absolute', top: '-2px', right: '-2px' }} />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {!loading && !error && filteredTickets.length > 0 && (
            <div style={{ padding: '10px 25px' }}>
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                total={filteredTickets.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── CREATE MODAL ─────────────────────────────────────────────── */}

      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.7)',
          display: showCreateModal ? 'flex' : 'none',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(3px)',
        }}
        onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
      >
        <div className="modal-content" style={{
          width: '500px',
          borderRadius: '15px',
          overflow: 'hidden',
          background: 'var(--card-bg)',
          padding: 0,
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-color)' }}>Nuevo Ticket</h3>
            <button
              className="action-btn"
              onClick={() => setShowCreateModal(false)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--input-bg)',
                color: 'var(--text-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FaTimes />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} style={{ padding: '25px' }}>
            <div className="form-group">
              <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px', display: 'block' }}>
                Descripción del problema <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                className="form-control"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={5}
                minLength={10}
                maxLength={5000}
                placeholder="Por favor, describe detalladamente el inconveniente..."
                style={{
                  borderRadius: '10px',
                  resize: 'vertical',
                  padding: '12px',
                  width: '100%',
                  boxSizing: 'border-box',
                  overflowWrap: 'break-word',
                  wordWrap: 'break-word',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                }}
                required
              />
              <small style={{ color: 'var(--gray-text)', marginTop: '5px', display: 'block' }}>
                <FaInfoCircle style={{ marginRight: '4px' }} /> Mínimo 10 caracteres. La prioridad será asignada automáticamente.
              </small>
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px', display: 'block' }}>
                Evidencia (Opcional)
              </label>
              <div className="file-upload-container">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="file-input-hidden"
                  id="fileAdjunto"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setCreateFile(e.target.files[0]);
                      setCreateFileName(e.target.files[0].name);
                    }
                  }}
                />
                <label htmlFor="fileAdjunto" className="file-upload-label">
                  <FaCloudUploadAlt /> Seleccionar Archivo
                </label>
                <span className="file-name-display">
                  {createFileName}
                </span>
              </div>
            </div>

            {canReply && (
              <div className="form-group" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label className="switch" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      id="autoAsignar"
                      checked={autoAsignar}
                      onChange={(e) => setAutoAsignar(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                  <label htmlFor="autoAsignar" style={{ fontWeight: 600, color: 'var(--text-color)', cursor: 'pointer', margin: 0, fontSize: '0.9rem' }}>
                    Auto-asignarme este ticket
                  </label>
                </div>
                <small style={{ color: 'var(--gray-text)', marginTop: '5px', display: 'block' }}>
                  <FaInfoCircle style={{ marginRight: '4px' }} /> Si activas esta opción, el ticket será asignado automáticamente a ti.
                </small>
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: '25px' }}>
              <button
                type="button"
                className="action-btn"
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: 'var(--input-bg)',
                  color: 'var(--text-color)',
                  marginRight: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-main"
                disabled={creating}
                style={{
                  background: creating ? '#888' : 'var(--primary-color)',
                  color: 'white',
                  padding: '10px 25px',
                  borderRadius: '25px',
                  border: 'none',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: '0.2s',
                  boxShadow: '0 4px 10px rgba(78, 115, 223, 0.3)',
                }}
              >
                {creating ? <><FaSpinner className="fa-spin" /> Guardando...</> : 'Crear Solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ─── VIEW MODAL ───────────────────────────────────────────────── */}

      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.7)',
          display: showViewModal ? 'flex' : 'none',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(3px)',
        }}
        onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}
      >
        <div className="modal-content" style={{
          width: '960px',
          maxWidth: '96vw',
          height: '88vh',
          borderRadius: '15px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card-bg)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-color)', fontWeight: 700 }}>
                Ticket #{viewTicket?.id || '...'}
              </h3>
              <small style={{ color: 'var(--gray-text)' }}>Detalles y seguimiento</small>
            </div>
            <button
              className="action-btn"
              onClick={() => setShowViewModal(false)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--input-bg)',
                color: 'var(--text-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FaTimes />
            </button>
          </div>

          {/* Loading detail */}
          {loadingDetail && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaSpinner className="fa-spin" style={{ fontSize: '2rem', color: 'var(--primary-color)' }} />
            </div>
          )}

          {!loadingDetail && viewTicket && (
            <>
              {/* Wizard */}
              {showWizard && (
                <div style={{
                  display: 'block',
                  padding: '30px',
                  textAlign: 'center',
                  flexShrink: 0,
                  borderBottom: '1px solid var(--border-color)',
                  background: 'var(--input-bg)',
                }}>
                  {/* Step 1: Was it resolved? */}
                  {wizardStep === 1 && (
                    <div className="wizard-step active">
                      <FaCheckCircle style={{ fontSize: '48px', color: '#28a745', marginBottom: '15px' }} />
                      <h4 style={{ marginBottom: '10px', color: 'var(--text-color)' }}>¿Tu problema fue resuelto?</h4>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
                        <button
                          className="wizard-btn btn-yes-opt"
                          style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid #1cc88a',
                            background: 'transparent',
                            color: '#1cc88a',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: '0.2s',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                          }}
                          onClick={() => wizardNext(true)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#1cc88a'; e.currentTarget.style.color = 'white'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1cc88a'; }}
                        >
                          <FaCheck style={{ marginRight: '6px' }} /> Sí, resuelto
                        </button>
                        <button
                          className="wizard-btn btn-no-opt"
                          style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid #e74a3b',
                            background: 'transparent',
                            color: '#e74a3b',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: '0.2s',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                          }}
                          onClick={() => wizardNext(false)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#e74a3b'; e.currentTarget.style.color = 'white'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e74a3b'; }}
                        >
                          <FaUndo style={{ marginRight: '6px' }} /> No, reabrir
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Rate */}
                  {wizardStep === 2 && (
                    <div className="wizard-step active">
                      <h4 style={{ marginBottom: '15px', color: 'var(--text-color)' }}>Califica el servicio</h4>
                      <div className="stars-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '15px 0' }}>
                        {STARS.map((star) => (
                          <span
                            key={star}
                            onClick={() => setRating(star)}
                            style={{ cursor: 'pointer', display: 'inline-flex' }}
                          >
                            {star <= rating ? (
                              <FaStar style={{ fontSize: '2rem', color: '#f6c23e', transition: '0.2s' }} />
                            ) : (
                              <FaRegStar style={{ fontSize: '2rem', color: '#ddd', transition: '0.2s' }} />
                            )}
                          </span>
                        ))}
                      </div>
                      <textarea
                        className="form-control"
                        value={rateFeedback}
                        onChange={(e) => setRateFeedback(e.target.value)}
                        rows={2}
                        placeholder="Comentarios adicionales (opcional)"
                        style={{
                          margin: '10px auto',
                          width: '80%',
                          borderRadius: '8px',
                          padding: '12px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--card-bg)',
                          color: 'var(--text-color)',
                          display: 'block',
                          resize: 'vertical',
                        }}
                      />
                      <button
                        className="btn-main"
                        onClick={submitRating}
                        style={{
                          background: 'var(--primary-color)',
                          color: 'white',
                          padding: '10px 25px',
                          borderRadius: '25px',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          marginTop: '10px',
                          transition: '0.2s',
                          boxShadow: '0 4px 10px rgba(78, 115, 223, 0.3)',
                        }}
                      >
                        Enviar Calificación
                      </button>
                    </div>
                  )}

                  {/* Step 3: Reopen */}
                  {wizardStep === 3 && (
                    <div className="wizard-step active">
                      <FaUndo style={{ fontSize: '48px', color: '#e74a3b', marginBottom: '15px' }} />
                      <h4 style={{ marginBottom: '10px', color: 'var(--text-color)' }}>Reabrir Ticket</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-color)' }}>
                        Por favor indíquenos por qué desea reabrir el caso:
                      </p>
                      <textarea
                        className="form-control"
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        rows={2}
                        placeholder="Mínimo 10 caracteres..."
                        style={{
                          margin: '10px auto',
                          width: '80%',
                          borderRadius: '8px',
                          padding: '12px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--card-bg)',
                          color: 'var(--text-color)',
                          display: 'block',
                          resize: 'vertical',
                        }}
                      />
                      <div style={{ marginTop: '15px' }}>
                        <button
                          className="btn-main"
                          onClick={submitReopen}
                          style={{
                            background: '#e74a3b',
                            color: 'white',
                            padding: '10px 25px',
                            borderRadius: '25px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            transition: '0.2s',
                            boxShadow: '0 4px 10px rgba(231, 74, 59, 0.3)',
                          }}
                        >
                          <FaUndo /> Reabrir Caso
                        </button>
                        <button
                          className="wizard-btn"
                          onClick={wizardForceRate}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)',
                            cursor: 'pointer',
                            marginLeft: '10px',
                            fontWeight: 600,
                            color: 'var(--text-color)',
                            transition: '0.2s',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                          }}
                        >
                          Calificar de todas formas
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Existing rating display */}
              {existingRating && !showWizard && (
                <div style={{
                  padding: '20px 30px',
                  textAlign: 'center',
                  flexShrink: 0,
                  borderBottom: '1px solid var(--border-color)',
                  background: 'rgba(40, 167, 69, 0.05)',
                }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-color)', fontSize: '0.9rem' }}>
                    <FaCheck style={{ color: '#28a745', marginRight: '6px' }} />
                    Ya has calificado este servicio
                  </p>
                  <div id="staticStars" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>
                    {STARS.map((s) => (
                      <span key={s} style={{ display: 'inline-flex' }}>
                        {s <= existingRating ? (
                          <FaStar style={{ color: '#f6c23e', fontSize: '1.3rem' }} />
                        ) : (
                          <FaRegStar style={{ color: '#ddd', fontSize: '1.3rem' }} />
                        )}
                      </span>
                    ))}
                  </div>
                  {existingFeedback && (
                    <p id="staticFeedback" style={{
                      fontSize: '0.85rem',
                      color: 'var(--gray-text)',
                      fontStyle: 'italic',
                      margin: 0,
                    }}>
                      &ldquo;{existingFeedback}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Body: 2 columns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '240px minmax(0, 1fr)',
                flexGrow: 1,
                overflow: 'hidden',
                minHeight: 0,
              }}>
                {/* LEFT PANEL: info */}
                <div style={{
                  background: 'var(--input-bg)',
                  padding: '20px',
                  borderRight: '1px solid var(--border-color)',
                  overflowY: 'auto',
                  height: '100%',
                  boxSizing: 'border-box',
                }}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                      Estado
                    </label>
                    <div id="viewStatus" style={{ marginTop: '4px' }}>
                      <span className={`status-badge ${getBadgeClass(viewTicket.estado)}`}>
                        {viewTicket.estado}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                        Prioridad
                      </label>
                      <div id="viewPriority" style={{
                        fontWeight: 700,
                        color: (viewTicket.prioridad === 'Crítica' || viewTicket.prioridad === 'Alta') ? '#e74a3b' : 'var(--text-color)',
                        marginTop: '4px',
                        fontSize: '0.9rem',
                      }}>
                        {viewTicket.prioridad}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                        Técnico
                      </label>
                      <div id="viewTech" style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: '4px' }}>
                        {viewTicket.tecnico_nombre ? (
                          <><FaUserCheck style={{ color: 'var(--gray-text)', marginRight: '4px' }} /> {viewTicket.tecnico_nombre}</>
                        ) : (
                          <span style={{ color: '#ccc' }}>Sin asignar</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                      Descripción
                    </label>
                    <p id="viewDesc" style={{
                      fontSize: '0.88rem',
                      color: 'var(--text-color)',
                      background: 'var(--card-bg)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      marginTop: '5px',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: '1.5',
                    }}>
                      {viewTicket.descripcion}
                    </p>
                  </div>

                  {/* File attachment */}
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                      Archivo Adjunto
                    </label>
                    <div id="viewFile" style={{ marginTop: '5px' }}>
                      {viewTicket.archivo_adjunto ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewFile(viewTicket.archivo_adjunto);
                            setShowPreviewModal(true);
                          }}
                          style={{
                            color: 'var(--primary-color)',
                            textDecoration: 'none',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <FaPaperclip style={{ marginRight: '4px' }} /> Ver Archivo Adjunto
                        </button>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Ninguno</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* CENTER PANEL: chat / timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  {/* Tabs */}
                  <div style={{
                    padding: 0,
                    background: 'var(--card-bg)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                  }}>
                    <button
                      className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                      onClick={() => setActiveTab('chat')}
                    >
                      <FaComments style={{ marginRight: '6px' }} /> CHAT
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                      onClick={() => setActiveTab('timeline')}
                    >
                      <FaHistory style={{ marginRight: '6px' }} /> LÍNEA DE TIEMPO
                    </button>
                  </div>

                  {/* Chat Panel */}
                  {activeTab === 'chat' && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flexGrow: 1,
                      overflow: 'hidden',
                    }}>
                      <div
                        ref={chatHistoryRef}
                        id="chatHistory"
                        style={{
                          flexGrow: 1,
                          overflowY: 'auto',
                          padding: '20px',
                          background: 'var(--bg-color)',
                          display: chatHistory.length === 0 ? 'flex' : 'block',
                          flexDirection: chatHistory.length === 0 ? 'column' : 'initial',
                          alignItems: chatHistory.length === 0 ? 'center' : 'initial',
                          justifyContent: chatHistory.length === 0 ? 'center' : 'initial',
                        }}
                      >
                        {chatHistory.length === 0 ? (
                          <div style={{
                            color: 'var(--gray-text)',
                            opacity: 0.6,
                            textAlign: 'center',
                          }}>
                            <FaComments style={{ fontSize: '3.5rem', color: '#ccc', marginBottom: '15px' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Aún no hay mensajes</div>
                          </div>
                        ) : (
                          chatHistory.map((msg, idx) => {
                            const isTech = msg.es_tecnico == 1;
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: isTech ? 'flex-start' : 'flex-end',
                                  marginBottom: '15px',
                                }}
                              >
                                <div style={{
                                  maxWidth: '85%',
                                  background: isTech ? '#eef2ff' : '#f8f9fc',
                                  padding: '12px 15px',
                                  borderRadius: '12px',
                                  border: isTech ? '1px solid #d1d3e2' : '1px solid #e3e6f0',
                                  textAlign: 'left',
                                  wordWrap: 'break-word',
                                  overflowWrap: 'break-word',
                                  wordBreak: 'break-word',
                                }}>
                                  <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: isTech ? '#4e73df' : '#555',
                                    marginBottom: '4px',
                                  }}>
                                    {isTech ? <><FaUser style={{ marginRight: '4px' }} /> Soporte TI</> : 'Tú'}
                                  </div>
                                  <div style={{
                                    fontSize: '0.9rem',
                                    lineHeight: '1.4',
                                    color: '#333',
                                  }}>
                                    {msg.mensaje}
                                  </div>
                                  <div style={{
                                    fontSize: '0.7rem',
                                    color: '#aaa',
                                    marginTop: '5px',
                                    textAlign: 'right',
                                  }}>
                                    {formatDate(msg.fecha)}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input */}
                      {!showWizard && !existingRating && canReply && (canViewGlobal || viewTicket?.tecnico_id == user?.id) && (
                        <div id="chatInputWrapper" style={{
                          padding: '15px 20px',
                          borderTop: '1px solid var(--border-color)',
                          background: 'var(--input-bg)',
                        }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                              type="text"
                              id="chatMessage"
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              onKeyDown={handleChatKeyPress}
                              placeholder="Escriba un mensaje... (Mín. 6 caracteres)"
                              minLength={6}
                              maxLength={2000}
                              style={{
                                flex: 1,
                                borderRadius: '20px',
                                padding: '12px 20px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--card-bg)',
                                color: 'var(--text-color)',
                                fontSize: '0.9rem',
                                outline: 'none',
                              }}
                            />
                            <button
                              className="btn-main"
                              onClick={sendReply}
                              disabled={sendingReply}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: sendingReply ? '#888' : 'var(--primary-color)',
                                color: 'white',
                                border: 'none',
                                cursor: sendingReply ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 10px rgba(78, 115, 223, 0.3)',
                              }}
                            >
                              {sendingReply ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* When wizard or existing rating is showing, hide chat input (already handled above) */}
                    </div>
                  )}

                  {/* Timeline Panel */}
                  {activeTab === 'timeline' && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flexGrow: 1,
                      overflow: 'hidden',
                    }}>
                      <div
                        id="timelineHistory"
                        style={{
                          flexGrow: 1,
                          overflowY: 'auto',
                          padding: '20px',
                          background: 'var(--bg-color)',
                          display: timelineData.length === 0 ? 'flex' : 'block',
                          flexDirection: timelineData.length === 0 ? 'column' : 'initial',
                          alignItems: timelineData.length === 0 ? 'center' : 'initial',
                          justifyContent: timelineData.length === 0 ? 'center' : 'initial',
                        }}
                      >
                        {timelineData.length === 0 ? (
                          <div style={{
                            color: 'var(--gray-text)',
                            opacity: 0.6,
                            textAlign: 'center',
                          }}>
                            <FaHistory style={{ fontSize: '3.5rem', color: '#ccc', marginBottom: '15px' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>No hay actividad registrada</div>
                          </div>
                        ) : (
                          <div className="timeline-container" style={{
                            position: 'relative',
                            paddingLeft: '30px',
                          }}>
                            {timelineData.map((item, idx) => {
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
                              const date = new Date(item.fecha);
                              const formattedDate = date.toLocaleDateString('es-ES', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              });
                              const formattedTime = date.toLocaleTimeString('es-ES', {
                                hour: '2-digit', minute: '2-digit',
                              });

                              return (
                                <div
                                  key={idx}
                                  className="timeline-item"
                                  style={{
                                    position: 'relative',
                                    marginBottom: '20px',
                                    paddingLeft: '15px',
                                  }}
                                >
                                  <div className="timeline-marker" style={{
                                    position: 'absolute',
                                    left: '-22px',
                                    top: 0,
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '10px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    zIndex: 1,
                                    backgroundColor: iconColor,
                                  }}>
                                    <i className={`fa-solid ${icon}`} style={{ fontSize: '10px' }}></i>
                                  </div>
                                  <div className="timeline-content" style={{
                                    background: 'var(--card-bg)',
                                    padding: '12px 15px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    transition: 'all 0.3s ease',
                                  }}>
                                    <div className="timeline-description" style={{
                                      fontSize: '0.85rem',
                                      color: 'var(--text-color)',
                                      fontWeight: 600,
                                    }}>
                                      {item.descripcion}
                                    </div>
                                    <div className="timeline-date" style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--gray-text)',
                                      marginTop: '5px',
                                      display: 'flex',
                                      justifyContent: 'space-between'
                                    }}>
                                      <span>{item.nombre_completo || ''}</span>
                                      <span>{formattedDate} - {formattedTime}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── PREVIEW MODAL ────────────────────────────────────────────── */}
      {showPreviewModal && previewFile && (() => {
        const fileUrl = `/api/uploads/tickets/${previewFile}`;
        const ext = (previewFile.split('.').pop() || '').toLowerCase();
        const isImage = /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(ext);
        const isPdf   = ext === 'pdf';
        const isText  = /^(txt|csv|json|xml|html|htm|md|log|yaml|yml|ini|cfg|sh|bat|py|js|ts|jsx|tsx|css|scss|sql)$/.test(ext);
        const isVideo = /^(mp4|webm|ogg|mov|avi|mkv)$/.test(ext);
        const isAudio = /^(mp3|wav|ogg|aac|flac|m4a)$/.test(ext);
        const isDoc   = /^(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/.test(ext);

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
              position: 'fixed', top: 0, left: 0,
              width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              zIndex: 30000, backdropFilter: 'blur(5px)',
            }}
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className="modal-content"
              style={{
                width: '820px', maxWidth: '92vw', height: '88vh',
                background: 'var(--card-bg)', borderRadius: '15px',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                padding: 0, boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '15px 25px', borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--card-bg)', flexShrink: 0,
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
                      padding: '7px 16px', borderRadius: 20,
                      background: 'var(--primary-color)', color: 'white',
                      textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <FaDownload /> Descargar
                  </a>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: 'none',
                      cursor: 'pointer', background: 'var(--input-bg)',
                      color: 'var(--text-color)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{
                flexGrow: 1, display: 'flex', justifyContent: 'center',
                alignItems: isImage || isVideo || isAudio ? 'center' : 'stretch',
                background: isImage ? '#111' : 'var(--bg-color)',
                overflow: 'hidden',
              }}>
                {isImage && (
                  <img
                    src={fileUrl} alt="Evidencia"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
                  />
                )}
                {(isPdf || isText) && (
                  <iframe src={fileUrl} title="Vista previa" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
                )}
                {isVideo && (
                  <video src={fileUrl} controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
                )}
                {isAudio && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
                    <FaMusic style={{ fontSize: 64, color: 'var(--primary-color)', opacity: 0.7 }} />
                    <p style={{ color: 'var(--text-color)', fontWeight: 600 }}>{previewFile}</p>
                    <audio src={fileUrl} controls style={{ width: '100%', maxWidth: 400 }} />
                  </div>
                )}
                {isDoc && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40, textAlign: 'center' }}>
                    {FileIcon}
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-color)', margin: '0 0 8px' }}>{previewFile}</p>
                      <p style={{ color: 'var(--gray-text)', fontSize: '0.88rem', margin: '0 0 20px' }}>
                        Este tipo de archivo no puede previsualizarse directamente en el navegador.
                      </p>
                      <a
                        href={fileUrl} download
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          background: 'var(--primary-color)', color: '#fff',
                          padding: '10px 24px', borderRadius: 25,
                          textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
                          boxShadow: '0 4px 12px rgba(78,115,223,0.35)',
                        }}
                      >
                        <FaDownload /> Descargar archivo
                      </a>
                    </div>
                  </div>
                )}
                {!isImage && !isPdf && !isText && !isVideo && !isAudio && !isDoc && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center' }}>
                    <FaFileAlt style={{ fontSize: 56, color: 'var(--primary-color)', opacity: 0.7 }} />
                    <p style={{ fontWeight: 700, color: 'var(--text-color)', margin: 0 }}>{previewFile}</p>
                    <p style={{ color: 'var(--gray-text)', fontSize: '0.88rem', margin: 0 }}>
                      Vista previa no disponible para este tipo de archivo.
                    </p>
                    <a
                      href={fileUrl} download
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
    </>
  );
}
