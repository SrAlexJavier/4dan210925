import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { HoverKind } from '../../hooks/usePetalInteraction';

interface CursorGlowProps {
  hover: HoverKind;
  pulling: boolean;
}

const SPARKS = 26;
/** Distancia recorrida, en px, entre chispa y chispa. */
const SPARK_EVERY = 22;

/**
 * El puntero del sistema se sustituye por un resplandor calido que suelta
 * chispas al moverse.
 *
 * Lo que se pierde al quitar el cursor nativo es la afordancia: `grab` sobre
 * una ligula, `pointer` sobre el album. Por eso el resplandor cambia de
 * tamano y de color segun lo que hay debajo (`data-state`): la senal sigue
 * ahi, solo que dicha de otra forma.
 *
 * Solo donde hay puntero fino con hover. En tactil no hay cursor que
 * sustituir, y el resplandor no se monta.
 *
 * Va por `createPortal(document.body)` y no dentro de `.stage`: `#root` tiene
 * `isolation: isolate`, asi que crea contexto de apilamiento y NINGUN
 * z-index de dentro puede pasar por encima del album, que tambien es un
 * portal a `body`. Al quitar el cursor del sistema, un resplandor que se
 * queda debajo del album deja a la persona sin puntero visible.
 */
export function CursorGlow({ hover, pulling }: CursorGlowProps) {
  // `hover: hover` ademas de `pointer: fine`: un movil con raton conectado
  // cumple la segunda, pero lo que decide si hay cursor que sustituir es que
  // exista un puntero que se pasee por encima sin pulsar.
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = useReducedMotion();
  const glowRef = useRef<HTMLDivElement>(null);
  const sparkRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cursorRef = useRef(0);

  useEffect(() => {
    if (!fine) return;
    document.body.dataset.cursor = 'glow';
    return () => {
      delete document.body.dataset.cursor;
    };
  }, [fine]);

  useEffect(() => {
    if (!fine) return;
    const glow = glowRef.current;
    if (!glow) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const eased = { ...target };
    const lastSpark = { ...target };
    let visible = false;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!visible) {
        visible = true;
        eased.x = target.x;
        eased.y = target.y;
        lastSpark.x = target.x;
        lastSpark.y = target.y;
        glow.dataset.on = 'true';
      }
    };

    const onLeave = () => {
      visible = false;
      glow.dataset.on = 'false';
    };

    const spark = (x: number, y: number) => {
      const el = sparkRefs.current[cursorRef.current];
      cursorRef.current = (cursorRef.current + 1) % SPARKS;
      if (!el || typeof el.animate !== 'function') return;

      const angle = Math.random() * Math.PI * 2;
      const reach = 10 + Math.random() * 26;
      const size = 2 + Math.random() * 3;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;

      el.animate(
        [
          { transform: `translate3d(${x}px, ${y}px, 0) scale(1)`, opacity: 0.9 },
          {
            transform: `translate3d(${x + Math.cos(angle) * reach}px, ${
              y + Math.sin(angle) * reach + 14
            }px, 0) scale(0.2)`,
            opacity: 0,
          },
        ],
        { duration: 520 + Math.random() * 380, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      );
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      // El resplandor va un poco por detras del puntero: es lo que hace que
      // se lea como una luz y no como un icono pegado al raton.
      const k = reduced ? 1 : 0.28;
      eased.x += (target.x - eased.x) * k;
      eased.y += (target.y - eased.y) * k;
      glow.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0) translate(-50%, -50%)`;

      if (reduced || !visible) return;
      const dx = target.x - lastSpark.x;
      const dy = target.y - lastSpark.y;
      if (dx * dx + dy * dy > SPARK_EVERY * SPARK_EVERY) {
        lastSpark.x = target.x;
        lastSpark.y = target.y;
        spark(target.x, target.y);
      }
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [fine, reduced]);

  if (!fine) return null;

  return createPortal(
    <div className="cursor-layer" aria-hidden="true">
      <div ref={glowRef} className="cursor-glow" data-on="false" data-state={pulling ? 'pulling' : (hover ?? 'idle')} />
      {Array.from({ length: SPARKS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
          className="cursor-spark"
        />
      ))}
    </div>,
    document.body,
  );
}
