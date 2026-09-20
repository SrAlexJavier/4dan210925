import { useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { LIGULE } from '../../constants/flowerModel';

/**
 * Sin WebGL: misma composicion, girasol SVG estatico a la izquierda, album
 * funcional a la derecha. Los petalos SIGUEN siendo pulsables y siguen dando
 * la frase del oraculo, con una transicion CSS en lugar de fisica. Es una
 * perdida de fidelidad, no de experiencia.
 */
export function StaticPoster() {
  const { reportPluck, markInteraction, missingPetals, setMissingPetals } = useContent();
  const [gone, setGone] = useState<Set<number>>(() => new Set());

  const pluck = (index: number) => {
    if (gone.has(index)) return;
    markInteraction();
    const next = new Set(gone).add(index);
    setGone(next);
    setMissingPetals(next.size);
    reportPluck();
    if (next.size >= LIGULE.count) {
      window.setTimeout(() => {
        setGone(new Set());
        setMissingPetals(0);
      }, 900);
    }
  };

  void missingPetals;

  return (
    <div className="static-poster">
      <svg viewBox="-120 -120 240 300" role="img" aria-label="Girasol">
        <defs>
          <radialGradient id="sp-disc">
            <stop offset="0%" stopColor="#3A2412" />
            <stop offset="72%" stopColor="#6B4718" />
            <stop offset="100%" stopColor="#E8952B" />
          </radialGradient>
          <linearGradient id="sp-petal" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#D97A0F" />
            <stop offset="45%" stopColor="#FFC93C" />
            <stop offset="100%" stopColor="#FFE066" />
          </linearGradient>
        </defs>

        <path
          d="M0 40 C -6 90, 6 130, 0 178"
          fill="none"
          stroke="#5C7A4A"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d="M0 96 C 34 84, 62 92, 78 112 C 52 124, 20 118, 0 104Z" fill="#5C7A4A" />
        <path d="M0 132 C -30 122, -56 128, -70 146 C -46 158, -18 152, 0 140Z" fill="#4E6B3E" />

        {Array.from({ length: LIGULE.count }, (_, i) => {
          const angle = (i / LIGULE.count) * 360;
          return (
            <path
              key={i}
              className="sp-ligule"
              data-gone={gone.has(i) ? 'true' : 'false'}
              transform={`rotate(${angle})`}
              d="M0 -34 C 8 -44, 10 -70, 4 -92 C 2 -96, -2 -96, -4 -92 C -10 -70, -8 -44, 0 -34Z"
              fill="url(#sp-petal)"
              stroke="#C98A16"
              strokeWidth="0.6"
              onClick={() => pluck(i)}
              role="button"
              tabIndex={0}
              aria-label={`Arrancar el petalo ${i + 1}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pluck(i);
                }
              }}
            />
          );
        })}

        <circle r="34" fill="url(#sp-disc)" />
        <circle r="34" fill="none" stroke="#2A1A0C" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
