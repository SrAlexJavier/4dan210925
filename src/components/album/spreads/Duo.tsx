import type { SpreadProps } from '../AlbumSpread';
import { Polaroid } from '../Polaroid';

export function Duo({ photos, spread }: SpreadProps) {
  return {
    left: (
      <div className="spread-pad spread-duo">
        {photos[0] && <Polaroid photo={photos[0]} />}
      </div>
    ),
    right: (
      <div className="spread-pad">
        {spread.title && <h2 className="spread-title">{spread.title}</h2>}
        {photos[1] && <Polaroid photo={photos[1]} />}
        {spread.text && <p className="spread-text">{spread.text}</p>}
      </div>
    ),
  };
}
