import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { permisos, esAdministrativo, logout } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});
  const [darkMode, setDarkMode] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  useEffect(() => {
    const syncTheme = () => {
      setDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    window.addEventListener('themechange', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('themechange', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const handleToggleDark = (e) => {
    const next = e.target.checked;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('darkMode', String(next));
    window.dispatchEvent(new Event('themechange'));
  };

  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  const isActive = (path) => currentPage === path || location.pathname.startsWith('/' + path);

  const showActivos = !!(permisos.inv_ver || permisos.inv_asignaciones || permisos.inv_licencias || permisos.inv_bajas || permisos.inv_topology);
  const showSoporte = !!(permisos.tk_ver_global || permisos.tk_responder || permisos.tk_mantenimientos || permisos.tk_crear);
  const showAdmin = !!(permisos.rep_generar || permisos.conf_basica || permisos.conf_roles || permisos.usr_ver || permisos.conf_sla);

  const activosOpen = ['equipos', 'topology', 'asignaciones', 'licencias', 'bajas'].includes(currentPage);
  const soporteOpen = ['tickets', 'gestion-tickets', 'mantenimientos'].includes(currentPage);
  const adminOpen = ['reportes', 'configuracion'].includes(currentPage);

  const isGroupOpen = (group, defaultOpen) => {
    return openGroups[group] !== undefined ? openGroups[group] : defaultOpen;
  };

  const toggleGroup = (group, defaultOpen) => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !(prev[group] !== undefined ? prev[group] : defaultOpen),
    }));
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay active"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'mobile-active' : ''}`}>
        <div className="brand">
          <div className="brand-icon-wrapper">
            <i className="fa-solid fa-wave-square"></i>
          </div>
          <div className="brand-titles">
            <span className="brand-name">GestionTI</span>
            <span className="brand-sub">ITSM & Assets OS</span>
          </div>
        </div>

        <ul className="nav-links">
          {!esAdministrativo() ? (
            <>
              <li className="nav-section-label">Menú Principal</li>
              <li>
                <Link to="/tickets" className={isActive('tickets') ? 'active' : ''} title="Mesa de Servicios" onClick={onCloseMobile}>
                  <i className="fa-solid fa-headset"></i> <span>Mesa de Servicios</span>
                </Link>
              </li>
              <li className="nav-section-label">Preferencias</li>
              <li>
                <Link to="/configuracion" className={isActive('configuracion') ? 'active' : ''} title="Configuración" onClick={onCloseMobile}>
                  <i className="fa-solid fa-gear"></i> <span>Configuración</span>
                </Link>
              </li>
            </>
          ) : (
            <>
              <li className="nav-section-label">Menú Principal</li>
              <li>
                <Link to="/dashboard" className={isActive('dashboard') ? 'active' : ''} title="Dashboard" onClick={onCloseMobile}>
                  <i className="fa-solid fa-house"></i> <span>Dashboard</span>
                </Link>
              </li>

              {showActivos && (
                <li className={`nav-group ${isGroupOpen('activos', activosOpen) ? 'open' : ''}`}>
                  <div className="nav-group-header" onClick={() => toggleGroup('activos', activosOpen)} title="Gestión de Activos">
                    <div className="nav-group-title">
                      <i className="fa-solid fa-boxes-stacked"></i> <span>Gestión de Activos</span>
                    </div>
                    <i className="fa-solid fa-chevron-down toggle-icon"></i>
                  </div>
                  <ul className="nav-submenu">
                    {permisos.inv_ver && (
                      <li><Link to="/equipos" className={isActive('equipos') ? 'active' : ''} title="Inventario General" onClick={onCloseMobile}>
                        <i className="fa-solid fa-desktop"></i> <span>Inventario General</span>
                      </Link></li>
                    )}
                    {permisos.inv_topology && (
                      <li><Link to="/topology" className={isActive('topology') ? 'active' : ''} title="Topología de Red" onClick={onCloseMobile}>
                        <i className="fa-solid fa-network-wired"></i> <span>Topología de Red</span>
                      </Link></li>
                    )}
                    {permisos.inv_asignaciones && (
                      <li><Link to="/asignaciones" className={isActive('asignaciones') ? 'active' : ''} title="Asignaciones y Repuestos" onClick={onCloseMobile}>
                        <i className="fa-solid fa-microchip"></i> <span>Asignaciones y Repuestos</span>
                      </Link></li>
                    )}
                    {permisos.inv_licencias && (
                      <li><Link to="/licencias" className={isActive('licencias') ? 'active' : ''} title="Licencias Software" onClick={onCloseMobile}>
                        <i className="fa-brands fa-windows"></i> <span>Licencias Software</span>
                      </Link></li>
                    )}
                    {permisos.inv_bajas && (
                      <li><Link to="/bajas" className={isActive('bajas') ? 'active' : ''} title="Archivo de Bajas" onClick={onCloseMobile}>
                        <i className="fa-solid fa-box-archive"></i> <span>Archivo de Bajas</span>
                      </Link></li>
                    )}
                  </ul>
                </li>
              )}

              {showSoporte && (
                <li className={`nav-group ${isGroupOpen('soporte', soporteOpen) ? 'open' : ''}`}>
                  <div className="nav-group-header" onClick={() => toggleGroup('soporte', soporteOpen)} title="Soporte y Mantenimiento">
                    <div className="nav-group-title">
                      <i className="fa-solid fa-screwdriver-wrench"></i> <span>Soporte y Mtto</span>
                    </div>
                    <i className="fa-solid fa-chevron-down toggle-icon"></i>
                  </div>
                  <ul className="nav-submenu">
                    {permisos.tk_crear && (
                      <li><Link to="/tickets" className={isActive('tickets') ? 'active' : ''} title="Mesa de Servicios" onClick={onCloseMobile}>
                        <i className="fa-solid fa-headset"></i> <span>Mesa de Servicios</span>
                      </Link></li>
                    )}
                    {(permisos.tk_ver_global || permisos.tk_responder) && (
                      <li><Link to="/gestion-tickets" className={isActive('gestion-tickets') ? 'active' : ''} title="Gestión de Tickets" onClick={onCloseMobile}>
                        <i className="fa-solid fa-ticket"></i> <span>Gestión de Tickets</span>
                      </Link></li>
                    )}
                    {permisos.tk_mantenimientos && (
                      <li><Link to="/mantenimientos" className={isActive('mantenimientos') ? 'active' : ''} title="Hojas de Vida Técnicas" onClick={onCloseMobile}>
                        <i className="fa-solid fa-clipboard-list"></i> <span>Hojas de Vida Técnicas</span>
                      </Link></li>
                    )}
                  </ul>
                </li>
              )}

              {showAdmin && (
                <>
                  <li className="nav-section-label">Administración</li>
                  <li className={`nav-group ${isGroupOpen('admin', adminOpen) ? 'open' : ''}`}>
                    <div className="nav-group-header" onClick={() => toggleGroup('admin', adminOpen)} title="Administración">
                      <div className="nav-group-title">
                        <i className="fa-solid fa-shield-halved"></i> <span>Administración</span>
                      </div>
                      <i className="fa-solid fa-chevron-down toggle-icon"></i>
                    </div>
                    <ul className="nav-submenu">
                      {permisos.rep_generar && (
                        <li><Link to="/reportes" className={isActive('reportes') ? 'active' : ''} title="Reportes y Logs" onClick={onCloseMobile}>
                          <i className="fa-solid fa-chart-pie"></i> <span>Reportes y Logs</span>
                        </Link></li>
                      )}
                      {(permisos.conf_basica || permisos.conf_roles || permisos.usr_ver || permisos.conf_sla) && (
                        <li><Link to="/configuracion" className={isActive('configuracion') ? 'active' : ''} title="Configuración Global" onClick={onCloseMobile}>
                          <i className="fa-solid fa-gear"></i> <span>Configuración Global</span>
                        </Link></li>
                      )}
                    </ul>
                  </li>
                </>
              )}
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-theme-card" title="Alternar Modo Oscuro">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i
                className={`fa-solid ${darkMode ? 'fa-moon' : 'fa-sun'}`}
                style={{ color: darkMode ? 'var(--accent-amber)' : 'var(--text-muted)', fontSize: '14px', width: '16px', textAlign: 'center' }}
              ></i>
              <span className="sidebar-theme-label">Modo Oscuro</span>
            </div>
            <label className="switch" style={{ margin: 0 }}>
              <input type="checkbox" checked={darkMode} onChange={handleToggleDark} aria-label="Alternar Modo Oscuro" />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="logout-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} title="Cerrar Sesión">
              <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>Cerrar Sesión</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
