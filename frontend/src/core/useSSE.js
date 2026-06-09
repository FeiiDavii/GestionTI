/**
 * useSSE.js
 * Hook para conectarse al endpoint SSE del backend.
 * Maneja reconexión automática con backoff exponencial.
 * Compatible con React StrictMode (doble mount en desarrollo).
 */
import { useEffect, useRef, useCallback } from 'react';

const SSE_URL = '/api/stream';
const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;

/**
 * @param {function} onMessage - Callback que recibe el objeto de datos parseado
 * @param {boolean}  enabled   - Si false, cierra la conexión (ej: usuario no autenticado)
 */
export default function useSSE(onMessage, enabled = true) {
  const esRef      = useRef(null);
  const retryMs    = useRef(INITIAL_RETRY_MS);
  const retryTimer = useRef(null);
  const onMsgRef   = useRef(onMessage);
  const mountedRef = useRef(false); // Evita doble conexión en StrictMode

  // Mantener el callback actualizado sin reconectar
  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);

  const clearRetry = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearRetry();
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, [clearRetry]);

  const connect = useCallback(() => {
    // No conectar si ya hay una conexión activa o si está deshabilitado
    if (esRef.current) return;
    if (!mountedRef.current) return;

    if (!window.EventSource) {
      console.warn('[SSE] EventSource no soportado en este navegador.');
      return;
    }

    const es = new EventSource(SSE_URL, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      retryMs.current = INITIAL_RETRY_MS; // Reset backoff al conectar exitosamente
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'update') {
          onMsgRef.current(data);
        }
      } catch {
        // Ignorar mensajes malformados (ej: pings vacíos)
      }
    };

    es.onerror = () => {
      // Cerrar la conexión rota
      es.close();
      esRef.current = null;

      // No reconectar si el componente fue desmontado o SSE deshabilitado
      if (!mountedRef.current) return;

      // Reconexión con backoff exponencial
      clearRetry();
      retryTimer.current = setTimeout(() => {
        retryMs.current = Math.min(retryMs.current * 2, MAX_RETRY_MS);
        connect();
      }, retryMs.current);
    };
  }, [clearRetry]); // connect no depende de enabled — usa mountedRef

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    mountedRef.current = true;
    connect();

    return () => {
      // Cleanup: marcar como desmontado ANTES de desconectar
      // para que el onerror no intente reconectar
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);
}
