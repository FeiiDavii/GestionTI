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
      showToast(err.message || 'Credenciales incorrectas', 'error');
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
        showToast(res.data.message || 'Revisa tu correo', 'success');
        setShowRecovery(false);
        setRecoveryUsername('');
      } else {
        showToast(res.data.message || 'No se pudo procesar', 'warning');
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <>
      <div className="login-wrapper">
        <div className="login-left">
          <div className="login-header">
            <h2>Login</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Usuario o Correo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required minLength={3}
              />
            </div>

            <div className="input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required minLength={4}
              />
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                onClick={() => setShowPassword(!showPassword)}
                style={{ cursor: 'pointer' }}></i>
            </div>

            <div className="form-actions">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" /> Recordarme
              </label>
              <a href="#" className="forgot-pass"
                onClick={(e) => { e.preventDefault(); setShowRecovery(true); }}>
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>

            <div className="signup-link">
              Sistema de Gestión de Inventario v3.9.0
            </div>
          </form>
        </div>

        <div className="login-right">
          <div className="illustration" style={{
            width: '80%', maxWidth: '300px', marginBottom: '20px',
            animation: 'float 6s ease-in-out infinite',
          }}>
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="40" y="30" width="120" height="140" rx="8" fill="#4a6cf7" opacity="0.15"/>
              <rect x="50" y="40" width="100" height="80" rx="4" fill="#4a6cf7" opacity="0.3"/>
              <circle cx="100" cy="95" r="25" fill="#4a6cf7" opacity="0.2"/>
              <circle cx="100" cy="95" r="12" fill="#4a6cf7"/>
              <rect x="55" y="135" width="30" height="4" rx="2" fill="#4a6cf7" opacity="0.4"/>
              <rect x="55" y="145" width="60" height="4" rx="2" fill="#4a6cf7" opacity="0.3"/>
              <rect x="55" y="155" width="45" height="4" rx="2" fill="#4a6cf7" opacity="0.2"/>
            </svg>
          </div>
          <h3>Gestión Centralizada</h3>
          <p>Control total de equipos, asignaciones y auditoría en una sola plataforma.</p>
          <div style={{ marginTop: '20px', display: 'flex', gap: '5px' }}>
            <span style={{ width: '25px', height: '4px', background: '#4a6cf7', borderRadius: '2px' }}></span>
            <span style={{ width: '25px', height: '4px', background: '#dfe3f8', borderRadius: '2px' }}></span>
            <span style={{ width: '25px', height: '4px', background: '#dfe3f8', borderRadius: '2px' }}></span>
          </div>
        </div>
      </div>

      {showRecovery && (
        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowRecovery(false)}>
          <div className="modal-content" style={{ width: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                <i className="fa-solid fa-key" style={{ color: 'var(--primary-color)' }}></i> Recuperar Acceso
              </h3>
              <button className="action-btn" onClick={() => setShowRecovery(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px', lineHeight: 1.5 }}>
              Ingresa tu nombre de usuario. El sistema enviará una notificación automática a los administradores.
            </p>
            <form onSubmit={handleRecovery}>
              <div className="form-group">
                <label>Nombre de Usuario</label>
                <input type="text" className="form-control" value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  placeholder="Ej: jperez" required minLength={3} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="button" className="action-btn" onClick={() => setShowRecovery(false)}
                  style={{ marginRight: '5px' }}>Cancelar</button>
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
