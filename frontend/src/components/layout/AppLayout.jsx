import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigate = useNavigate();
  const { permisos, esAdministrativo } = useAuth();

  useEffect(() => {
    const dark = localStorage.getItem('darkMode') === 'true';
    const compact = localStorage.getItem('sidebarCompact') === 'true';

    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.classList.toggle('sidebar-compact', compact);
    document.documentElement.classList.remove('sidebar-compact-pending');

    setTimeout(() => setLoaded(true), 100);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.shiftKey && e.key === 'Enter') {
        const activeElement = document.activeElement;
        const form = activeElement?.closest('form') || document.querySelector('form');
        if (form) {
          e.preventDefault();
          const submitBtn = form.querySelector('[type="submit"]') || form.querySelector('.btn-save, .btn-primary');
          if (submitBtn) submitBtn.click();
          else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          return;
        }
      }

      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        const closeBtn = document.querySelector('.modal-overlay.active .action-btn i.fa-times, .modal-overlay.active .btn-icon i.fa-times, .modal-overlay.active .close-btn');
        if (closeBtn) closeBtn.closest('button')?.click();
        return;
      }

      if (e.altKey && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

      if (e.altKey && e.shiftKey && !isInput) {
        const key = e.key.toLowerCase();

        if (key === 'n') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('shortcut:new'));
          return;
        }
        if (key === 'k') {
          e.preventDefault();
          document.querySelector('.search-box input')?.focus();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          document.querySelector('.btn-next:not([disabled])')?.click();
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          document.querySelector('.btn-prev:not([disabled])')?.click();
          return;
        }

        if (!esAdministrativo()) {
          if (key === 'm') { e.preventDefault(); navigate('/tickets'); }
          if (key === 'c') { e.preventDefault(); navigate('/configuracion'); }
          return;
        }

        let navigated = true;
        switch (key) {
          case 'd': navigate('/dashboard'); break;
          case 'a': if (permisos?.inv_asignaciones) navigate('/asignaciones'); break;
          case 'i': if (permisos?.inv_ver) navigate('/equipos'); break;
          case 'l': if (permisos?.inv_licencias) navigate('/licencias'); break;
          case 'b': if (permisos?.inv_bajas) navigate('/bajas'); break;
          case 'm': if (permisos?.tk_crear) navigate('/tickets'); break;
          case 'g': if (permisos?.tk_ver_global || permisos?.tk_responder) navigate('/gestion-tickets'); break;
          case 'h': if (permisos?.tk_mantenimientos) navigate('/mantenimientos'); break;
          case 'r': if (permisos?.rep_generar) navigate('/reportes'); break;
          case 'c': if (permisos?.conf_basica || permisos?.conf_roles || permisos?.usr_ver || permisos?.conf_sla) navigate('/configuracion'); break;
          default: navigated = false; break;
        }

        if (navigated) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, permisos, esAdministrativo, showShortcuts]);

  const operationalShortcuts = [
    { icon: 'fa-paper-plane', label: 'Guardado rápido / Enviar', keys: 'Alt + Shift + Enter' },
    { icon: 'fa-xmark', label: 'Cerrar modal activo', keys: 'Esc' },
    { icon: 'fa-plus', label: 'Crear nuevo registro', keys: 'Alt + Shift + N' },
    { icon: 'fa-magnifying-glass', label: 'Búsqueda global', keys: 'Alt + Shift + K' },
    { icon: 'fa-angle-right', label: 'Cambiar página (siguiente)', keys: 'Alt + Shift + →' },
    { icon: 'fa-angle-left', label: 'Cambiar página (anterior)', keys: 'Alt + Shift + ←' },
    { icon: 'fa-circle-question', label: 'Mostrar comandos', keys: 'Alt + ?' },
  ];

  const navShortcuts = [
    { icon: 'fa-house', label: 'Dashboard', keys: 'Alt + Shift + D' },
    { icon: 'fa-headset', label: 'Mesa de Servicios', keys: 'Alt + Shift + M' },
    { icon: 'fa-ticket', label: 'Gestión de Tickets', keys: 'Alt + Shift + G' },
    { icon: 'fa-desktop', label: 'Inventario General', keys: 'Alt + Shift + I' },
    { icon: 'fa-microchip', label: 'Asignaciones', keys: 'Alt + Shift + A' },
    { icon: 'fa-brands fa-windows', label: 'Licencias', keys: 'Alt + Shift + L', isBrand: true },
    { icon: 'fa-box-archive', label: 'Bajas', keys: 'Alt + Shift + B' },
    { icon: 'fa-clipboard-list', label: 'Hojas de Vida', keys: 'Alt + Shift + H' },
    { icon: 'fa-chart-pie', label: 'Reportes', keys: 'Alt + Shift + R' },
    { icon: 'fa-gear', label: 'Configuración', keys: 'Alt + Shift + C' },
  ];

  return (
    <div className={`dashboard-container ${loaded ? 'loaded' : ''}`}>
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main className="main-content">
        <TopBar
          onToggleMobile={() => setMobileOpen(!mobileOpen)}
          onOpenShortcuts={() => setShowShortcuts(true)}
        />
        {children}
      </main>

      {/* MODAL DE ATAJOS DE TECLADO */}
      {showShortcuts && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowShortcuts(false); }}>
          <div className="modal-content" style={{ width: '800px', maxWidth: '95vw' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-regular fa-keyboard"></i>
                Atajos del Sistema
              </h3>
              <button className="btn-icon" onClick={() => setShowShortcuts(false)} aria-label="Cerrar">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '28px' }}>
              <div className="shortcuts-section">
                <div className="form-section-title">
                  <i className="fa-solid fa-bolt"></i>
                  Acciones Operativas
                </div>
                <div className="detail-list">
                  {operationalShortcuts.map((item, idx) => (
                    <div key={idx} className="detail-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-color)' }}>
                        <i className={`fa-solid ${item.icon}`} style={{ color: 'var(--text-muted)', width: '16px', textAlign: 'center' }}></i>
                        {item.label}
                      </span>
                      <kbd className="ui-pill pill-blue" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shortcuts-section">
                <div className="form-section-title">
                  <i className="fa-solid fa-route"></i>
                  Navegación Rápida
                </div>
                <div className="detail-list">
                  {navShortcuts.map((item, idx) => (
                    <div key={idx} className="detail-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-color)' }}>
                        <i className={`${item.isBrand ? '' : 'fa-solid '}${item.icon}`} style={{ color: 'var(--text-muted)', width: '16px', textAlign: 'center' }}></i>
                        {item.label}
                      </span>
                      <kbd className="ui-pill pill-emerald" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowShortcuts(false)}>
                Cerrar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
