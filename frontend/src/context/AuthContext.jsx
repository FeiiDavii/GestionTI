import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permisos, setPermisos] = useState({});
  const [loading, setLoading] = useState(true);
  const authCheckRef = useRef(false);

  // Normaliza a booleans: evita que lleguen 0/1 (o '0'/'1') y que React
  // renderice un "0" literal en condiciones como {permisos.X && ...}.
  const normalizePermisos = (obj = {}) => {
    const out = {};
    Object.keys(obj).forEach(k => { out[k] = !!obj[k]; });
    return out;
  };

  const checkAuth = useCallback(async () => {
    if (authCheckRef.current) return;
    authCheckRef.current = true;
    try {
      const res = await authAPI.me();
      if (res.data.success && res.data.data) {
        setUser(res.data.data);
        setPermisos(normalizePermisos(res.data.data.permisos));
      } else {
        setUser(null);
        setPermisos({});
      }
    } catch (err) {
      setUser(null);
      setPermisos({});
      // Si el servidor respondió con un reason (ej: force_logout activo), redirigir con motivo
      const reason = err?.response?.data?.reason;
      if (reason && window.location.pathname !== '/login') {
        window.location.href = `/login?reason=${reason}`;
        return;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const res = await authAPI.login(username, password);
    if (res.data.success) {
      setUser(res.data.data);
      setPermisos(normalizePermisos(res.data.data.permisos));
      return res.data;
    }
    throw new Error(res.data.message || 'Credenciales incorrectas');
  };

  const logout = async (reason = null) => {
    try {
      await authAPI.logout();
    } catch { /* ignore */ }
    setUser(null);
    setPermisos({});
    if (reason) {
      window.location.href = `/login?reason=${reason}`;
    } else {
      window.location.href = '/login';
    }
  };

  const esAdministrativo = () => {
    return !!(
      permisos.inv_ver ||
      permisos.tk_ver_global ||
      permisos.tk_responder ||
      permisos.usr_ver ||
      permisos.rep_generar ||
      permisos.conf_basica
    );
  };

  const hasPermission = (permiso) => {
    return !!permisos[permiso];
  };

  const hasAnyPermission = (permisosList) => {
    return permisosList.some(p => !!permisos[p]);
  };

  return (
    <AuthContext.Provider value={{
      user, permisos, loading, login, logout, checkAuth,
      esAdministrativo, hasPermission, hasAnyPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
