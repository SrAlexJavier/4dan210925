import { useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../constants/theme';
import { pageFlip } from '../audio/sceneAudio';
import { CoverPage, SpreadPages, spreadHalves, type SpreadHalves } from './AlbumSpread';

interface Leaf {
  front: SpreadHalves;
  back: SpreadHalves;
  dir: 1 | -1;
}

/**
 * Cada hoja es un `div` con `preserve-3d`, dos caras con
 * `backface-visibility: hidden` y la cara B rotada 180 grados, girando sobre
 * `transform-origin: left center`.
 */
export function AlbumBook() {
  const { content, photoById, spreadIndex, spreadCount, setFlipping, goNext, goPrev } =
    useContent();
  const reduced = useReducedMotion();
  const single = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);

  const [shown, setShown] = useState(spreadIndex);
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const [turned, setTurned] = useState(false);
  const leafRef = useRef<HTMLDivElement>(null);

  const halvesOf = useMemo(
    () =>
      (index: number): SpreadHalves => {
        if (index >= spreadCount) {
          return {
            left: <CoverPage title={content.album.countLabel} />,
            right: <CoverPage title={content.album.coverTitle} />,
          };
        }
        const spread = content.album.spreads[index];
        const photos = spread.photos
          .map((id) => photoById.get(id))
          .filter((p): p is NonNullable<typeof p> => !!p);
        return spreadHalves(spread, photos);
      },
    [content.album, photoById, spreadCount],
  );

  const duration = reduced ? 180 : single ? 620 : 700;

  useEffect(() => {
    if (spreadIndex === shown) return;
    const dir: 1 | -1 = spreadIndex > shown ? 1 : -1;

    setFlipping(true);
    pageFlip();

    if (reduced) {
      // Cross-fade de 180 ms en lugar del flip 3D.
      const timer = window.setTimeout(() => {
        setShown(spreadIndex);
        setFlipping(false);
      }, duration);
      return () => window.clearTimeout(timer);
    }

    const from = halvesOf(shown);
    const to = halvesOf(spreadIndex);
    // Arrancar una animacion temporizada ante un cambio externo es el caso
    // para el que existe este efecto: no hay render del que derivarlo.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLeaf(
      dir === 1
        ? { front: from, back: to, dir }
        : { front: to, back: from, dir },
    );
    setTurned(dir === -1);
    /* eslint-enable react-hooks/set-state-in-effect */

    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setTurned(dir === 1)),
    );

    const timer = window.setTimeout(() => {
      setShown(spreadIndex);
      setLeaf(null);
      setFlipping(false);
    }, duration);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadIndex]);

  const current = halvesOf(spreadIndex);
  const atStart = spreadIndex <= 0;
  const atEnd = spreadIndex >= spreadCount;

  return (
    <div
      className="album-book"
      data-single={single ? 'true' : 'false'}
      style={reduced ? { transition: `opacity ${duration}ms ease` } : undefined}
    >
      <SpreadPages halves={current} single={single} />

      {leaf && (
        <div
          ref={leafRef}
          className="album-leaf"
          data-dir={leaf.dir}
          style={{
            transform: `rotateY(${turned ? -180 : 0}deg) skewY(${turned ? 0 : 0}deg)`,
            transition: `transform ${duration}ms cubic-bezier(0.45, 0.05, 0.25, 1)`,
            ['--flip-shadow' as string]: turned ? 1 : 0,
          }}
          aria-hidden="true"
        >
          <div className="album-face album-face--front">
            <div className="album-face__window" data-half="right">
              <SpreadPages halves={leaf.front} single={single} />
            </div>
          </div>
          <div className="album-face album-face--back">
            <div className="album-face__window" data-half="left">
              <SpreadPages halves={leaf.back} single={single} />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="album-nav album-nav--prev"
        onClick={goPrev}
        disabled={atStart}
        aria-label="Recuerdo anterior"
      >
        &#8249;
      </button>
      <button
        type="button"
        className="album-nav album-nav--next"
        onClick={goNext}
        disabled={atEnd}
        aria-label="Recuerdo siguiente"
      >
        &#8250;
      </button>
    </div>
  );
}
