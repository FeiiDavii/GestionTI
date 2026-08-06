import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { user, permisos, esAdministrativo, logout } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});

  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (path) => currentPage === path || location.pathname.startsWith('/' + path);

  const showActivos = !!(permisos.inv_ver || permisos.inv_asignaciones || permisos.inv_licencias || permisos.inv_bajas || permisos.inv_topology);
  const showSoporte = !!(permisos.tk_ver_global || permisos.tk_responder || permisos.tk_mantenimientos || permisos.tk_crear);
  const showAdmin = !!(permisos.rep_generar || permisos.conf_basica || permisos.conf_roles || permisos.usr_ver || permisos.conf_sla);

  const activosOpen = ['equipos', 'topology', 'asignaciones', 'licencias', 'bajas'].includes(currentPage);
  const soporteOpen = ['tickets', 'gestion-tickets', 'mantenimientos'].includes(currentPage);
  const adminOpen = ['reportes', 'configuracion'].includes(currentPage);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'mobile-active' : ''}`}>
        <div className="brand">
          <i className="fa-solid fa-layer-group"></i>
          <span>GestionTI</span>
        </div>

        <ul className="nav-links">
          {!esAdministrativo() ? (
            <>
              <li>
                <Link to="/tickets" className={isActive('tickets') ? 'active' : ''} title="Mesa de Servicios">
                  <i className="fa-solid fa-headset"></i> <span>Mesa de Servicios</span>
                </Link>
              </li>
              <li>
                <Link to="/configuracion" className={isActive('configuracion') ? 'active' : ''} title="Configuración">
                  <i className="fa-solid fa-gear"></i> <span>Configuración</span>
                </Link>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/dashboard" className={isActive('dashboard') ? 'active' : ''} title="Dashboard">
                  <i className="fa-solid fa-house"></i> <span>Dashboard</span>
                </Link>
              </li>

              {showActivos && (
                <li className={`nav-group ${openGroups.activos || activosOpen ? 'open' : ''}`}>
                  <div className="nav-group-header" onClick={() => toggleGroup('activos')} title="Gestión de Activos">
                    <div className="nav-group-title">
                      <i className="fa-solid fa-boxes-stacked"></i> <span>Gestión de Activos</span>
                    </div>
                    <i className="fa-solid fa-chevron-down toggle-icon"></i>
                  </div>
                  <ul className="nav-submenu">
                    {permisos.inv_ver && (
                      <li><Link to="/equipos" className={isActive('equipos') ? 'active' : ''} title="Inventario General">
                        <i className="fa-solid fa-desktop"></i> <span>Inventario General</span>
                      </Link></li>
                    )}
                    {permisos.inv_topology && (
                      <li><Link to="/topology" className={isActive('topology') ? 'active' : ''} title="Topología de Red">
                        <i className="fa-solid fa-network-wired"></i> <span>Topología de Red</span>
                      </Link></li>
                    )}
                    {permisos.inv_asignaciones && (
                      <li><Link to="/asignaciones" className={isActive('asignaciones') ? 'active' : ''} title="Asignaciones y Repuestos">
                        <i className="fa-solid fa-microchip"></i> <span>Asignaciones y Repuestos</span>
                      </Link></li>
                    )}
                    {permisos.inv_licencias && (
                      <li><Link to="/licencias" className={isActive('licencias') ? 'active' : ''} title="Licencias Software">
                        <i className="fa-brands fa-windows"></i> <span>Licencias Software</span>
                      </Link></li>
                    )}
                    {permisos.inv_bajas && (
                      <li><Link to="/bajas" className={isActive('bajas') ? 'active' : ''} title="Archivo de Bajas">
                        <i className="fa-solid fa-skull-crossbones"></i> <span>Archivo de Bajas</span>
                      </Link></li>
                    )}
                  </ul>
                </li>
              )}

              {showSoporte && (
                <li className={`nav-group ${openGroups.soporte || soporteOpen ? 'open' : ''}`}>
                  <div className="nav-group-header" onClick={() => toggleGroup('soporte')} title="Soporte y Mantenimiento">
                    <div className="nav-group-title">
                      <i className="fa-solid fa-screwdriver-wrench"></i> <span>Soporte y Mtto</span>
                    </div>
                    <i className="fa-solid fa-chevron-down toggle-icon"></i>
                  </div>
                  <ul className="nav-submenu">
                    {permisos.tk_crear && (
                      <li><Link to="/tickets" className={isActive('tickets') ? 'active' : ''} title="Mesa de Servicios">
                        <i className="fa-solid fa-headset"></i> <span>Mesa de Servicios</span>
                      </Link></li>
                    )}
                    {(permisos.tk_ver_global || permisos.tk_responder) && (
                      <li><Link to="/gestion-tickets" className={isActive('gestion-tickets') ? 'active' : ''} title="Gestión de Tickets">
                        <i className="fa-solid fa-ticket"></i> <span>Gestión de Tickets</span>
                      </Link></li>
                    )}
                    {permisos.tk_mantenimientos && (
                      <li><Link to="/mantenimientos" className={isActive('mantenimientos') ? 'active' : ''} title="Hojas de Vida Técnicas">
                        <i className="fa-solid fa-clipboard-list"></i> <span>Hojas de Vida Técnicas</span>
                      </Link></li>
                    )}
                  </ul>
                </li>
              )}

              {showAdmin && (
                <li className={`nav-group ${openGroups.admin || adminOpen ? 'open' : ''}`}>
                  <div className="nav-group-header" onClick={() => toggleGroup('admin')} title="Administración">
                    <div className="nav-group-title">
                      <i className="fa-solid fa-shield-halved"></i> <span>Administración</span>
                    </div>
                    <i className="fa-solid fa-chevron-down toggle-icon"></i>
                  </div>
                  <ul className="nav-submenu">
                    {permisos.rep_generar && (
                      <li><Link to="/reportes" className={isActive('reportes') ? 'active' : ''} title="Reportes y Logs">
                        <i className="fa-solid fa-chart-pie"></i> <span>Reportes y Logs</span>
                      </Link></li>
                    )}
                    {(permisos.conf_basica || permisos.conf_roles || permisos.usr_ver || permisos.conf_sla) && (
                      <li><Link to="/configuracion" className={isActive('configuracion') ? 'active' : ''} title="Configuración Global">
                        <i className="fa-solid fa-gear"></i> <span>Configuración Global</span>
                      </Link></li>
                    )}
                  </ul>
                </li>
              )}
            </>
          )}
        </ul>

        <div className="logout-section">
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} title="Cerrar Sesión">
            <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>Cerrar Sesión</span>
          </a>
        </div>
      </aside>
    </>
  );
}
