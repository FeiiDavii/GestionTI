import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginLayout from './components/layout/LoginLayout';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import GestionTickets from './pages/GestionTickets';
import Equipos from './pages/Equipos';
import Asignaciones from './pages/Asignaciones';
import Licencias from './pages/Licencias';
import Bajas from './pages/Bajas';
import Mantenimientos from './pages/Mantenimientos';
import Configuracion from './pages/Configuracion';
import Reportes from './pages/Reportes';
import Perfil from './pages/Perfil';
import Topology from './pages/Topology';

function ProtectedRoute({ children, requiredPermiso }) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-[#4a6cf7]"></i>
          <p className="mt-4 text-[#888]">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requiredPermiso && !hasPermission(requiredPermiso)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user, loading, esAdministrativo } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={esAdministrativo() ? '/dashboard' : '/tickets'} replace />;
}

export default function App() {
  const { user, loading, esAdministrativo } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-[#4a6cf7]"></i>
          <p className="mt-4 text-[#888]">Inicializando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        user
          ? <Navigate to={esAdministrativo() ? '/dashboard' : '/tickets'} replace />
          : <LoginLayout><Login /></LoginLayout>
      } />
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><AppLayout><Tickets /></AppLayout></ProtectedRoute>} />
      <Route path="/gestion-tickets" element={<ProtectedRoute requiredPermiso="tk_ver_global"><AppLayout><GestionTickets /></AppLayout></ProtectedRoute>} />
      <Route path="/equipos" element={<ProtectedRoute requiredPermiso="inv_ver"><AppLayout><Equipos /></AppLayout></ProtectedRoute>} />
      <Route path="/topology" element={<ProtectedRoute requiredPermiso="inv_topology"><AppLayout><Topology /></AppLayout></ProtectedRoute>} />
      <Route path="/asignaciones" element={<ProtectedRoute requiredPermiso="inv_asignaciones"><AppLayout><Asignaciones /></AppLayout></ProtectedRoute>} />
      <Route path="/licencias" element={<ProtectedRoute requiredPermiso="inv_licencias"><AppLayout><Licencias /></AppLayout></ProtectedRoute>} />
      <Route path="/bajas" element={<ProtectedRoute requiredPermiso="inv_bajas"><AppLayout><Bajas /></AppLayout></ProtectedRoute>} />
      <Route path="/mantenimientos" element={<ProtectedRoute requiredPermiso="tk_mantenimientos"><AppLayout><Mantenimientos /></AppLayout></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><AppLayout><Configuracion /></AppLayout></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute requiredPermiso="rep_generar"><AppLayout><Reportes /></AppLayout></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><AppLayout><Perfil /></AppLayout></ProtectedRoute>} />
    </Routes>
  );
}
