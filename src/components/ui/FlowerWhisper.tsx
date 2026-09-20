import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useContent } from '../../context/ContentContext';
import { BLOOM_IN } from '../../constants/flowerModel';
import { BREAKPOINTS } from '../../constants/theme';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface Spot {
  x: number;
  y: number;
  tilt: number;
}

/**
 * Cada frase cae en un sitio distinto. Fijarlas siempre bajo la flor las
 * convierte en una etiqueta de interfaz; moverlas las devuelve a lo que son,
 * una voz que no sale siempre del mismo sitio.
 *
 * Los rangos son los que dejan la frase dentro de la columna de la flor: en
 * escritorio nunca pasa del 48 % (el album abierto empieza en el 52 %) y en
 * movil evita el titulo por arriba y el dock del album por abajo.
 */
function randomSpot(narrow: boolean): Spot {
  const r = Math.random;
  return narrow
    ? { x: 24 + r() * 52, y: 28 + r() * 28, tilt: (r() - 0.5) * 6 }
    : { x: 12 + r() * 36, y: 28 + r() * 46, tilt: (r() - 0.5) * 6 };
}

export function FlowerWhisper() {
  const { lastWhisper, hasInteracted, content } = useContent();
  const narrow = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
  const [hintVisible, setHintVisible] = useState(false);

  const whisperId = lastWhisper?.id ?? 0;
  const spot = useMemo(() => (whisperId ? randomSpot(narrow) : null), [whisperId, narrow]);

  // A los 4.5 s, si no ha habido ninguna interaccion. Una vez y no vuelve.
  useEffect(() => {
    if (hasInteracted) return;
    const show = window.setTimeout(() => setHintVisible(true), BLOOM_IN.hint.at);
    const hide = window.setTimeout(
      () => setHintVisible(false),
      BLOOM_IN.hint.at + BLOOM_IN.hint.dur,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [hasInteracted]);

  if (lastWhisper && spot) {
    return (
      <p
        key={lastWhisper.id}
        className="flower-whisper flower-whisper--roaming"
        style={
          {
            left: `${spot.x}%`,
            top: `${spot.y}%`,
            bottom: 'auto',
            '--wr': `${spot.tilt}deg`,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        {lastWhisper.text}
      </p>
    );
  }

  // La pista es una afordancia, no una voz: siempre bajo la flor.
  if (hintVisible && !hasInteracted) {
    return (
      <p className="flower-whisper flower-whisper--hint" aria-hidden="true">
        {content.flower.hint}
      </p>
    );
  }

  return null;
}
