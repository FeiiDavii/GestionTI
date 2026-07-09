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
    // Aplicar preferencias guardadas al montar el layout
    const dark = localStorage.getItem('darkMode') === 'true';
    const compact = localStorage.getItem('sidebarCompact') === 'true';

    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.classList.toggle('sidebar-compact', compact);

    // Limpiar la clase temporal del script inline
    document.documentElement.classList.remove('sidebar-compact-pending');

    setTimeout(() => setLoaded(true), 100);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Atajos operativos globales
      
      // Alt + Shift + Enter (Guardar / Submit formulario activo)
      if (e.altKey && e.shiftKey && e.key === 'Enter') {
        const activeElement = document.activeElement;
        const form = activeElement?.closest('form') || document.querySelector('form');
        if (form) {
          e.preventDefault();
          const submitBtn = form.querySelector('[type="submit"]') || form.querySelector('.btn-save');
          if (submitBtn) submitBtn.click();
          else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          return;
        }
      }

      // Esc (Cerrar modales globales si los hay)
      if (e.key === 'Escape') {
        const closeBtn = document.querySelector('.modal-overlay.active .action-btn i.fa-times, .modal-overlay.active .close-btn');
        if (closeBtn) closeBtn.closest('button')?.click();
        return;
      }

      // Alt + ? (Mostrar modal de comandos)
      if (e.altKey && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      // Si estamos escribiendo en un input, ignoramos los siguientes atajos de navegación
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;
      
      // 2. Atajos de Navegación y Acciones (Requieren Alt + Shift)
      if (e.altKey && e.shiftKey && !isInput) {
        const key = e.key.toLowerCase();
        
        // Acciones operativas adicionales
        if (key === 'n') { // Nuevo registro
          e.preventDefault();
          document.querySelector('.fab-main')?.click();
          return;
        }
        if (key === 'k') { // Búsqueda global
          e.preventDefault();
          document.querySelector('.search-box input')?.focus();
          return;
        }
        if (e.key === 'ArrowRight') { // Siguiente página
          e.preventDefault();
          document.querySelector('.btn-next:not([disabled])')?.click();
          return;
        }
        if (e.key === 'ArrowLeft') { // Página anterior
          e.preventDefault();
          document.querySelector('.btn-prev:not([disabled])')?.click();
          return;
        }
        
        // Navegación de páginas
        if (!esAdministrativo()) {
          if (key === 'm') { e.preventDefault(); navigate('/tickets'); }
          if (key === 'c') { e.preventDefault(); navigate('/configuracion'); }
          return;
        }

        let navigated = true;
        switch (key) {
          case 'd': navigate('/dashboard'); break;
          case 'a': if (permisos?.inv_asignaciones) navigate('/asignaciones'); break;
          case 'i': if (permisos?.inv_ver) navigate('/equipos'); break; // Inventario general
          case 'l': if (permisos?.inv_licencias) navigate('/licencias'); break;
          case 'b': if (permisos?.inv_bajas) navigate('/bajas'); break;
          case 'm': if (permisos?.tk_crear) navigate('/tickets'); break; // Mesa de servicios
          case 'g': if (permisos?.tk_ver_global || permisos?.tk_responder) navigate('/gestion-tickets'); break;
          case 'h': if (permisos?.tk_mantenimientos) navigate('/mantenimientos'); break; // Hojas de vida
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
  }, [navigate, permisos, esAdministrativo]);

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
          <div className="modal-content" style={{ width: '800px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 4px 10px rgba(74, 108, 247, 0.3)' }}>
                  <i className="fa-regular fa-keyboard"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)' }}>Atajos del Sistema</h3>
                  <small style={{ color: 'var(--gray-text)', fontSize: '13px' }}>Aumenta tu productividad navegando rápidamente</small>
                </div>
              </div>
              <button className="action-btn" onClick={() => setShowShortcuts(false)} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '35px', background: 'var(--bg-color)', maxHeight: '70vh', overflowY: 'auto' }}>
              
              {/* Sección Operativa */}
              <div className="shortcuts-section">
                <h4 style={{ marginBottom: '20px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(231, 74, 59, 0.1)', color: 'var(--error-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-bolt"></i></span>
                  Acciones Operativas
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-paper-plane" style={{color: 'var(--gray-text)', width:'16px'}}></i> Guardado rápido / Enviar</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + Enter</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-xmark" style={{color: 'var(--gray-text)', width:'16px'}}></i> Cerrar modal activo</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Esc</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-plus" style={{color: 'var(--gray-text)', width:'16px'}}></i> Crear nuevo registro</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + N</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-magnifying-glass" style={{color: 'var(--gray-text)', width:'16px'}}></i> Búsqueda global</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + K</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-angle-right" style={{color: 'var(--gray-text)', width:'16px'}}></i> Cambiar página (siguiente)</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + →</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-angle-left" style={{color: 'var(--gray-text)', width:'16px'}}></i> Cambiar página (anterior)</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + ←</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-circle-question" style={{color: 'var(--gray-text)', width:'16px'}}></i> Mostrar comandos</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + ?</span>
                  </li>
                </ul>
              </div>

              {/* Sección Navegación */}
              <div className="shortcuts-section">
                <h4 style={{ marginBottom: '20px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(74, 108, 247, 0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-route"></i></span>
                  Navegación Rápida
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-house" style={{color: 'var(--gray-text)', width:'16px'}}></i> Dashboard</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + D</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-headset" style={{color: 'var(--gray-text)', width:'16px'}}></i> Mesa de Servicios</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + M</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-ticket" style={{color: 'var(--gray-text)', width:'16px'}}></i> Gestión de Tickets</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + G</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-desktop" style={{color: 'var(--gray-text)', width:'16px'}}></i> Inventario General</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + I</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-microchip" style={{color: 'var(--gray-text)', width:'16px'}}></i> Asignaciones</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + A</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-brands fa-windows" style={{color: 'var(--gray-text)', width:'16px'}}></i> Licencias</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + L</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-skull-crossbones" style={{color: 'var(--gray-text)', width:'16px'}}></i> Bajas</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + B</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-clipboard-list" style={{color: 'var(--gray-text)', width:'16px'}}></i> Hojas de Vida</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + H</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-chart-pie" style={{color: 'var(--gray-text)', width:'16px'}}></i> Reportes</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + R</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}><i className="fa-solid fa-gear" style={{color: 'var(--gray-text)', width:'16px'}}></i> Configuración</span>
                    <span style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--primary-color)', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Alt + Shift + C</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
