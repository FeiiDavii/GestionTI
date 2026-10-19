import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { showToast } from '../core/toast';
import { authAPI } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  React.useEffect(() => {
    // Mapeo de códigos de motivo a mensajes de alerta
    const REASON_MESSAGES = {
      1: {
        title: 'Sesión Finalizada',
        text: 'El administrador ha cerrado tu sesión de forma remota.',
        icon: 'warning',
        iconColor: '#f6c23e',
      },
      2: {
        title: 'Cuenta Desactivada',
        text: 'Tu cuenta ha sido desactivada por un administrador. Comunícate con el soporte si crees que es un error.',
        icon: 'error',
        iconColor: '#e74a3b',
      },
      3: {
        title: 'Permisos Actualizados',
        text: 'Tus permisos o rol han sido modificados. Por favor, inicia sesión nuevamente para aplicar los cambios.',
        icon: 'info',
        iconColor: '#4a6cf7',
      },
    };

    const reasonCode = parseInt(searchParams.get('reason'), 10);
    if (reasonCode && REASON_MESSAGES[reasonCode]) {
      const { title, text, icon, iconColor } = REASON_MESSAGES[reasonCode];
      Swal.fire({
        icon,
        iconColor,
        title,
        text,
        confirmButtonColor: '#4a6cf7',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Compatibilidad con parámetro legacy ?error=
    const error = searchParams.get('error');
    if (error) {
      let msg = 'Credenciales incorrectas';
      let icon = 'error';
      let title = 'Error';
      if (error === 'permissions_updated') {
        msg = 'Tus permisos han sido actualizados. Por favor, inicia sesión nuevamente.';
        icon = 'info';
        title = 'Sesión Actualizada';
      } else if (error === 'session_expired') {
        msg = 'Tu sesión ha expirado. Por favor, ingresa de nuevo.';
        title = 'Sesión Expirada';
      }
      Swal.fire({ icon, title, text: msg, confirmButtonColor: '#4a6cf7' });
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.success) {
        navigate(res.redirect || '/dashboard');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al intentar iniciar sesión';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);
    try {
      const res = await authAPI.recovery(recoveryUsername);
      if (res.data.success) {
        showToast(res.data.message || 'Solicitud enviada correctamente', 'success');
        setShowRecovery(false);
        setRecoveryUsername('');
      } else {
        showToast(res.data.message || 'No se pudo procesar la solicitud', 'warning');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error de conexión al servidor';
      showToast(errorMessage, 'error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <>
      <div className="login-wrapper">
        <div className="login-left">
          <div className="login-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <i className="fa-solid fa-microchip" style={{ color: 'var(--primary-color)', fontSize: '18px' }}></i>
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>GestionTI OPS</span>
            </div>
            <h2>Iniciar Sesión</h2>
            <p className="login-subtitle">Ingresa tus credenciales para acceder a la consola central.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Usuario o Identificador</label>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="ej. operador.ti"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required minLength={3}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contraseña</label>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={4}
                />
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ cursor: 'pointer' }}></i>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '16px' }}>
              <a href="#" className="forgot-pass"
                onClick={(e) => { e.preventDefault(); setShowRecovery(true); }}>
                ¿Problemas de acceso?
              </a>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Autenticando...</> : 'Acceder al Sistema'}
            </button>

            <div className="signup-link">
              GESTION TI // ENTERPRISE CORE v3.10.0
            </div>
          </form>
        </div>

        <div className="login-right">
          <div className="login-right-content">
            <div style={{
              width: '84px',
              height: '84px',
              margin: '0 auto 20px',
              background: 'var(--primary-light)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-color)',
              fontSize: '36px'
            }}>
              <i className="fa-solid fa-network-wired"></i>
            </div>
            <h3>Operaciones & Infraestructura</h3>
            <p>Monitoreo unificado de inventario tecnológico, ciclo de vida de tickets y topología de red en tiempo real.</p>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
              <span style={{ border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: '4px' }}>ITSM 2.0</span>
              <span style={{ border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: '4px' }}>ITAM CORE</span>
              <span style={{ border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: '4px' }}>SSE TELEMETRY</span>
            </div>
          </div>
        </div>
      </div>

      {showRecovery && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowRecovery(false)}>
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-key" style={{ color: 'var(--primary-color)' }}></i> Recuperar Acceso
              </h3>
              <button className="action-btn" onClick={() => setShowRecovery(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleRecovery}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--gray-text)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Ingresa tu nombre de usuario. El sistema enviará una notificación automática a los administradores.
                </p>
                <div className="form-group">
                  <label>Nombre de Usuario</label>
                  <input type="text" className="form-control" value={recoveryUsername}
                    onChange={(e) => setRecoveryUsername(e.target.value)}
                    placeholder="Ej: jperez" required minLength={3} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="action-btn" onClick={() => setShowRecovery(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save" disabled={recoveryLoading}>
                  <i className="fa-solid fa-paper-plane"></i> {recoveryLoading ? 'Enviando...' : 'Notificar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
