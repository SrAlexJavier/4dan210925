import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../constants/theme';
import { pageFlip } from '../audio/sceneAudio';
import {
  CoverPage,
  SpreadFace,
  SpreadPages,
  spreadHalves,
  type SpreadHalves,
} from './AlbumSpread';

/**
 * Las mitades de cada pliego se construyen una sola vez. Sin esto, cada giro
 * crea elementos de React nuevos para el pliego que ya estaba en pantalla,
 * los remonta, y el navegador vuelve a maquetar las dos paginas justo cuando
 * la hoja empieza a girar: ese es el tiron. El contenido viene de un JSON
 * estatico, asi que la cache no caduca.
 */
const halvesCache = new Map<number, SpreadHalves>();

interface Flip {
  from: number;
  to: number;
  dir: 1 | -1;
}

/**
 * Cada hoja es un `div` con `preserve-3d`, dos caras con
 * `backface-visibility: hidden` y la cara B rotada 180 grados, girando sobre
 * el lomo.
 *
 * Lo que decide si el giro se siente o no se siente: QUE hay debajo mientras
 * gira. Pintar el pliego de destino entero desde el frame 0 hace que el
 * contenido nuevo aparezca antes que la animacion, y el giro se lee como un
 * adorno que llega tarde. En un libro de verdad:
 *
 *   - hacia delante: la pagina que se levanta es `from.right`; debajo aparece
 *     `to.right` al instante, y la izquierda SIGUE siendo `from.left` hasta
 *     que la hoja aterriza encima mostrando `to.left`.
 *   - hacia atras: lo mismo espejado.
 */
export function AlbumBook() {
  const { content, photoById, spreadIndex, spreadCount, setFlipping, isFlipping, goNext, goPrev } =
    useContent();
  const reduced = useReducedMotion();
  const single = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);

  const [shown, setShown] = useState(spreadIndex);
  const [flip, setFlip] = useState<Flip | null>(null);
  const settled = useRef(false);
  const leafRef = useRef<HTMLDivElement>(null);

  const halvesOf = useCallback(
    (index: number): SpreadHalves => {
      const hit = halvesCache.get(index);
      if (hit) return hit;

      const built: SpreadHalves =
        index >= spreadCount
          ? {
              left: <CoverPage title={content.album.countLabel} />,
              right: <CoverPage title={content.album.coverTitle} />,
            }
          : (() => {
              const spread = content.album.spreads[index];
              const photos = spread.photos
                .map((id) => photoById.get(id))
                .filter((p): p is NonNullable<typeof p> => !!p);
              return spreadHalves(spread, photos);
            })();

      halvesCache.set(index, built);
      return built;
    },
    [content.album, photoById, spreadCount],
  );

  const duration = reduced ? 180 : single ? 620 : 700;

  const finish = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    setShown(spreadIndex);
    setFlip(null);
    setFlipping(false);
  }, [spreadIndex, setFlipping]);

  useEffect(() => {
    if (spreadIndex === shown) return;
    const dir: 1 | -1 = spreadIndex > shown ? 1 : -1;

    settled.current = false;
    setFlipping(true);
    pageFlip();

    if (reduced) {
      // Cross-fade de 180 ms en lugar del flip 3D.
      const timer = window.setTimeout(finish, duration);
      return () => window.clearTimeout(timer);
    }

    /* eslint-disable-next-line react-hooks/set-state-in-effect -- arranque de
       una animacion ante un cambio externo. */
    setFlip({ from: shown, to: spreadIndex, dir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadIndex]);

  /**
   * El giro va por la Web Animations API y no por una transicion CSS armada
   * con dos `requestAnimationFrame`: con ese truco el arranque depende de la
   * tasa de refresco y el final llega por `transitionend` o por un temporizador
   * de respaldo, que es justo lo que hace que el giro se sienta desacompasado
   * del cambio de pliego. Aqui empieza y termina donde dice.
   */
  useEffect(() => {
    const el = leafRef.current;
    if (!flip || !el) return;
    if (typeof el.animate !== 'function') {
      finish();
      return;
    }

    const to = flip.dir === -1 ? 180 : -180;
    const animation = el.animate(
      [
        { transform: 'rotateY(0deg)', ['--flip-shadow' as string]: 0 },
        { transform: `rotateY(${to}deg)`, ['--flip-shadow' as string]: 1 },
      ],
      // Menos entrada y mas salida: el papel arranca con cuerpo y se posa.
      { duration, easing: 'cubic-bezier(0.34, 0.66, 0.26, 1)', fill: 'forwards' },
    );

    let live = true;
    animation.finished
      .then(() => {
        if (live) finish();
      })
      .catch(() => {
        /* cancelada al desmontar la hoja */
      });

    return () => {
      live = false;
      // Cancelar una animacion ya terminada devuelve la hoja a 0 grados
      // durante el frame en que se desmonta: eso es un parpadeo.
      if (animation.playState !== 'finished') animation.cancel();
    };
  }, [flip, duration, finish]);

  const fromHalves = useMemo(
    () => halvesOf(flip ? flip.from : spreadIndex),
    [halvesOf, flip, spreadIndex],
  );
  const toHalves = useMemo(
    () => halvesOf(flip ? flip.to : spreadIndex),
    [halvesOf, flip, spreadIndex],
  );

  // Lo que queda quieto debajo de la hoja.
  const beneath: SpreadHalves = useMemo(() => {
    if (!flip || single) return toHalves;
    return flip.dir === 1
      ? { left: fromHalves.left, right: toHalves.right }
      : { left: toHalves.left, right: fromHalves.right };
  }, [flip, single, fromHalves, toHalves]);

  // La hoja: empieza mostrando la mitad de la que se viene y aterriza
  // mostrando la mitad a la que se va.
  const faceSide: 'left' | 'right' = flip?.dir === -1 ? 'left' : 'right';
  const backSide: 'left' | 'right' = flip?.dir === -1 ? 'right' : 'left';

  const atStart = spreadIndex <= 0;
  const atEnd = spreadIndex >= spreadCount;

  return (
    <div
      className="album-book"
      data-single={single ? 'true' : 'false'}
      style={reduced ? { transition: `opacity ${duration}ms ease` } : undefined}
    >
      <SpreadPages halves={beneath} single={single} />

      {flip && (
        <div ref={leafRef} className="album-leaf" data-dir={flip.dir} aria-hidden="true">
          <div className="album-face album-face--front">
            <SpreadFace halves={fromHalves} side={faceSide} single={single} />
          </div>
          <div className="album-face album-face--back">
            <SpreadFace halves={toHalves} side={backSide} single={single} />
          </div>
        </div>
      )}

      <button
        type="button"
        className="album-nav album-nav--prev"
        onClick={goPrev}
        disabled={atStart || isFlipping}
        aria-label="Recuerdo anterior"
      >
        &#8249;
      </button>
      <button
        type="button"
        className="album-nav album-nav--next"
        onClick={goNext}
        disabled={atEnd || isFlipping}
        aria-label="Recuerdo siguiente"
      >
        &#8250;
      </button>
    </div>
  );
}
