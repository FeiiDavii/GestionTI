import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  return (
    <div className={`dashboard-container ${loaded ? 'loaded' : ''}`}>
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main className="main-content">
        <TopBar onToggleMobile={() => setMobileOpen(!mobileOpen)} />
        {children}
      </main>
    </div>
  );
}
