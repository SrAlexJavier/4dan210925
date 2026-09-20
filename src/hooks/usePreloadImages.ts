import { useEffect, useRef } from 'react';

/**
 * Estrategia de carga en cuatro pasos: el pliego visible se decodifica antes
 * de mostrarse, el siguiente y el anterior se precargan en segundo plano, y
 * el resto espera. `dominantColor` cubre el hueco mientras tanto.
 *
 * No guarda estado a proposito: quien llama solo quiere calentar la cache del
 * navegador, y un `setState` por foto que termina de decodificar re-renderiza
 * el album justo mientras una pagina esta girando.
 */
export function usePreloadImages(sources: string[], eager: string[] = []) {
  const started = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const queue = [...eager, ...sources.filter((s) => !eager.includes(s))];

    const load = async (src: string) => {
      if (started.current.has(src)) return;
      started.current.add(src);
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      try {
        await img.decode();
      } catch {
        /* el marco polaroid tiene color de reserva; la maqueta no se rompe */
      }
    };

    (async () => {
      for (const src of queue) {
        if (cancelled) return;
        await load(src);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sources, eager]);
}
