import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { searchAPI, notificationAPI, auxAPI } from '../../api/client';
import { showToast, showConfirm } from '../../core/toast';
import DOMPurify from 'dompurify';
import SearchableSelect from '../common/SearchableSelect';
import { avatarUrl } from '../../config';

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function sanitizeMsg(html) {
  if (!html) return '';
  let clean = html
    .replace(/href=['"]gestion_tickets\.php\?ticket_id=(\d+)['"]/gi,
             "href='/gestion-tickets?ticket_id=$1' data-react-link='true'")
    .replace(/href=['"]tickets\.php\?ticket_id=(\d+)['"]/gi,
             "href='/tickets?ticket_id=$1' data-react-link='true'");
  return DOMPurify.sanitize(clean, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'style', 'class', 'target', 'data-react-link'],
  });
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function TopBar({ onToggleMobile, onOpenShortcuts }) {
  const { user, permisos, esAdministrativo, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    setNotifications,
    setUnreadCount,
    reloadNotifications,
    setMuted: setRealtimeMuted,
  } = useRealtime();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifTab, setNotifTab] = useState('inbox'); // 'inbox' | 'archived'
  const [archivedNotifs, setArchivedNotifs] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showProfile, setShowProfile] = useState(false);
  const [muted, setMuted] = useState(localStorage.getItem('muteNotifications') === 'true');
  const [showReadModal, setShowReadModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [readingNotif, setReadingNotif] = useState(null);
  const [sendForm, setSendForm] = useState({ titulo: '', mensaje: '', tipo: 'personal', id_destinatario: '' });
  const [sendingNotif, setSendingNotif] = useState(false);
  const [users, setUsers] = useState([]);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchTimeout = useRef(null);
  const msgBodyRef = useRef(null);
  const readModalRef = useRef(null);
  const sendModalRef = useRef(null);

  const handleToggleMute = (e) => {
    e.stopPropagation();
    const newVal = !muted;
    setMuted(newVal);
    setRealtimeMuted(newVal);
  };

  const handleMsgBodyClick = useCallback((e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    if (href.startsWith('/')) {
      e.preventDefault();
      setShowReadModal(false);
      navigate(href);
    }
  }, [navigate]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        // No cerrar el panel si el clic ocurrió dentro o interactuando con los modales o confirmaciones
        if (readModalRef.current && readModalRef.current.contains(e.target)) return;
        if (sendModalRef.current && sendModalRef.current.contains(e.target)) return;
        if (e.target.closest && (e.target.closest('.swal2-container') || e.target.closest('.modal-overlay'))) return;
        setShowNotif(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const fetchArchivedNotifs = useCallback(async () => {
    setLoadingArchived(true);
    try {
      const res = await notificationAPI.list({ archived: 1 });
      if (res.data?.success) {
        const payload = res.data.data;
        const items = Array.isArray(payload?.data) ? payload.data
                    : Array.isArray(payload) ? payload
                    : [];
        setArchivedNotifs(items);
      }
    } catch { /* ignore */ }
    setLoadingArchived(false);
  }, []);

  const handleTabChange = (tab) => {
    setNotifTab(tab);
    setSelectedIds(new Set());
    if (tab === 'archived') {
      fetchArchivedNotifs();
    }
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) {
      setShowSearch(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchAPI.global(value);
        if (res.data.success) {
          setSearchResults(res.data.data || []);
          setShowSearch(true);
        }
      } catch { setSearchResults([]); }
    }, 300);
  };

  const markAsRead = async (notif) => {
    setReadingNotif(notif);
    setShowReadModal(true);
    if (notif.leido == 0) {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, leido: 1 } : n)
      );
      setArchivedNotifs(prev =>
        prev.map(n => n.id === notif.id ? { ...n, leido: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      try {
        await notificationAPI.markRead(notif.id);
      } catch { /* ignore */ }
    }
  };

  const toggleReadStatus = async (e, notif) => {
    if (e) e.stopPropagation();
    const isUnread = notif.leido == 0;
    const newStatus = isUnread ? 1 : 0;

    // Actualizar estado en inbox y en archivados
    setNotifications(prev =>
      prev.map(n => n.id === notif.id ? { ...n, leido: newStatus } : n)
    );
    setArchivedNotifs(prev =>
      prev.map(n => n.id === notif.id ? { ...n, leido: newStatus } : n)
    );
    if (readingNotif?.id === notif.id) {
      setReadingNotif(prev => ({ ...prev, leido: newStatus }));
    }

    // Actualizar contador
    if (notif.tipo !== 'global' || notif.id_destinatario) {
      setUnreadCount(prev => isUnread ? Math.max(0, prev - 1) : prev + 1);
    }

    try {
      if (isUnread) {
        await notificationAPI.markRead(notif.id);
        showToast('Notificación marcada como leída', 'info');
      } else {
        await notificationAPI.markUnread(notif.id);
        showToast('Notificación marcada como no leída', 'info');
      }
    } catch {
      reloadNotifications();
    }
  };

  const markAllAsRead = async (e) => {
    if (e) e.stopPropagation();
    const unreadItems = notifications.filter(n => n.leido == 0);
    if (unreadCount === 0 && unreadItems.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, leido: 1 })));
    setUnreadCount(0);

    try {
      await notificationAPI.markAllRead();
      showToast('Todas las notificaciones marcadas como leídas', 'success');
    } catch {
      try {
        await Promise.allSettled(unreadItems.map(n => notificationAPI.markRead(n.id)));
        showToast('Todas las notificaciones marcadas como leídas', 'success');
      } catch { /* ignore */ }
    }
  };

  const handleArchiveNotif = async (e, notif, unarchive = false) => {
    if (e) e.stopPropagation();
    if (unarchive) {
      setArchivedNotifs(prev => prev.filter(n => n.id !== notif.id));
      setNotifications(prev => [{ ...notif, archivado: 0 }, ...prev]);
      if (notif.leido == 0) setUnreadCount(prev => prev + 1);
    } else {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      if (notif.leido == 0) setUnreadCount(prev => Math.max(0, prev - 1));
      setArchivedNotifs(prev => [{ ...notif, archivado: 1 }, ...prev]);
    }

    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(notif.id);
      return next;
    });

    if (showReadModal && readingNotif?.id === notif.id) {
      setShowReadModal(false);
    }

    try {
      await notificationAPI.archive(notif.id, unarchive);
      showToast(unarchive ? 'Notificación movida a la bandeja principal' : 'Notificación archivada', 'success');
    } catch {
      reloadNotifications();
      if (notifTab === 'archived') fetchArchivedNotifs();
    }
  };

  const handleDeleteNotif = async (e, notif) => {
    if (e) e.stopPropagation();
    const confirmed = await showConfirm({
      title: '¿Eliminar notificación?',
      text: `Se eliminará permanentemente "${notif.titulo}".`,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      icon: 'warning',
      confirmVariant: 'danger'
    });
    if (!confirmed?.isConfirmed) return;

    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setArchivedNotifs(prev => prev.filter(n => n.id !== notif.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(notif.id);
      return next;
    });

    if (notif.leido == 0 && (!notif.archivado || notif.archivado == 0)) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (showReadModal && readingNotif?.id === notif.id) {
      setShowReadModal(false);
    }

    try {
      await notificationAPI.delete(notif.id);
      showToast('Notificación eliminada', 'success');
    } catch {
      reloadNotifications();
      if (notifTab === 'archived') fetchArchivedNotifs();
    }
  };

  // ── Operaciones Multiselección ──
  const currentNotifs = notifTab === 'inbox' ? notifications : archivedNotifs;

  const toggleSelectAll = (e) => {
    if (e) e.stopPropagation();
    if (selectedIds.size === currentNotifs.length && currentNotifs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentNotifs.map(n => n.id)));
    }
  };

  const toggleSelectOne = (e, id) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchMarkRead = async (isRead = true) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const idsSet = new Set(ids);
    const affected = currentNotifs.filter(n => idsSet.has(n.id));
    const targetStatus = isRead ? 1 : 0;

    setNotifications(prev => prev.map(n => idsSet.has(n.id) ? { ...n, leido: targetStatus } : n));
    setArchivedNotifs(prev => prev.map(n => idsSet.has(n.id) ? { ...n, leido: targetStatus } : n));

    const newlyReadCount = affected.filter(n => n.leido == 0 && isRead).length;
    const newlyUnreadCount = affected.filter(n => n.leido == 1 && !isRead).length;
    if (newlyReadCount > 0) setUnreadCount(prev => Math.max(0, prev - newlyReadCount));
    if (newlyUnreadCount > 0) setUnreadCount(prev => prev + newlyUnreadCount);

    setSelectedIds(new Set());

    try {
      if (isRead) {
        await notificationAPI.markRead(ids);
        showToast(`${ids.length} notificaciones marcadas como leídas`, 'info');
      } else {
        await notificationAPI.markUnread(ids);
        showToast(`${ids.length} notificaciones marcadas como no leídas`, 'info');
      }
    } catch {
      reloadNotifications();
      if (notifTab === 'archived') fetchArchivedNotifs();
    }
  };

  const handleBatchArchive = async (unarchive = false) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const idsSet = new Set(ids);
    const affected = (unarchive ? archivedNotifs : notifications).filter(n => idsSet.has(n.id));

    if (unarchive) {
      setArchivedNotifs(prev => prev.filter(n => !idsSet.has(n.id)));
      setNotifications(prev => [...affected.map(n => ({ ...n, archivado: 0 })), ...prev]);
      const unreadAdded = affected.filter(n => n.leido == 0).length;
      if (unreadAdded > 0) setUnreadCount(prev => prev + unreadAdded);
    } else {
      setNotifications(prev => prev.filter(n => !idsSet.has(n.id)));
      setArchivedNotifs(prev => [...affected.map(n => ({ ...n, archivado: 1 })), ...prev]);
      const unreadRemoved = affected.filter(n => n.leido == 0).length;
      if (unreadRemoved > 0) setUnreadCount(prev => Math.max(0, prev - unreadRemoved));
    }

    setSelectedIds(new Set());

    try {
      await notificationAPI.archive(ids, unarchive);
      showToast(unarchive ? `${ids.length} notificaciones desarchivadas` : `${ids.length} notificaciones archivadas`, 'success');
    } catch {
      reloadNotifications();
      if (notifTab === 'archived') fetchArchivedNotifs();
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = await showConfirm({
      title: '¿Eliminar notificaciones seleccionadas?',
      text: `Se eliminarán permanentemente ${ids.length} notificaciones.`,
      confirmButtonText: `Sí, eliminar (${ids.length})`,
      cancelButtonText: 'Cancelar',
      icon: 'warning',
      confirmVariant: 'danger'
    });
    if (!confirmed?.isConfirmed) return;

    const idsSet = new Set(ids);
    const unreadDeleted = notifications.filter(n => idsSet.has(n.id) && n.leido == 0 && (!n.archivado || n.archivado == 0)).length;

    setNotifications(prev => prev.filter(n => !idsSet.has(n.id)));
    setArchivedNotifs(prev => prev.filter(n => !idsSet.has(n.id)));
    if (unreadDeleted > 0) setUnreadCount(prev => Math.max(0, prev - unreadDeleted));

    setSelectedIds(new Set());

    try {
      await notificationAPI.delete(ids);
      showToast(`${ids.length} notificaciones eliminadas`, 'success');
    } catch {
      reloadNotifications();
      if (notifTab === 'archived') fetchArchivedNotifs();
    }
  };

  const loadUsers = async () => {
    try {
      const res = await auxAPI.users();
      if (res.data.success) {
        const rawUsers = res.data.data?.users || res.data.data || [];
        const normalized = rawUsers.map(u => ({
          ...u,
          nombre_completo: u.nombre_completo || u.nombre || u.username || `Usuario #${u.id}`,
        }));
        setUsers(normalized);
      }
    } catch { /* ignore */ }
  };

  const handleSendNotif = async (e) => {
    e.preventDefault();
    setSendingNotif(true);
    try {
      const res = await notificationAPI.send(sendForm);
      if (res.data.success) {
        showToast('Notificación enviada correctamente', 'success');
        setShowSendModal(false);
        setSendForm({ titulo: '', mensaje: '', tipo: 'personal', id_destinatario: '' });
      } else {
        showToast('Error de conexión', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
    setSendingNotif(false);
  };

  const openSendModal = () => {
    loadUsers();
    setSendForm({ titulo: '', mensaje: '', tipo: 'personal', id_destinatario: '' });
    setShowSendModal(true);
  };

  const replyToNotification = () => {
    if (!readingNotif) return;
    setShowReadModal(false);
    loadUsers();
    setSendForm({
      titulo: 'RE: ' + (readingNotif.titulo || ''),
      mensaje: '',
      tipo: 'personal',
      id_destinatario: readingNotif.id_remitente || ''
    });
    setShowSendModal(true);
  };

  return (
    <>
      <header className="top-bar">
        <div className="flex items-center gap-3.5 flex-grow">
          <button className="mobile-menu-btn" onClick={onToggleMobile} aria-label="Abrir menú">
            <i className="fa-solid fa-bars"></i>
          </button>

          {esAdministrativo() && (
            <div className="search-box" ref={searchRef}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}></i>
              <input
                type="text"
                placeholder="Buscar activos, tickets y más..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.trim().length >= 2 && setShowSearch(true)}
                onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setShowSearch(false); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 4px' }}
                  title="Limpiar búsqueda"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              ) : (
                <span className="search-shortcut-badge">Alt+Shift+K</span>
              )}

              {showSearch && (
                <div className="search-results-container active">
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '20px', marginBottom: '8px', opacity: 0.45, display: 'block' }}></i>
                      <div>No se encontraron resultados</div>
                    </div>
                  ) : (
                    searchResults.map((item, idx) => (
                      <a
                        key={idx}
                        href={item.url}
                        className="search-item"
                        onClick={(e) => { e.preventDefault(); navigate(item.url); setShowSearch(false); }}
                      >
                        <div className="item-icon">
                          <i className={`fa-solid ${item.icon || 'fa-file'}`}></i>
                        </div>
                        <div className="item-info">
                          <span className="item-title">{item.label}</span>
                          <span className="item-subtitle">{item.sublabel || item.type}</span>
                        </div>
                        <span className="item-type">{item.type}</span>
                      </a>
                    ))
                  )}
                  {searchResults.length > 0 && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>{searchResults.length} resultado(s)</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="action-btn btn-sm"
            style={{ height: '38px', borderRadius: 'var(--radius-pill)', padding: '0 14px' }}
            title="Atajos de teclado (Alt + ?)"
            onClick={onOpenShortcuts}
          >
            <i className="fa-regular fa-keyboard" style={{ fontSize: '13px', color: 'var(--text-muted)' }}></i>
            <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>Alt+?</span>
          </button>

          <div
            className="notification-wrapper"
            ref={notifRef}
            title="Notificaciones"
          >
            <button
              type="button"
              className="btn-icon"
              style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setShowNotif(prev => !prev); }}
              aria-label="Abrir notificaciones"
            >
              <i className="fa-solid fa-bell" style={{ fontSize: '15px', color: 'var(--text-muted)' }}></i>
            </button>
            {unreadCount > 0 && (
              <span className="badge-notification">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {showNotif && (
              <div className="notification-dropdown active" onClick={(e) => e.stopPropagation()}>
                <div className="notif-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4>Notificaciones</h4>
                    {unreadCount > 0 && (
                      <span className="ui-pill pill-rose" style={{ padding: '1px 7px', fontSize: '10.5px', fontWeight: 700 }}>
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      onClick={(e) => { e.stopPropagation(); setShowNotif(false); }}
                      title="Cerrar panel"
                    >
                      <i className="fa-solid fa-times" style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}></i>
                    </button>
                    {notifTab === 'inbox' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{
                          height: '28px',
                          padding: '0 8px',
                          fontSize: '11.5px',
                          gap: '5px',
                          opacity: unreadCount > 0 ? 1 : 0.45,
                          cursor: unreadCount > 0 ? 'pointer' : 'default'
                        }}
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                        title="Marcar todas como leídas"
                      >
                        <i
                          className="fa-solid fa-check-double"
                          style={{ color: unreadCount > 0 ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: '12px' }}
                        ></i>
                        <span>Leídas</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      onClick={handleToggleMute}
                      title={muted ? 'Activar sonido de notificaciones' : 'Silenciar notificaciones'}
                    >
                      <i
                        className={`fa-solid ${muted ? 'fa-volume-xmark' : 'fa-bell'}`}
                        style={{ color: muted ? 'var(--text-muted)' : 'var(--primary-color)', fontSize: '12.5px' }}
                      ></i>
                    </button>
                    {(permisos.conf_basica || permisos.conf_roles) && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={openSendModal}
                      >
                        <i className="fa-solid fa-plus"></i> Nuevo
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-tabs: Bandeja principal vs Archivadas */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'var(--surface-primary)',
                  padding: '4px 12px 0'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleTabChange('inbox')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '8px 12px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: notifTab === 'inbox' ? 'var(--primary-color)' : 'var(--text-muted)',
                        borderBottom: notifTab === 'inbox' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-inbox" style={{ fontSize: '12px' }}></i>
                      Bandeja ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('archived')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '8px 12px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: notifTab === 'archived' ? 'var(--primary-color)' : 'var(--text-muted)',
                        borderBottom: notifTab === 'archived' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-box-archive" style={{ fontSize: '12px' }}></i>
                      Archivadas
                    </button>
                  </div>

                  {currentNotifs.length > 0 && (
                    <button
                      type="button"
                      className="btn-icon btn-ghost"
                      style={{
                        width: '24px',
                        height: '24px',
                        fontSize: '11px',
                        marginBottom: '4px'
                      }}
                      onClick={toggleSelectAll}
                      title={selectedIds.size === currentNotifs.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    >
                      <i className={`fa-regular ${selectedIds.size === currentNotifs.length && currentNotifs.length > 0 ? 'fa-check-square' : 'fa-square'}`}></i>
                    </button>
                  )}
                </div>

                {/* Barra de Acciones Masivas cuando hay selección */}
                {selectedIds.size > 0 && (
                  <div style={{
                    padding: '8px 14px',
                    background: 'var(--surface-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    animation: 'fadeIn 0.15s ease'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                      {selectedIds.size} seleccionada(s)
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-icon btn-ghost"
                        style={{ width: '26px', height: '26px', fontSize: '11.5px' }}
                        onClick={() => handleBatchMarkRead(true)}
                        title="Marcar como leídas"
                      >
                        <i className="fa-solid fa-envelope-open" style={{ color: 'var(--primary-color)' }}></i>
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-ghost"
                        style={{ width: '26px', height: '26px', fontSize: '11.5px' }}
                        onClick={() => handleBatchMarkRead(false)}
                        title="Marcar como no leídas"
                      >
                        <i className="fa-solid fa-envelope" style={{ color: 'var(--text-muted)' }}></i>
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-ghost"
                        style={{ width: '26px', height: '26px', fontSize: '11.5px' }}
                        onClick={() => handleBatchArchive(notifTab === 'archived')}
                        title={notifTab === 'archived' ? 'Desarchivar seleccionadas' : 'Archivar seleccionadas'}
                      >
                        <i className={`fa-solid ${notifTab === 'archived' ? 'fa-arrow-up-from-bracket' : 'fa-box-archive'}`} style={{ color: 'var(--text-muted)' }}></i>
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-ghost"
                        style={{ width: '26px', height: '26px', fontSize: '11.5px' }}
                        onClick={handleBatchDelete}
                        title="Eliminar seleccionadas"
                      >
                        <i className="fa-solid fa-trash" style={{ color: 'var(--error-color)' }}></i>
                      </button>
                    </div>
                  </div>
                )}

                <div className="notif-list">
                  {notifTab === 'archived' && loadingArchived ? (
                    <div className="notif-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--primary-color)' }}></i>
                      Cargando archivadas...
                    </div>
                  ) : currentNotifs.length === 0 ? (
                    <div className="notif-empty">
                      <i className={`fa-solid ${notifTab === 'inbox' ? 'fa-bell-slash' : 'fa-box-open'}`} style={{ fontSize: '24px', display: 'block', opacity: 0.35, marginBottom: '8px' }}></i>
                      {notifTab === 'inbox' ? 'No tienes notificaciones recientes' : 'No tienes notificaciones archivadas'}
                    </div>
                  ) : (
                    currentNotifs.map((n) => {
                      const isSelected = selectedIds.has(n.id);
                      return (
                        <div
                          key={n.id}
                          className={`notif-item ${n.leido == 0 && n.tipo !== 'global' ? 'unread' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => markAsRead(n)}
                          style={{
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            background: isSelected ? 'var(--primary-light)' : undefined
                          }}
                        >
                          {/* Checkbox multiselección */}
                          <div
                            onClick={(e) => toggleSelectOne(e, n.id)}
                            style={{
                              padding: '2px 4px',
                              cursor: 'pointer',
                              color: isSelected ? 'var(--primary-color)' : 'var(--text-tertiary)',
                              fontSize: '13px',
                              marginTop: '2px'
                            }}
                            title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                          >
                            <i className={`fa-regular ${isSelected ? 'fa-check-square' : 'fa-square'}`}></i>
                          </div>

                          {/* Contenido principal */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="notif-title">
                              {n.tipo === 'global'
                                ? <i className="fa-solid fa-earth-americas" style={{ color: 'var(--info-color)' }}></i>
                                : <i className="fa-solid fa-user" style={{ color: 'var(--primary-color)' }}></i>}
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {n.titulo}
                              </span>
                              {n.leido == 0 && (
                                <span className="ui-pill pill-emerald" style={{ padding: '2px 8px', fontSize: '10px' }}>Nuevo</span>
                              )}
                            </div>
                            <div className="notif-msg">{stripHtml(n.mensaje)}</div>
                            <div className="notif-meta">
                              <span>{n.remitente_nombre || 'Sistema'}</span>
                              <span>{n.fecha ? new Date(n.fecha).toLocaleDateString() : ''}</span>
                            </div>
                          </div>

                          {/* Botones de acción rápida por fila */}
                          <div
                            className="notif-row-actions"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              flexShrink: 0
                            }}
                          >
                            {/* Alternar Leído / No leído */}
                            <button
                              type="button"
                              className="btn-icon btn-ghost"
                              style={{ width: '26px', height: '26px', fontSize: '11.5px', borderRadius: 'var(--radius-sm)' }}
                              onClick={(e) => toggleReadStatus(e, n)}
                              title={n.leido == 1 ? 'Marcar como no leída' : 'Marcar como leída'}
                            >
                              <i
                                className={`fa-solid ${n.leido == 1 ? 'fa-envelope' : 'fa-envelope-open'}`}
                                style={{ color: n.leido == 1 ? 'var(--primary-color)' : 'var(--text-muted)' }}
                              ></i>
                            </button>

                            {/* Archivar / Desarchivar */}
                            <button
                              type="button"
                              className="btn-icon btn-ghost"
                              style={{ width: '26px', height: '26px', fontSize: '11.5px', borderRadius: 'var(--radius-sm)' }}
                              onClick={(e) => handleArchiveNotif(e, n, notifTab === 'archived')}
                              title={notifTab === 'archived' ? 'Desarchivar (mover a bandeja)' : 'Archivar notificación'}
                            >
                              <i
                                className={`fa-solid ${notifTab === 'archived' ? 'fa-arrow-up-from-bracket' : 'fa-box-archive'}`}
                                style={{ color: 'var(--text-muted)' }}
                              ></i>
                            </button>

                            {/* Eliminar */}
                            <button
                              type="button"
                              className="btn-icon btn-ghost"
                              style={{ width: '26px', height: '26px', fontSize: '11.5px', borderRadius: 'var(--radius-sm)' }}
                              onClick={(e) => handleDeleteNotif(e, n)}
                              title="Eliminar notificación"
                            >
                              <i className="fa-solid fa-trash" style={{ color: 'var(--error-color)' }}></i>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-profile" ref={profileRef} onClick={() => setShowProfile(!showProfile)}>
            {avatarUrl(user?.nombre || 'U', 128) ? (
              <img
                src={avatarUrl(user?.nombre || 'U', 128)}
                alt="Avatar"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--border-color)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  background: 'linear-gradient(135deg, var(--primary-color), var(--accent-emerald))',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0,
                }}
              >
                {getInitials(user?.nombre)}
              </div>
            )}
            <div className="user-info" style={{ textAlign: 'left' }}>
              <h4>{user?.nombre || 'Usuario'}</h4>
              <small>{user?.username}</small>
            </div>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: '11px', color: 'var(--text-muted)' }}></i>

            {showProfile && (
              <div className="profile-dropdown active" onClick={(e) => e.stopPropagation()}>
                <Link to="/perfil" className="dropdown-item" onClick={() => setShowProfile(false)}>
                  <i className="fa-regular fa-user"></i> <span>Mi Perfil</span>
                </Link>
                {(permisos.conf_basica || permisos.conf_roles || permisos.rep_generar) && (
                  <Link to="/configuracion?tab=sistema" className="dropdown-item" onClick={() => setShowProfile(false)}>
                    <i className="fa-solid fa-server"></i> <span>Auditoría</span>
                  </Link>
                )}
                <div className="dropdown-divider"></div>
                <a
                  href="#"
                  className="dropdown-item"
                  style={{ color: 'var(--error-color)' }}
                  onClick={(e) => { e.preventDefault(); logout(); }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket" style={{ color: 'var(--error-color)' }}></i>
                  <span>Cerrar Sesión</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MODAL LEER NOTIFICACIÓN */}
      {showReadModal && readingNotif && (
        <div className="modal-overlay active" ref={readModalRef} onClick={(e) => { if (e.target === e.currentTarget) setShowReadModal(false); }}>
          <div className="modal-content" style={{ width: '620px', maxWidth: '95vw' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-envelope-open-text"></i>
                {readingNotif.titulo}
              </h3>
              <button className="btn-icon" onClick={() => setShowReadModal(false)} aria-label="Cerrar">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  <i className="fa-solid fa-user" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                  De: <strong style={{ color: 'var(--text-color)' }}>{readingNotif.remitente_nombre || 'Sistema'}</strong>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                  <i className="fa-regular fa-clock" style={{ marginRight: '5px' }}></i>
                  {new Date(readingNotif.fecha).toLocaleString()}
                </span>
              </div>
              <div
                className="notif-msg-body"
                style={{
                  background: 'var(--surface-secondary)',
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  minHeight: '80px',
                }}
                ref={msgBodyRef}
                onClick={handleMsgBodyClick}
                dangerouslySetInnerHTML={{ __html: sanitizeMsg(readingNotif.mensaje) }}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {/* Acciones del mensaje */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Marcar no leída */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    toggleReadStatus(e, readingNotif);
                    setShowReadModal(false);
                  }}
                  title={readingNotif.leido == 1 ? 'Marcar como no leída' : 'Marcar como leída'}
                >
                  <i className={`fa-solid ${readingNotif.leido == 1 ? 'fa-envelope' : 'fa-envelope-open'}`}></i>
                  {readingNotif.leido == 1 ? 'No leída' : 'Leída'}
                </button>

                {/* Archivar / Desarchivar */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => handleArchiveNotif(e, readingNotif, readingNotif.archivado == 1)}
                  title={readingNotif.archivado == 1 ? 'Mover a bandeja principal' : 'Archivar notificación'}
                >
                  <i className={`fa-solid ${readingNotif.archivado == 1 ? 'fa-arrow-up-from-bracket' : 'fa-box-archive'}`}></i>
                  {readingNotif.archivado == 1 ? 'Desarchivar' : 'Archivar'}
                </button>

                {/* Eliminar */}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={(e) => handleDeleteNotif(e, readingNotif)}
                  title="Eliminar notificación"
                >
                  <i className="fa-solid fa-trash"></i> Eliminar
                </button>
              </div>

              {/* Botones de navegación y respuesta */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReadModal(false)}>
                  Cerrar
                </button>
                {readingNotif.id_remitente && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={replyToNotification}>
                    <i className="fa-solid fa-reply"></i> Responder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENVIAR NOTIFICACIÓN */}
      {showSendModal && (
        <div className="modal-overlay active" ref={sendModalRef} onClick={(e) => { if (e.target === e.currentTarget) setShowSendModal(false); }}>
          <div className="modal-content" style={{ width: '520px', maxWidth: '95vw' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-paper-plane"></i>
                Nuevo Comunicado
              </h3>
              <button className="btn-icon" onClick={() => setShowSendModal(false)} aria-label="Cerrar">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSendNotif}>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <i className="fa-solid fa-heading" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                    Título <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Asunto del comunicado..."
                    value={sendForm.titulo}
                    onChange={(e) => setSendForm({ ...sendForm, titulo: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <i className="fa-solid fa-users" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                    Tipo de Envío
                  </label>
                  <select
                    className="form-control"
                    value={sendForm.tipo}
                    onChange={(e) => setSendForm({ ...sendForm, tipo: e.target.value })}
                  >
                    {permisos.conf_roles && <option value="global">Global (Todos los usuarios)</option>}
                    <option value="personal">Directo (Un usuario específico)</option>
                  </select>
                </div>
                {sendForm.tipo === 'personal' && (
                  <div className="form-group">
                    <label>
                      <i className="fa-solid fa-user-check" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                      Destinatario <span className="text-danger">*</span>
                    </label>
                    <SearchableSelect
                      options={users.map(u => ({ value: u.id, label: u.nombre_completo }))}
                      value={sendForm.id_destinatario !== '' ? Number(sendForm.id_destinatario) : null}
                      onChange={(val) => setSendForm({ ...sendForm, id_destinatario: val ?? '' })}
                      placeholder="-- Buscar usuario --"
                      isClearable={true}
                    />
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>
                    <i className="fa-solid fa-message" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                    Mensaje <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    required
                    placeholder="Escriba aquí el contenido del mensaje..."
                    value={sendForm.mensaje}
                    onChange={(e) => setSendForm({ ...sendForm, mensaje: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        document.getElementById('sendNotifBtn')?.click();
                      }
                    }}
                  />
                  {sendForm.mensaje.length > 0 && (
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <span style={{ fontSize: '0.75rem', color: sendForm.mensaje.trim().length > 0 ? 'var(--success-color)' : 'var(--gray-text)', fontWeight: 600 }}>
                        {sendForm.mensaje.trim().length} / 1000 caracteres
                      </span>
                    </div>
                  )}
                  <small className="text-muted" style={{ fontSize: '11.5px', marginTop: '6px', display: 'block' }}>
                    <i className="fa-solid fa-circle-info"></i> Presiona <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para nueva línea.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSendModal(false)}>
                  Cancelar
                </button>
                <button id="sendNotifBtn" type="submit" className="btn btn-primary" disabled={sendingNotif}>
                  {sendingNotif ? <><i className="fa-solid fa-spinner fa-spin"></i> Enviando...</> : <><i className="fa-solid fa-paper-plane"></i> Enviar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
