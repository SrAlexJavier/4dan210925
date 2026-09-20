import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '../../context/ContentContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePreloadImages } from '../../hooks/usePreloadImages';
import { BREAKPOINTS } from '../../constants/theme';
import { pageFlip } from '../audio/sceneAudio';
import { AlbumBook } from './AlbumBook';

type Phase = 'closed' | 'growing' | 'handoff' | 'opening' | 'open' | 'closing' | 'shrinking';

const GROW_MS = 300;
const HANDOFF_MS = 120;
const COVER_MS = 620;
const COVER_BACK_MS = 520;

function closedSize(width: number): [number, number] {
  if (width >= BREAKPOINTS.lg) return [280, 360];
  if (width >= BREAKPOINTS.md) return [240, 310];
  if (width >= BREAKPOINTS.sm) return [220, 132];
  return [Math.min(width * 0.86, 300), 120];
}

function openSize(width: number, height: number): [number, number] {
  if (width < BREAKPOINTS.md) {
    return [Math.min(width * 0.92, 560), Math.min(height * 0.74, 640)];
  }
  // 44 % del ancho centrado en el 62 % deja el borde izquierdo en el 40 %:
  // por delante del corredor, sin entrar en la columna de la flor.
  return [Math.min(width * 0.44, 900), Math.min(height * 0.72, 660)];
}

/**
 * Tres fases:
 *   1. 0–300 ms   el marco anima width/height. El proxy 2D es lo unico visible.
 *   2. 300–420 ms se monta el escenario YA OPACO y el proxy se desvanece.
 *   3. 420–1040   la portada gira -168 grados sobre su lomo.
 *
 * El libro nunca tiene `opacity < 1`: quien se desvanece es el proxy, que es
 * plano y puede permitirselo.
 */
