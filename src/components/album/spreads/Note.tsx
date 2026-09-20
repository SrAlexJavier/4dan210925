import type { SpreadProps } from '../AlbumSpread';
import { Polaroid } from '../Polaroid';

export function Note({ photos, spread }: SpreadProps) {
  return {
    left: (
      <div className="spread-pad spread-duo">
        {photos[0] && <Polaroid photo={photos[0]} />}
      </div>
    ),
    right: (
      <div className="spread-pad spread-note">
        {spread.title && <h2 className="spread-title">{spread.title}</h2>}
        {spread.text && <p className="spread-text">{spread.text}</p>}
        {photos[1] && <Polaroid photo={photos[1]} className="polaroid--small" />}
        {spread.signature && <p className="spread-signature">{spread.signature}</p>}
      </div>
    ),
  };
}
