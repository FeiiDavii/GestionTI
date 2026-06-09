import { useEffect, useRef, useCallback } from 'react';

export default function usePolling(callback, intervalMs, enabled = true) {
  const savedCallback = useRef(callback);
  const intervalRef = useRef(null);

  useEffect(() => { savedCallback.current = callback; }, [callback]);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (savedCallback.current) savedCallback.current();
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return; }
    start();
    return stop;
  }, [enabled, start, stop]);

  return { start, stop };
}