export function AlbumPortal() {
  const {
    content,
    photoById,
    isAlbumOpen,
    closeAlbum,
    spreadIndex,
    spreadCount,
    isFlipping,
    goNext,
    goPrev,
  } = useContent();
  const reduced = useReducedMotion();
  const single = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);

  /**
   * El pliego visible se decodifica antes de mostrarse, el siguiente y el
   * anterior se precargan en segundo plano, y el resto espera.
   */
  const allSources = useMemo(() => content.album.photos.map((p) => p.src), [content.album.photos]);
  const eagerSources = useMemo(() => {
    const ids = new Set<string>();
    for (const i of [spreadIndex, spreadIndex + 1, spreadIndex - 1]) {
      content.album.spreads[i]?.photos.forEach((id) => ids.add(id));
    }
    return [...ids]
      .map((id) => photoById.get(id)?.src)
      .filter((src): src is string => !!src);
  }, [content.album.spreads, photoById, spreadIndex]);

  usePreloadImages(allSources, eagerSources);

  const [phase, setPhase] = useState<Phase>('closed');
  const [grown, setGrown] = useState(false);
  const [coverTurned, setCoverTurned] = useState(false);
  const [viewport, setViewport] = useState<[number, number]>([1280, 800]);

  const frameRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(null);
  /** Solo se devuelve el foco si el album llego a abrirse. */
  const wasOpened = useRef(false);

  useLayoutEffect(() => {
    const onResize = () => setViewport([window.innerWidth, window.innerHeight]);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [vw, vh] = viewport;
  const [cw, ch] = closedSize(vw);
  const [ow, oh] = openSize(vw, vh);

  /* ── Coreografia de apertura y cierre ────────────────────────────── */

  /* eslint-disable react-hooks/set-state-in-effect -- secuenciador de una
     coreografia de tres fases disparada por `isAlbumOpen`; los estados son
     instantes de esa linea de tiempo, no datos derivables del render. */
  useEffect(() => {
    if (isAlbumOpen) {
      if (reduced) {
        setPhase('open');
        setGrown(true);
        setCoverTurned(true);
        return;
      }

      setPhase('growing');
      setGrown(false);
      setCoverTurned(false);

      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
      const t1 = window.setTimeout(() => setPhase('handoff'), GROW_MS);
      const t2 = window.setTimeout(() => {
        setPhase('opening');
        setCoverTurned(true);
        pageFlip('cover');
      }, GROW_MS + HANDOFF_MS);
      const t3 = window.setTimeout(() => setPhase('open'), GROW_MS + HANDOFF_MS + COVER_MS);

      return () => {
        cancelAnimationFrame(raf);
        [t1, t2, t3].forEach(window.clearTimeout);
      };
    }

    if (phase === 'closed') return;

    if (reduced) {
      setPhase('closed');
      return;
    }

    setPhase('closing');
    setCoverTurned(false);
    pageFlip('cover');
    const t1 = window.setTimeout(() => {
      setPhase('shrinking');
      setGrown(false);
    }, COVER_BACK_MS);
    const t2 = window.setTimeout(() => setPhase('closed'), COVER_BACK_MS + GROW_MS);
    return () => [t1, t2].forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlbumOpen, reduced]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Foco: entra al abrir, vuelve al boton del album al cerrar. */
  useEffect(() => {
    if (phase === 'handoff' || (reduced && phase === 'open')) closeRef.current?.focus();
  }, [phase, reduced]);

  useEffect(() => {
    if (phase !== 'closed') {
      wasOpened.current = true;
      return;
    }
    if (!wasOpened.current) return;
    wasOpened.current = false;
    document.querySelector<HTMLElement>('[data-album-open-button]')?.focus();
  }, [phase]);

  /* ── Teclado ─────────────────────────────────────────────────────── */

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isAlbumOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeAlbum();
        return;
      }

      if (isFlipping) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'Tab') {
        // Foco atrapado dentro del album.
        const frame = frameRef.current;
        if (!frame) return;
        const focusables = frame.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [isAlbumOpen, isFlipping, closeAlbum, goNext, goPrev],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  /* ── Swipe, con umbral de 60 px ──────────────────────────────────── */

  const onPointerDown = (event: React.PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.id !== event.pointerId || isFlipping) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Umbral de 60 px y claramente horizontal: en movil el pliego de una
    // pagina se recorre en vertical, y ese gesto no debe pasar pagina.
    if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  if (phase === 'closed') return null;

  const width = grown ? ow : cw;
  const height = grown ? oh : ch;
  const showStage = phase === 'handoff' || phase === 'opening' || phase === 'open' || phase === 'closing';
  const showProxy = phase === 'growing' || phase === 'handoff' || phase === 'shrinking';
  const indicator =
    spreadIndex >= spreadCount
      ? content.album.coverTitle
      : `${content.album.indicatorLabel} ${spreadIndex + 1} de ${spreadCount}`;

  return createPortal(
    <div className="album-anchor">
      <div
        ref={frameRef}
        className="album-frame"
        style={{ width, height }}
        role="dialog"
        aria-modal="true"
        aria-label={content.album.coverTitle}
        data-album-surface
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <button
          ref={closeRef}
          type="button"
          className="album-close"
          onClick={closeAlbum}
        >
          {content.album.closeLabel}
        </button>

        {showStage && (
          <div className="album-stage">
            <AlbumBook />
            {(phase === 'handoff' || phase === 'opening' || phase === 'closing') && (
              <div
                className="album-cover-leaf"
                data-single={single ? 'true' : 'false'}
                style={{
                  transform: `rotateY(${coverTurned ? -168 : 0}deg)`,
                  transition: `transform ${
                    phase === 'closing' ? COVER_BACK_MS : COVER_MS
                  }ms ${
                    phase === 'closing'
                      ? 'cubic-bezier(0.32, 0, 0.67, 0)'
                      : 'cubic-bezier(0.33, 1, 0.68, 1)'
                  }`,
                }}
                aria-hidden="true"
              >
                <span className="album-cover__title">{content.album.coverTitle}</span>
              </div>
            )}
          </div>
        )}

        <p className="album-indicator" aria-live="polite">
          {indicator}
        </p>
      </div>

      {showProxy && (
        <div
          className="album-proxy"
          style={{ width, height }}
          data-fading={phase === 'handoff' ? 'true' : 'false'}
          aria-hidden="true"
        >
          <span className="album-cover__title">{content.album.coverTitle}</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
