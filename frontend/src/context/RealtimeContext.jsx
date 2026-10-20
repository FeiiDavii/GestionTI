/**
 * RealtimeContext.jsx
 * Bus de eventos en tiempo real basado en SSE.
 *
 * Provee:
 *  - notifications: lista de notificaciones del usuario
 *  - unreadCount: número de no leídas
 *  - reloadNotifications(): fuerza recarga manual
 *
 * Emite eventos globales (window CustomEvent) para que cualquier
 * componente pueda reaccionar sin prop-drilling:
 *  - 'rt:tickets_update'  → tabla de tickets debe recargarse
 *  - 'rt:chat_update'     → chat del ticket activo debe recargarse
 *  - 'rt:system_update'   → datos de inventario/dashboard deben recargarse
 *  - 'rt:force_logout'    → sesión terminada por admin
 */
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef
} from 'react';
import useSSE from '../core/useSSE';
import { notificationAPI } from '../api/client';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const prevUnreadRef = useRef(0);
  const audioCtxRef   = useRef(null);
  const mutedRef      = useRef(localStorage.getItem('muteNotifications') === 'true');
  const logoutRef     = useRef(logout);

  // Mantener logout ref actualizada sin recrear callbacks
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  // ── Audio ──────────────────────────────────────────────────────────────
  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const unlock = () => {
      initAudio();
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [initAudio]);

  const playSound = useCallback(() => {
    if (mutedRef.current) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const runBeep = () => {
        try {
          const now = ctx.currentTime;
          // Tono armónico agradable de notificación (doble tono: 587Hz D5 -> 880Hz A5)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, now); // D5
          osc1.frequency.setValueAtTime(880, now + 0.1); // A5

          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(880, now + 0.1);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.3, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc1.stop(now + 0.4);
          osc2.start(now + 0.1);
          osc2.stop(now + 0.4);
        } catch { /* ignore */ }
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(runBeep).catch(() => {});
      } else {
        runBeep();
      }
    } catch { /* ignore */ }
  }, [initAudio]);

  // ── Carga inicial de notificaciones ───────────────────────────────────
  const reloadNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.list();
      if (res.data?.success) {
        const payload = res.data.data;
        const items   = Array.isArray(payload?.data) ? payload.data
                      : Array.isArray(payload)       ? payload
                      : [];
        const count   = payload?.unread ?? 0;
        setNotifications(items);
        setUnreadCount(count);
        prevUnreadRef.current = count;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user) reloadNotifications();
  }, [user, reloadNotifications]);

  // ── Manejador de mensajes SSE ─────────────────────────────────────────
  const handleSSEMessage = useCallback((data) => {
    // 1. Badge de notificaciones
    if (data.unread_count !== undefined) {
      setUnreadCount(data.unread_count);
    }

    // 2. Nuevas notificaciones → prepend al dropdown + sonido
    if (data.notifications && data.notifications.length > 0) {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newOnes = data.notifications.filter(n => !existingIds.has(n.id));
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
      });
      playSound();
    }

    // 3. Tickets actualizados → emitir evento global
    if (data.tickets_update === true) {
      window.dispatchEvent(new CustomEvent('rt:tickets_update'));
    }

    // 4. Chat actualizado → emitir evento global
    if (data.chat_update === true) {
      window.dispatchEvent(new CustomEvent('rt:chat_update'));
    }

    // 5. Sistema actualizado → emitir evento global
    if (data.system_update === true) {
      window.dispatchEvent(new CustomEvent('rt:system_update'));
    }

    // 6. Cierre de sesión forzado
    if (data.force_logout === true) {
      logoutRef.current(data.force_logout_reason || 1);
    }
  }, [playSound]); // logout via ref — no necesita ser dependencia

  // ── Conectar SSE solo cuando hay usuario autenticado ──────────────────
  useSSE(handleSSEMessage, !!user);

  // ── Exponer función para actualizar mute desde TopBar ─────────────────
  const setMuted = useCallback((val) => {
    mutedRef.current = val;
    localStorage.setItem('muteNotifications', val);
  }, []);

  return (
    <RealtimeContext.Provider value={{
      notifications,
      unreadCount,
      reloadNotifications,
      setNotifications,
      setUnreadCount,
      setMuted,
      mutedRef,
    }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);
export default RealtimeContext;
