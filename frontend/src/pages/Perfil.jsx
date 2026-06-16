import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';
import { showToast } from '../core/toast';
import Swal from 'sweetalert2';

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
      // Si falla el endpoint, al menos mostrar ultimo_acceso del contexto
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
    { label: 'Tickets Creados',   value: stats.tickets_creados,          icon: 'fa-ticket',        color: 'var(--primary-color)' },
    { label: 'Resueltos',         value: stats.tickets_resueltos,         icon: 'fa-check-circle',  color: 'var(--success-color)' },
    { label: 'Equipos',           value: stats.equipos_asignados,         icon: 'fa-server',        color: 'var(--warning-color)' },
    { label: 'Mtto.',             value: stats.mantenimientos_realizados, icon: 'fa-wrench',        color: 'var(--info-color)' },
  ];

  return (
    <div className="settings-card">
      {/* Header */}
      <div className="card-header">
        <div>
          <h2><i className="fa-solid fa-user-gear"></i> Mi Perfil</h2>
          <p style={{ fontSize: '13px', color: 'var(--gray-text)', margin: '4px 0 0' }}>
            Información personal y configuración de cuenta
          </p>
        </div>
        <button className="btn-save" onClick={() => setShowPasswordModal(true)}>
          <i className="fa-solid fa-key"></i> Cambiar Contraseña
        </button>
      </div>

      {/* Profile hero card */}
      <div style={{
        display: 'flex', gap: '24px', padding: '24px', borderRadius: '16px',
        background: 'var(--input-bg)', border: '1px solid var(--border-color)',
        marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-start',
      }}>
        {/* Avatar + nombre + rol */}
        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '140px' }}>
          <div style={{
            width: '90px', height: '90px', borderRadius: '50%', margin: '0 auto',
            background: 'linear-gradient(135deg, var(--primary-color), var(--info-color))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', fontWeight: 700,
            border: '3px solid var(--card-bg)',
            boxShadow: '0 4px 15px var(--shadow-color)',
          }}>
            {getInitials(user?.nombre)}
          </div>
          <h3 style={{ margin: '12px 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>
            {user?.nombre || 'Usuario'}
          </h3>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 12px', borderRadius: '20px',
            background: 'rgba(74,108,247,0.12)', color: 'var(--primary-color)',
            fontSize: '12px', fontWeight: 600,
          }}>
            <i className="fa-solid fa-user-tag"></i> {getRoleName()}
          </span>
        </div>

        {/* Stat cards */}
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '12px', alignContent: 'start',
        }}>
          {statCards.map((s) => (
            <div key={s.label} style={{
              padding: '16px 12px', borderRadius: '12px',
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {loadingStats ? (
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '18px' }}></i>
                ) : s.value}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--gray-text)', marginTop: '6px' }}>
                <i className={`fa-solid ${s.icon}`} style={{ marginRight: '4px' }}></i>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Datos de usuario */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 14px', color: 'var(--text-color)' }}>
          <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-color)', marginRight: '6px' }}></i>
          Datos de Usuario
        </h3>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
          background: 'var(--input-bg)', padding: '20px', borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}>
          {/* Nombre completo */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
              Nombre Completo
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>
              {user?.nombre || '—'}
            </div>
          </div>

          {/* Username */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
              Nombre de Usuario
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-color)' }}>
              <i className="fa-solid fa-at" style={{ color: 'var(--primary-color)', fontSize: '12px', marginRight: '4px' }}></i>
              {user?.username || '—'}
            </div>
          </div>

          {/* Rol */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
              Rol
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: '6px',
              background: 'rgba(74,108,247,0.1)', color: 'var(--primary-color)', fontSize: '13px', fontWeight: 600,
            }}>
              {getRoleName()}
            </span>
          </div>

          {/* Último acceso */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-text)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
              Último Acceso
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
              <i className="fa-solid fa-clock" style={{ color: 'var(--gray-text)', fontSize: '12px', marginRight: '4px' }}></i>
              {formatDate(stats.ultimo_acceso || user?.ultimo_acceso)}
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
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-key" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                Cambiar Contraseña
              </h3>
              <button className="action-btn" onClick={() => {
                setShowPasswordModal(false);
                setPassForm({ actual: '', nueva: '', confirmar: '' });
              }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '12px', color: 'var(--gray-text)', marginBottom: '18px' }}>
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
                  <ul style={{ fontSize: '11px', margin: '6px 0 0', paddingLeft: '16px', listStyle: 'none' }}>
                    {[
                      [passForm.nueva.length >= 8, 'Mínimo 8 caracteres'],
                      [/[A-Z]/.test(passForm.nueva), 'Una mayúscula'],
                      [/[a-z]/.test(passForm.nueva), 'Una minúscula'],
                      [/[0-9]/.test(passForm.nueva), 'Un número'],
                      [/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passForm.nueva), 'Un carácter especial'],
                    ].map(([ok, label]) => (
                      <li key={label} style={{ color: ok ? 'var(--success-color)' : 'var(--gray-text)', marginBottom: '2px' }}>
                        <i className={`fa-solid ${ok ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '5px' }}></i>
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
                  <p style={{ fontSize: '11px', color: 'var(--error-color)', marginTop: '4px' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '4px' }}></i>
                    Las contraseñas no coinciden
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="action-btn" onClick={() => {
                setShowPasswordModal(false);
                setPassForm({ actual: '', nueva: '', confirmar: '' });
              }}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSavePassword} disabled={passLoading}>
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
