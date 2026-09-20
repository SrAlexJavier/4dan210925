import type { SpreadProps } from '../AlbumSpread';
import { Polaroid } from '../Polaroid';

export function Hero({ photos, spread }: SpreadProps) {
  return {
    left: (
      <div className="spread-pad" style={{ justifyContent: 'center' }}>
        {spread.title && <h2 className="spread-title">{spread.title}</h2>}
        {spread.text && <p className="spread-text">{spread.text}</p>}
      </div>
    ),
    right: (
      <div className="spread-pad spread-hero">
        {photos[0] && <Polaroid photo={photos[0]} />}
      </div>
    ),
  };
}
