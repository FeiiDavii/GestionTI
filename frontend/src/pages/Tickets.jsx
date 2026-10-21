import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketAPI, notificationAPI } from '../api/client';
import { showToast } from '../core/toast';
import DataTableControls from '../components/common/DataTableControls';
import Pagination from '../components/common/Pagination';
import { FaEye, FaStar, FaRegStar, FaPaperPlane, FaPlus, FaTimes, FaHeadset, FaUserTie, FaCheck, FaUndo, FaComments, FaHistory, FaPaperclip, FaFileAlt, FaCheckCircle, FaInfoCircle, FaCloudUploadAlt, FaSpinner, FaUserCheck, FaUser, FaDownload, FaFileWord, FaFileExcel, FaFilePdf, FaFile, FaMusic } from 'react-icons/fa';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
  const [pageSize, setPageSize] = useState(10);
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

  // Shortcut Alt+Shift+N → abrir modal de nuevo ticket
  useEffect(() => {
    const handler = () => openCreateModal();
    window.addEventListener('shortcut:new', handler);
    return () => window.removeEventListener('shortcut:new', handler);
  }, [canCreate, canCreateTicket]);

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
          (t.tecnico || '').toLowerCase().includes(q) ||
          (t.tecnico_nombre || '').toLowerCase().includes(q)
      );
    }
    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [searchQuery, tickets, pageSize]);

  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));

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
          const dataObj = detailRes.data.data || {};
          setChatHistory(dataObj.chat || detailRes.data.chat || detailRes.data.history || []);
          setTimelineData(dataObj.timeline || detailRes.data.timeline || []);
        }
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
      showToast('Por favor ingresa el motivo para reabrir el caso', 'warning');
      return;
    }
    if (reopenReason.trim().length < 10) {
      showToast('El motivo debe tener al menos 10 caracteres', 'warning');
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
    <div className="inventory-module">
      <div className="inventory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="page-title-row">
            <h2>
              <FaHeadset /> Mesa de Servicios
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--gray-text)', fontSize: '0.88rem' }}>
            Historial y seguimiento de solicitudes
          </p>
        </div>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{
              opacity: canCreateTicket ? 1 : 0.55,
              cursor: canCreateTicket ? 'pointer' : 'not-allowed',
            }}
            title={!canCreateTicket ? `Bloqueado: ${blockReason}` : 'Crear Nuevo Ticket'}
          >
            <FaPlus /> Nuevo Ticket
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <DataTableControls
          pageSize={pageSize}
          setPageSize={setPageSize}
          searchTerm={searchQuery}
          setSearchTerm={setSearchQuery}
          totalItems={tickets.length}
          filteredItemsCount={filteredTickets.length}
        />

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>ID</th>
                <th>Asunto</th>
                <th style={{ width: '120px' }}>Prioridad</th>
                <th style={{ width: '130px' }}>Estado</th>
                <th style={{ width: '210px' }}>Técnico</th>
                <th style={{ width: '165px' }}>Fecha</th>
                <th className="text-center" style={{ width: '80px' }}>Ver</th>
              </tr>
            </thead>
            <tbody id="ticketsTableBody">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center p-4" style={{ color: 'var(--text-color)' }}>
                    <FaSpinner className="fa-spin" style={{ marginRight: '8px', display: 'inline' }} /> Cargando...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={7} className="text-center p-4" style={{ color: 'var(--error-color)' }}>
                    <FaTimes style={{ marginRight: '8px', display: 'inline' }} /> {error}
                  </td>
                </tr>
              )}

              {!loading && !error && filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-4" style={{ color: 'var(--gray-text)' }}>
                    <FaFileAlt style={{ fontSize: '2rem', margin: '0 auto 10px', opacity: 0.4, display: 'block' }} />
                    {searchQuery ? 'Sin resultados para tu búsqueda.' : 'No tienes tickets registrados.'}
                  </td>
                </tr>
              )}

              {!loading && !error && paginatedTickets.map((t) => {
                const hasPendingRating =
                  t.estado === 'Cerrado' && (!t.calificacion || t.calificacion === 0 || t.calificacion === '0');

                return (
                  <tr
                    key={t.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => viewTicketDetail(t.id)}
                  >
                    <td style={{ fontWeight: 700, color: 'var(--primary-color)' }}>
                      #{t.id}
                    </td>
                    <td
                      style={{
                        fontWeight: 500,
                        maxWidth: '340px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.titulo}
                    >
                      {t.titulo}
                    </td>
                    <td>
                      <span className={getPriorityPillClass(t.prioridad)}>{t.prioridad}</span>
                    </td>
                    <td>
                      <span className={getStatusPillClass(t.estado)}>{t.estado}</span>
                    </td>
                    <td
                      style={{
                        maxWidth: '210px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.tecnico_nombre || 'Pendiente'}
                    >
                      {t.tecnico_nombre ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <FaUserTie style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                          {t.tecnico_nombre}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-text)', fontStyle: 'italic' }}>Pendiente</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray-text)', whiteSpace: 'nowrap' }}>
                      {formatDate(t.fecha_creacion)}
                    </td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-table"
                        style={{ position: 'relative' }}
                        onClick={() => viewTicketDetail(t.id)}
                        title="Ver ticket"
                      >
                        <FaEye />
                        {hasPendingRating && (
                          <FaStar style={{ color: 'var(--warning-color)', fontSize: '0.65rem', position: 'absolute', top: '-3px', right: '-3px' }} />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      {/* ─── CREATE MODAL ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="modal-overlay active"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaHeadset style={{ color: 'var(--primary-color)' }} /> Nuevo Ticket
              </h3>
              <button
                type="button"
                className="btn-icon btn-ghost"
                onClick={() => setShowCreateModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px', display: 'block' }}>
                    Descripción del problema <span style={{ color: 'var(--error-color)' }}>*</span>
                  </label>
                  <textarea
                    className="form-control"
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    rows={5}
                    minLength={10}
                    maxLength={5000}
                    placeholder="Por favor, describe detalladamente el inconveniente..."
                    style={{ resize: 'vertical' }}
                    required
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <small style={{ color: 'var(--gray-text)', margin: 0 }}>
                      <FaInfoCircle style={{ marginRight: '4px' }} /> Mínimo 10 caracteres. La prioridad será asignada automáticamente.
                    </small>
                    {createDesc.length > 0 && (
                      <span style={{ fontSize: '0.78rem', color: createDesc.trim().length >= 10 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                        {createDesc.trim().length} / 5000 caracteres
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '18px' }}>
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
                  <div className="form-group" style={{ marginTop: '18px' }}>
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
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
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

      {/* ─── VIEW MODAL ───────────────────────────────────────────────── */}
      {showViewModal && (
        <div
          className="modal-overlay active"
          onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}
        >
          <div className="modal-content" style={{
            width: '960px',
            maxWidth: '96vw',
            height: '88vh',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-color)', fontWeight: 700 }}>
                  Ticket #{viewTicket?.id || '...'}
                </h3>
                <small style={{ color: 'var(--gray-text)' }}>Detalles y seguimiento</small>
              </div>
              <button
                type="button"
                className="btn-icon btn-ghost"
                onClick={() => setShowViewModal(false)}
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
                    padding: '28px',
                    textAlign: 'center',
                    flexShrink: 0,
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--surface-secondary)',
                  }}>
                    {/* Step 1: Was it resolved? */}
                    {wizardStep === 1 && (
                      <div className="wizard-step active">
                        <FaCheckCircle style={{ fontSize: '44px', color: 'var(--success-color)', marginBottom: '12px' }} />
                        <h4 style={{ marginBottom: '10px', color: 'var(--text-color)' }}>¿Tu problema fue resuelto?</h4>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '18px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ background: 'var(--success-color)' }}
                            onClick={() => wizardNext(true)}
                          >
                            <FaCheck /> Sí, resuelto
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => wizardNext(false)}
                          >
                            <FaUndo /> No, reabrir
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Rate */}
                    {wizardStep === 2 && (
                      <div className="wizard-step active">
                        <h4 style={{ marginBottom: '12px', color: 'var(--text-color)' }}>Califica el servicio</h4>
                        <div className="stars-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '14px 0' }}>
                          {STARS.map((star) => (
                            <span
                              key={star}
                              onClick={() => setRating(star)}
                              style={{ cursor: 'pointer', display: 'inline-flex' }}
                            >
                              {star <= rating ? (
                                <FaStar style={{ fontSize: '2rem', color: 'var(--warning-color)', transition: '0.2s' }} />
                              ) : (
                                <FaRegStar style={{ fontSize: '2rem', color: 'var(--border-color)', transition: '0.2s' }} />
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
                            display: 'block',
                            resize: 'vertical',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={submitRating}
                          style={{ marginTop: '10px' }}
                        >
                          Enviar Calificación
                        </button>
                      </div>
                    )}

                    {/* Step 3: Reopen */}
                    {wizardStep === 3 && (
                      <div className="wizard-step active">
                        <FaUndo style={{ fontSize: '42px', color: 'var(--error-color)', marginBottom: '12px' }} />
                        <h4 style={{ marginBottom: '8px', color: 'var(--text-color)' }}>Reabrir Ticket</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Por favor indíquenos por qué desea reabrir el caso:
                        </p>
                        <textarea
                          className="form-control"
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          rows={2}
                          placeholder="Mínimo 10 caracteres..."
                          style={{
                            margin: '10px auto 4px auto',
                            width: '80%',
                            display: 'block',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ width: '80%', margin: '0 auto', textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: reopenReason.trim().length >= 10 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                            {reopenReason.trim().length} / mín. 10 caracteres
                          </span>
                        </div>
                        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={submitReopen}
                          >
                            <FaUndo /> Reabrir Caso
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={wizardForceRate}
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
                    padding: '18px 28px',
                    textAlign: 'center',
                    flexShrink: 0,
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--success-bg)',
                  }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-color)', fontSize: '0.9rem' }}>
                      <FaCheck style={{ color: 'var(--success-color)', marginRight: '6px' }} />
                      Ya has calificado este servicio
                    </p>
                    <div id="staticStars" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>
                      {STARS.map((s) => (
                        <span key={s} style={{ display: 'inline-flex' }}>
                          {s <= existingRating ? (
                            <FaStar style={{ color: 'var(--warning-color)', fontSize: '1.3rem' }} />
                          ) : (
                            <FaRegStar style={{ color: 'var(--border-color)', fontSize: '1.3rem' }} />
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
                  gridTemplateColumns: '250px minmax(0, 1fr)',
                  flexGrow: 1,
                  overflow: 'hidden',
                  minHeight: 0,
                }}>
                  {/* LEFT PANEL: info */}
                  <div style={{
                    background: 'var(--surface-secondary)',
                    padding: '20px',
                    borderRight: '1px solid var(--border-color)',
                    overflowY: 'auto',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                        Estado
                      </label>
                      <div id="viewStatus" style={{ marginTop: '6px' }}>
                        <span className={getStatusPillClass(viewTicket.estado)}>
                          {viewTicket.estado}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                          Prioridad
                        </label>
                        <div id="viewPriority" style={{ marginTop: '6px' }}>
                          <span className={getPriorityPillClass(viewTicket.prioridad)}>
                            {viewTicket.prioridad}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                          Técnico
                        </label>
                        <div id="viewTech" style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: '6px', fontWeight: 600 }}>
                          {viewTicket.tecnico_nombre ? (
                            <><FaUserCheck style={{ color: 'var(--primary-color)', marginRight: '4px' }} /> {viewTicket.tecnico_nombre}</>
                          ) : (
                            <span style={{ color: 'var(--gray-text)', fontWeight: 400 }}>Sin asignar</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                        Descripción
                      </label>
                      <p id="viewDesc" style={{
                        fontSize: '0.88rem',
                        color: 'var(--text-color)',
                        background: 'var(--card-bg)',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        marginTop: '6px',
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
                      <div id="viewFile" style={{ marginTop: '6px' }}>
                        {viewTicket.archivo_adjunto ? (
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() => {
                              setPreviewFile(viewTicket.archivo_adjunto);
                              setShowPreviewModal(true);
                            }}
                          >
                            <FaPaperclip /> Ver Archivo Adjunto
                          </button>
                        ) : (
                          <span style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>Ninguno</span>
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
                        type="button"
                        className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                      >
                        <FaComments style={{ marginRight: '6px' }} /> CHAT
                      </button>
                      <button
                        type="button"
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
                              opacity: 0.7,
                              textAlign: 'center',
                            }}>
                              <FaComments style={{ fontSize: '3rem', color: 'var(--border-color)', marginBottom: '12px' }} />
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
                                    marginBottom: '14px',
                                  }}
                                >
                                  <div style={{
                                    maxWidth: '85%',
                                    background: isTech ? 'var(--primary-light)' : 'var(--surface-primary)',
                                    padding: '12px 15px',
                                    borderRadius: '14px',
                                    border: isTech ? '1px solid rgba(37, 99, 235, 0.22)' : '1px solid var(--border-color)',
                                    boxShadow: 'var(--shadow-xs)',
                                    textAlign: 'left',
                                    wordWrap: 'break-word',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                  }}>
                                    <div style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      color: isTech ? 'var(--primary-color)' : 'var(--text-secondary)',
                                      marginBottom: '4px',
                                    }}>
                                      {isTech ? <><FaUser style={{ marginRight: '4px' }} /> Soporte TI</> : 'Tú'}
                                    </div>
                                    <div style={{
                                      fontSize: '0.9rem',
                                      lineHeight: '1.45',
                                      color: 'var(--text-color)',
                                    }}>
                                      {msg.mensaje}
                                    </div>
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: 'var(--gray-text)',
                                      marginTop: '6px',
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
                        {!showWizard && !existingRating && viewTicket?.estado !== 'Cerrado' && (
                          <div id="chatInputWrapper" style={{
                            padding: '14px 20px',
                            borderTop: '1px solid var(--border-color)',
                            background: 'var(--card-bg)',
                          }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <input
                                type="text"
                                id="chatMessage"
                                className="form-control"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                onKeyDown={handleChatKeyPress}
                                placeholder="Escriba un mensaje... (Mín. 6 caracteres)"
                                minLength={6}
                                maxLength={2000}
                                style={{
                                  flex: 1,
                                  borderRadius: '9999px',
                                  padding: '10px 18px',
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-icon"
                                onClick={sendReply}
                                disabled={sendingReply}
                                style={{ borderRadius: '50%', width: '40px', height: '40px', flexShrink: 0 }}
                              >
                                {sendingReply ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
                              </button>
                            </div>
                            {chatMessage.length > 0 && (
                              <div style={{ paddingLeft: '18px', paddingTop: '4px', fontSize: '0.72rem', color: chatMessage.trim().length >= 6 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                                {chatMessage.trim().length} / 2000 caracteres (mín. 6)
                              </div>
                            )}
                          </div>
                        )}
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
                              opacity: 0.7,
                              textAlign: 'center',
                            }}>
                              <FaHistory style={{ fontSize: '3rem', color: 'var(--border-color)', marginBottom: '12px' }} />
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
                                  calificacion: 'fa-star', reapertura: 'fa-undo', resolucion: 'fa-check-circle'
                                };
                                const colorMap = {
                                  creacion: 'var(--primary-color)', asignacion: 'var(--success-color)',
                                  escalacion: 'var(--warning-color)', estado: 'var(--info-color)',
                                  calificacion: 'var(--warning-color)', reapertura: 'var(--error-color)', resolucion: 'var(--success-color)'
                                };
                                const icon = iconMap[item.tipo] || 'fa-circle';
                                const iconColor = colorMap[item.tipo] || 'var(--gray-text)';
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
                                      marginBottom: '18px',
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
                                      boxShadow: 'var(--shadow-xs)',
                                      zIndex: 1,
                                      backgroundColor: iconColor,
                                    }}>
                                      <i className={`fa-solid ${icon}`} style={{ fontSize: '10px' }}></i>
                                    </div>
                                    <div className="timeline-content" style={{
                                      background: 'var(--card-bg)',
                                      padding: '12px 15px',
                                      borderRadius: '10px',
                                      border: '1px solid var(--border-color)',
                                      boxShadow: 'var(--shadow-xs)',
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
      )}

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
                width: '820px', maxWidth: '92vw', height: '88vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                padding: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
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

              {/* Body */}
              <div style={{
                flexGrow: 1, display: 'flex', justifyContent: 'center',
                alignItems: isImage || isVideo || isAudio ? 'center' : 'stretch',
                background: isImage ? '#0F172A' : 'var(--bg-color)',
                overflow: 'hidden',
              }}>
                {isImage && (
                  <img
                    src={fileUrl} alt="Evidencia"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
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
                        className="btn btn-primary"
                        style={{ textDecoration: 'none' }}
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
