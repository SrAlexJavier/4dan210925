import type { ReactNode } from 'react';
import type { PhotoItem, SpreadItem } from '../../types/landing';
import { Duo } from './spreads/Duo';
import { Hero } from './spreads/Hero';
import { Collage } from './spreads/Collage';
import { Note } from './spreads/Note';
import { Closing } from './spreads/Closing';

export interface SpreadProps {
  spread: SpreadItem;
  photos: PhotoItem[];
}

export interface SpreadHalves {
  left: ReactNode;
  right: ReactNode;
}

const LAYOUTS = {
  duo: Duo,
  hero: Hero,
  collage: Collage,
  note: Note,
  closing: Closing,
} as const;

export function spreadHalves(spread: SpreadItem, photos: PhotoItem[]): SpreadHalves {
  const layout = LAYOUTS[spread.layout] ?? Duo;
  return layout({ spread, photos });
}

/** Portada interior y contraportada: los dos extremos de los siete estados. */
export function CoverPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="spread-pad spread-closing">
      <h2 className="spread-title">{title}</h2>
      {subtitle && <p className="spread-text">{subtitle}</p>}
    </div>
  );
}

interface SpreadPagesProps {
  halves: SpreadHalves;
  single: boolean;
}

/**
 * Una cara de la hoja que gira: es exactamente del tamano de UNA pagina, asi
 * que pinta esa mitad y ya. (Antes se pintaba el pliego entero al 200 % y se
 * recortaba, que obligaba a cuadrar el gutter dos veces.)
 */
export function SpreadFace({ halves, side, single }: SpreadPagesProps & { side: 'left' | 'right' }) {
  return (
    <div className="album-page" data-single={single ? 'true' : 'false'}>
      {single ? (
        <>
          {halves.left}
          {halves.right}
        </>
      ) : (
        halves[side]
      )}
    </div>
  );
}

export function SpreadPages({ halves, single }: SpreadPagesProps) {
  if (single) {
    return (
      <div className="album-page" data-single="true">
        {halves.left}
        {halves.right}
      </div>
    );
  }
  return (
    <>
      <div className="album-page">{halves.left}</div>
      <div className="album-gutter" aria-hidden="true" />
      <div className="album-page">{halves.right}</div>
    </>
  );
}
