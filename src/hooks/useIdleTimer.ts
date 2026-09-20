import { useCallback, useEffect, useRef } from 'react';

/**
 * Dispara `onIdle` cuando pasan `delayMs` sin que nadie llame a `poke()`.
 * Se usa para la refloración silenciosa.
 */
export function useIdleTimer(delayMs: number, onIdle: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null);
  const cb = useRef(onIdle);

  useEffect(() => {
    cb.current = onIdle;
  }, [onIdle]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const poke = useCallback(() => {
    clear();
    if (!enabled) return;
    timer.current = window.setTimeout(() => cb.current(), delayMs);
  }, [clear, delayMs, enabled]);

  useEffect(() => {
    poke();
    return clear;
  }, [poke, clear]);

  return { poke, clear };
}
