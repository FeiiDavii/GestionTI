import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { searchAPI, notificationAPI, auxAPI } from '../../api/client';
import { showToast } from '../../core/toast';
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
    setMuted: setRealtimeMuted,
  } = useRealtime();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
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
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
    setShowNotif(false);
    if (notif.leido == 0) {
      try {
        await notificationAPI.markRead(notif.id);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, leido: 1 } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { /* ignore */ }
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
            onClick={() => setShowNotif(!showNotif)}
            title="Notificaciones"
          >
            <i className="fa-solid fa-bell" style={{ fontSize: '15px', color: 'var(--text-muted)' }}></i>
            {unreadCount > 0 && (
              <span className="badge-notification">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {showNotif && (
              <div className="notification-dropdown active" onClick={(e) => e.stopPropagation()}>
                <div className="notif-header">
                  <h4>Notificaciones</h4>
                  <div className="flex gap-1.5 items-center">
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
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No tienes notificaciones recientes</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.leido == 0 && n.tipo !== 'global' ? 'unread' : ''} ${n.leido == 0 ? 'slide-in' : ''}`}
                        onClick={() => markAsRead(n)}
                      >
                        <div className="notif-title">
                          {n.tipo === 'global'
                            ? <i className="fa-solid fa-earth-americas" style={{ color: 'var(--info-color)' }}></i>
                            : <i className="fa-solid fa-user" style={{ color: 'var(--primary-color)' }}></i>}
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.titulo}
                          </span>
                          {n.leido == 0 && n.tipo !== 'global' && (
                            <span className="ui-pill pill-emerald" style={{ padding: '2px 8px', fontSize: '10px' }}>Nuevo</span>
                          )}
                        </div>
                        <div className="notif-msg">{stripHtml(n.mensaje)}</div>
                        <div className="notif-meta">
                          <span>{n.remitente_nombre}</span>
                          <span>{n.fecha ? new Date(n.fecha).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    ))
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
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowReadModal(false); }}>
          <div className="modal-content" style={{ width: '520px', maxWidth: '95vw' }}>
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
              <div className="detail-row" style={{ marginBottom: '16px' }}>
                <span>
                  <i className="fa-solid fa-user" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
                  De: <strong style={{ color: 'var(--text-color)' }}>{readingNotif.remitente_nombre}</strong>
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
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReadModal(false)}>
                Cerrar
              </button>
              {readingNotif.id_remitente && (
                <button type="button" className="btn btn-primary" onClick={replyToNotification}>
                  <i className="fa-solid fa-reply"></i> Responder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENVIAR NOTIFICACIÓN */}
      {showSendModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowSendModal(false); }}>
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
