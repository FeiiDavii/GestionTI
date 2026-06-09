import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { searchAPI, notificationAPI, auxAPI } from '../../api/client';
import Swal from 'sweetalert2';
import { showToast } from '../../core/toast';
import DOMPurify from 'dompurify';

// ─── Sanitiza HTML del mensaje y convierte links del sistema original ─────────
// El backend almacena HTML con links como /gestion-tickets?ticket_id=X
// DOMPurify elimina scripts/eventos maliciosos pero conserva <a>, <b>, <br>, <i>
function sanitizeMsg(html) {
  if (!html) return '';
  // Convertir links del sistema PHP original a rutas React
  // gestion_tickets.php?ticket_id=X  →  /gestion-tickets?ticket_id=X
  // tickets.php?ticket_id=X          →  /tickets?ticket_id=X
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

// Extrae texto plano del HTML para el preview en el dropdown
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function TopBar({ onToggleMobile }) {
  const { user, permisos, esAdministrativo, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    setNotifications,
    setUnreadCount,
    setMuted: setRealtimeMuted,
    mutedRef,
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

  // Sincronizar mute con el contexto de tiempo real
  const handleToggleMute = (e) => {
    e.stopPropagation();
    const newVal = !muted;
    setMuted(newVal);
    setRealtimeMuted(newVal);
  };

  // Interceptar clicks en links del modal para navegar con React Router
  // (los links generados por el backend apuntan a rutas React internas)
  const handleMsgBodyClick = useCallback((e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    // Si es un link interno de React (empieza con /)
    if (href.startsWith('/')) {
      e.preventDefault();
      setShowReadModal(false);
      navigate(href);
    }
    // Links externos se abren normalmente
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
    // Marcar como leída en background y actualizar estado local
    if (notif.leido == 0 && notif.tipo !== 'global') {
      try {
        await notificationAPI.markRead(notif.id);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, leido: 1 } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
  };

  const loadUsers = async () => {
    try {
      const res = await auxAPI.users();
      if (res.data.success) setUsers(res.data.data.users || []);
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
    } catch (err) {
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
      <div className="flex items-center gap-[15px] flex-grow">
        <button className="mobile-menu-btn" onClick={onToggleMobile}>
          <i className="fa-solid fa-bars"></i>
        </button>

        <div className="search-box" ref={searchRef}>
          {esAdministrativo() && (
            <>
              <i className="fa-solid fa-magnifying-glass" style={{ color: '#888' }}></i>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.trim().length >= 2 && setShowSearch(true)}
                onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
              />
              {showSearch && (
                <div className="search-results-container active">
                  {searchResults.length === 0 ? (
                    <div className="p-5 text-center text-[#888]">
                      <i className="fa-solid fa-search text-2xl mb-2 opacity-50"></i>
                      <div>No se encontraron resultados</div>
                    </div>
                  ) : (
                    searchResults.map((item, idx) => (
                      <a key={idx} href={item.url} className="search-item"
                        onClick={(e) => { e.preventDefault(); navigate(item.url); setShowSearch(false); }}>
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
                    <div className="p-2.5 border-t border-[var(--border-color)] flex justify-between items-center">
                      <small className="text-[#888]">{searchResults.length} resultado(s)</small>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="notification-wrapper" ref={notifRef}
        style={{ marginRight: '25px', position: 'relative', cursor: 'pointer' }}>
        <i className="fa-regular fa-bell" style={{ fontSize: '20px', color: '#555' }}
          onClick={() => setShowNotif(!showNotif)}></i>
        {unreadCount > 0 && (
          <span className="badge-notification" style={{ display: 'block' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {showNotif && (
          <div className="notification-dropdown" style={{ display: 'block' }}>
            <div className="notif-header">
              <h4>Notificaciones</h4>
              <div className="flex gap-2.5 items-center">
                <i className={`fa-solid ${muted ? 'fa-volume-xmark' : 'fa-bell'}`}
                  style={{ cursor: 'pointer', color: muted ? '#888' : 'var(--primary-color)', fontSize: '14px' }}
                  onClick={handleToggleMute}>
                </i>
                {(permisos.conf_basica || permisos.conf_roles) && (
                  <button className="action-btn" style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={openSendModal}>
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
                  <div key={n.id}
                    className={`notif-item ${n.leido == 0 && n.tipo !== 'global' ? 'unread' : ''} ${n.leido == 0 ? 'slide-in' : ''}`}
                    onClick={() => markAsRead(n)}>
                    <div className="notif-title">
                      {n.tipo === 'global'
                        ? <i className="fa-solid fa-earth-americas" style={{ color: 'var(--info-color)' }}></i>
                        : <i className="fa-solid fa-user" style={{ color: 'var(--primary-color)' }}></i>}
                      {' '}{n.titulo}
                      {n.leido == 0 && n.tipo !== 'global' && (
                        <small style={{ float:'right', color:'red', fontSize:'9px', fontWeight:'bold' }}>NUEVO</small>
                      )}
                    </div>
                    {/* Preview en texto plano — el HTML completo se ve al abrir el modal */}
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

      <div className="user-profile" ref={profileRef}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
          onClick={() => setShowProfile(!showProfile)}>
          <div className="user-info" style={{ textAlign: 'right', marginRight: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{user?.nombre || 'Usuario'}</h4>
            <small style={{ color: '#888', fontSize: '11px' }}>{user?.username}</small>
          </div>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nombre || 'U')}&background=random&color=fff&size=128`}
            alt="Avatar"
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
          />
          <i className="fa-solid fa-chevron-down" style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}></i>

          {showProfile && (
            <div className="profile-dropdown" style={{ display: 'block', opacity: 1, visibility: 'visible', transform: 'translateY(0)' }}>
              <Link to="/perfil" className="dropdown-item" onClick={() => setShowProfile(false)}>
                <i className="fa-regular fa-user"></i> <span>Mi Perfil</span>
              </Link>
              {(permisos.conf_basica || permisos.conf_roles || permisos.rep_generar) && (
                <Link to="/configuracion?tab=sistema" className="dropdown-item" onClick={() => setShowProfile(false)}>
                  <i className="fa-solid fa-server"></i> <span>Auditoría</span>
                </Link>
              )}
              <div className="dropdown-divider"></div>
              <a href="#" className="dropdown-item" style={{ color: '#dc3545' }}
                onClick={(e) => { e.preventDefault(); logout(); }}>
                <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>Cerrar Sesión</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>

      {/* MODAL LEER NOTIFICACIÓN */}
      {showReadModal && readingNotif && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowReadModal(false); }}>
          <div className="modal-content" style={{ width: '520px', padding: '0', overflow: 'hidden', borderRadius: '20px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(74,108,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', fontSize: '16px' }}>
                  <i className="fa-solid fa-envelope-open-text"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>{readingNotif.titulo}</h3>
                  <small style={{ color: 'var(--gray-text)', fontSize: '12px' }}>Mensaje del sistema</small>
                </div>
              </div>
              <button className="action-btn" onClick={() => setShowReadModal(false)} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div style={{ padding: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--gray-text)', marginBottom: '15px', background: 'var(--input-bg)', padding: '12px 15px', borderRadius: '10px' }}>
                <span><i className="fa-solid fa-user" style={{ marginRight: '5px' }}></i>De: <strong style={{ color: 'var(--text-color)' }}>{readingNotif.remitente_nombre}</strong></span>
                <span><i className="fa-regular fa-clock" style={{ marginRight: '5px' }}></i>{new Date(readingNotif.fecha).toLocaleString()}</span>
              </div>
              <div className="notif-msg-body" style={{ background: 'var(--card-bg)', padding: '18px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-color)', border: '1px solid var(--border-color)', minHeight: '80px' }}
                ref={msgBodyRef}
                onClick={handleMsgBodyClick}
                dangerouslySetInnerHTML={{ __html: sanitizeMsg(readingNotif.mensaje) }}
              />
            </div>
            <div style={{ padding: '15px 25px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--input-bg)' }}>
              <button type="button" className="action-btn" onClick={() => setShowReadModal(false)} style={{ padding: '10px 20px' }}>Cerrar</button>
              {readingNotif.id_remitente && (
                <button type="button" className="btn-save" onClick={replyToNotification} style={{ padding: '10px 20px' }}>
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
          <div className="modal-content" style={{ width: '520px', padding: '0', overflow: 'hidden', borderRadius: '20px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(74,108,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', fontSize: '16px' }}>
                  <i className="fa-solid fa-paper-plane"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color)' }}>Nuevo Comunicado</h3>
                  <small style={{ color: 'var(--gray-text)', fontSize: '12px' }}>Enviar notificación a usuarios</small>
                </div>
              </div>
              <button className="action-btn" onClick={() => setShowSendModal(false)} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSendNotif} style={{ padding: '25px' }}>
              <div className="form-group">
                <label><i className="fa-solid fa-heading" style={{ marginRight: '5px', color: 'var(--primary-color)' }}></i>Título <span style={{ color: 'var(--error-color)' }}>*</span></label>
                <input type="text" className="form-control" required placeholder="Asunto del comunicado..."
                  value={sendForm.titulo}
                  onChange={(e) => setSendForm({ ...sendForm, titulo: e.target.value })} />
              </div>
              <div className="form-group">
                <label><i className="fa-solid fa-users" style={{ marginRight: '5px', color: 'var(--primary-color)' }}></i>Tipo de Envío</label>
                <select className="form-control"
                  value={sendForm.tipo}
                  onChange={(e) => setSendForm({ ...sendForm, tipo: e.target.value })}>
                  {permisos.conf_roles && <option value="global">Global (Todos los usuarios)</option>}
                  <option value="personal">Directo (Un usuario específico)</option>
                </select>
              </div>
              {sendForm.tipo === 'personal' && (
                <div className="form-group">
                  <label><i className="fa-solid fa-user-check" style={{ marginRight: '5px', color: 'var(--primary-color)' }}></i>Destinatario <span style={{ color: 'var(--error-color)' }}>*</span></label>
                  <select className="form-control" required
                    value={sendForm.id_destinatario}
                    onChange={(e) => setSendForm({ ...sendForm, id_destinatario: e.target.value })}>
                    <option value="">-- Seleccione un usuario --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label><i className="fa-solid fa-message" style={{ marginRight: '5px', color: 'var(--primary-color)' }}></i>Mensaje <span style={{ color: 'var(--error-color)' }}>*</span></label>
                <textarea className="form-control" rows="4" required placeholder="Escriba aquí el contenido del mensaje..."
                  value={sendForm.mensaje}
                  onChange={(e) => setSendForm({ ...sendForm, mensaje: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('sendNotifBtn').click(); } }}>
                </textarea>
                <small style={{ color: 'var(--gray-text)', fontSize: '11px', marginTop: '5px', display: 'block' }}>
                  <i className="fa-solid fa-circle-info"></i> Presiona <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para nueva línea.
                </small>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '5px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="action-btn" onClick={() => setShowSendModal(false)} style={{ padding: '10px 20px' }}>Cancelar</button>
                <button id="sendNotifBtn" type="submit" className="btn-save" style={{ padding: '10px 25px' }} disabled={sendingNotif}>
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
