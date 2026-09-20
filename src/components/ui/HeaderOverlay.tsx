import { useContent } from '../../context/ContentContext';
import { BLOOM_IN } from '../../constants/flowerModel';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Centrado sobre la columna de la flor, alineado con el eje del tallo, y con
 * `pointer-events: none` para que el arrastre siempre llegue al girasol.
 */
export function HeaderOverlay() {
  const { content } = useContent();
  const reduced = useReducedMotion();

  return (
    <header
      className="header-overlay"
      style={{
        opacity: 0,
        animation: `chrome-in ${reduced ? 200 : BLOOM_IN.chrome.dur}ms ease-out ${
          reduced ? 0 : BLOOM_IN.chrome.at
        }ms forwards`,
      }}
    >
      <h1>{content.hero.title}</h1>
      <p>{content.hero.subtitle}</p>
    </header>
  );
}
