import type { SpreadProps } from '../AlbumSpread';
import { Polaroid } from '../Polaroid';

export function Closing({ photos, spread }: SpreadProps) {
  return {
    left: (
      <div className="spread-pad spread-duo">
        {photos[0] && <Polaroid photo={photos[0]} />}
      </div>
    ),
    right: (
      <div className="spread-pad spread-closing">
        {spread.title && <h2 className="spread-title">{spread.title}</h2>}
        {spread.text && <p className="spread-text">{spread.text}</p>}
        {spread.signature && <p className="spread-signature">{spread.signature}</p>}
      </div>
    ),
  };
}
