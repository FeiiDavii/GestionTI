import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';
import { showToast } from '../core/toast';

export default function Perfil() {
  const { user, permisos } = useAuth();
  const [loadingStats, setLoadingStats] = useState(true);

  const [stats, setStats] = useState({
    tickets_creados: 0,
    tickets_resueltos: 0,
    equipos_asignados: 0,
    mantenimientos_realizados: 0,
    ultimo_acceso: null,
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await authAPI.profileStats();
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch {
      setStats(prev => ({ ...prev, ultimo_acceso: user?.ultimo_acceso || null }));
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePassChange = (field, value) => {
    setPassForm(prev => ({ ...prev, [field]: value }));
  };

  const validatePassword = (pass) => {
    if (pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(pass)) return 'La contraseña debe contener al menos una letra mayúscula';
    if (!/[a-z]/.test(pass)) return 'La contraseña debe contener al menos una letra minúscula';
    if (!/[0-9]/.test(pass)) return 'La contraseña debe contener al menos un número';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*...)';
    return null;
  };

  const handleSavePassword = async () => {
    if (!passForm.actual) { showToast('Por favor ingresa tu contraseña actual', 'warning'); return; }
    if (!passForm.nueva) { showToast('Por favor ingresa tu nueva contraseña', 'warning'); return; }
    if (!passForm.confirmar) { showToast('Por favor confirma tu nueva contraseña', 'warning'); return; }
    if (passForm.nueva !== passForm.confirmar) { showToast('La nueva contraseña y la confirmación no coinciden', 'warning'); return; }
    if (passForm.actual === passForm.nueva) { showToast('La nueva contraseña no puede ser igual a la actual', 'warning'); return; }
    const err = validatePassword(passForm.nueva);
    if (err) { showToast(err, 'warning'); return; }

    setPassLoading(true);
    try {
      const res = await authAPI.changePassword({
        current_password: passForm.actual,
        new_password: passForm.nueva,
        confirm_password: passForm.confirmar,
      });
      if (res.data.success) {
        showToast(res.data.message || 'Contraseña actualizada exitosamente', 'success');
        setShowPasswordModal(false);
        setPassForm({ actual: '', nueva: '', confirmar: '' });
      } else {
        showToast(res.data.message || 'Error al cambiar la contraseña', 'error');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al cambiar la contraseña';
      showToast(errorMessage, 'error');
    } finally {
      setPassLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca';
    try {
      return new Date(dateStr).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  };

  const getRoleName = () => {
    if (!permisos) return 'Usuario';
    if (permisos.conf_basica) return 'Administrador';
    if (permisos.inv_crear_editar) return 'Gestor de Inventario';
    if (permisos.tk_ver_global) return 'Soporte Técnico';
    if (permisos.tk_crear) return 'Usuario';
    return 'Usuario';
  };

  const statCards = [
    { label: 'Tickets Creados',   value: stats.tickets_creados,          icon: 'fa-ticket',        color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { label: 'Tickets Resueltos', value: stats.tickets_resueltos,        icon: 'fa-check-circle',  color: 'var(--success-color)', bg: 'var(--success-bg)' },
    { label: 'Equipos Asignados', value: stats.equipos_asignados,        icon: 'fa-server',        color: 'var(--warning-color)', bg: 'var(--warning-bg)' },
    { label: 'Mantenimientos',    value: stats.mantenimientos_realizados,icon: 'fa-wrench',        color: 'var(--info-color)',    bg: 'var(--info-bg)' },
  ];

  return (
    <div className="inventory-module">
      {/* Header */}
      <div className="inventory-header">
        <div className="page-title-row">
          <div>
            <h2><i className="fa-solid fa-user-gear"></i> Mi Perfil</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '2px 0 0' }}>
              Información personal, métricas de actividad y seguridad de tu cuenta
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowPasswordModal(true)}>
          <i className="fa-solid fa-key"></i> Cambiar Contraseña
        </button>
      </div>

      <div className="settings-card">
        <div className="card-body" style={{ padding: '24px' }}>
          {/* Profile hero card */}
          <div style={{
            display: 'flex', gap: '24px', padding: '24px', borderRadius: '16px',
            background: 'var(--surface-secondary)', border: '1px solid var(--border-color)',
            marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center',
          }}>
            {/* Avatar + nombre + rol */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: '240px' }}>
              <div style={{
                width: '76px', height: '76px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--primary-color)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px', fontWeight: 700,
                border: '3px solid var(--card-bg)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                {getInitials(user?.nombre)}
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)' }}>
                  {user?.nombre || 'Usuario'}
                </h3>
                <span className="ui-pill pill-indigo">
                  <i className="fa-solid fa-user-tag"></i> {getRoleName()}
                </span>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{
              flex: 1, display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px', minWidth: '280px',
            }}>
              {statCards.map((s) => (
                <div key={s.label} style={{
                  padding: '16px', borderRadius: '14px',
                  background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: s.bg, color: s.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                  }}>
                    <i className={`fa-solid ${s.icon}`}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-color)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                      {loadingStats ? (
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '16px', color: 'var(--primary-color)' }}></i>
                      ) : s.value}
                    </div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--gray-text)', marginTop: '3px' }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Datos de usuario */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 14px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-color)' }}></i>
              Datos de la Cuenta
            </h3>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px',
              background: 'var(--surface-secondary)', padding: '20px', borderRadius: '14px',
              border: '1px solid var(--border-color)',
            }}>
              {/* Nombre completo */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Nombre Completo
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-color)' }}>
                  {user?.nombre || '—'}
                </div>
              </div>

              {/* Username */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Nombre de Usuario
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-color)' }}>
                  <i className="fa-solid fa-at" style={{ color: 'var(--primary-color)', fontSize: '12px', marginRight: '4px' }}></i>
                  {user?.username || '—'}
                </div>
              </div>

              {/* Rol */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Rol Asignado
                </div>
                <span className="ui-pill pill-indigo">
                  {getRoleName()}
                </span>
              </div>

              {/* Último acceso */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Último Acceso
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)' }}>
                  <i className="fa-solid fa-clock" style={{ color: 'var(--gray-text)', fontSize: '12px', marginRight: '5px' }}></i>
                  {formatDate(stats.ultimo_acceso || user?.ultimo_acceso)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal cambio de contraseña */}
      {showPasswordModal && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowPasswordModal(false);
            setPassForm({ actual: '', nueva: '', confirmar: '' });
          }
        }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-key" style={{ color: 'var(--primary-color)' }}></i>
                Cambiar Contraseña
              </h3>
              <button type="button" className="btn-icon btn-ghost" onClick={() => {
                setShowPasswordModal(false);
                setPassForm({ actual: '', nueva: '', confirmar: '' });
              }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--gray-text)', marginBottom: '18px' }}>
                La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y carácter especial.
              </p>

              <div className="form-group">
                <label>Contraseña Actual</label>
                <input className="form-control" type="password"
                  placeholder="Tu contraseña actual"
                  value={passForm.actual}
                  onChange={(e) => handlePassChange('actual', e.target.value)}
                  autoFocus />
              </div>

              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input className="form-control" type="password"
                  placeholder="Mín. 8 caracteres"
                  value={passForm.nueva}
                  onChange={(e) => handlePassChange('nueva', e.target.value)} />
                {passForm.nueva && (
                  <ul style={{ fontSize: '0.78rem', margin: '8px 0 0', paddingLeft: '4px', listStyle: 'none' }}>
                    {[
                      [passForm.nueva.length >= 8, 'Mínimo 8 caracteres'],
                      [/[A-Z]/.test(passForm.nueva), 'Una mayúscula'],
                      [/[a-z]/.test(passForm.nueva), 'Una minúscula'],
                      [/[0-9]/.test(passForm.nueva), 'Un número'],
                      [/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passForm.nueva), 'Un carácter especial'],
                    ].map(([ok, label]) => (
                      <li key={label} style={{ color: ok ? 'var(--success-color)' : 'var(--gray-text)', marginBottom: '3px', fontWeight: ok ? 600 : 400 }}>
                        <i className={`fa-solid ${ok ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-group">
                <label>Confirmar Nueva Contraseña</label>
                <input className="form-control" type="password"
                  placeholder="Repite la nueva contraseña"
                  value={passForm.confirmar}
                  onChange={(e) => handlePassChange('confirmar', e.target.value)} />
                {passForm.confirmar && passForm.nueva !== passForm.confirmar && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--error-color)', marginTop: '5px', fontWeight: 600 }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '4px' }}></i>
                    Las contraseñas no coinciden
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowPasswordModal(false);
                setPassForm({ actual: '', nueva: '', confirmar: '' });
              }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSavePassword} disabled={passLoading}>
                <i className={`fa-solid ${passLoading ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}></i>
                {passLoading ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
