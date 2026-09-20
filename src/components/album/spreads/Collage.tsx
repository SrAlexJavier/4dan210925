import type { SpreadProps } from '../AlbumSpread';
import { Polaroid } from '../Polaroid';

export function Collage({ photos, spread }: SpreadProps) {
  return {
    left: (
      <div className="spread-pad" style={{ justifyContent: 'flex-end' }}>
        {spread.title && <h2 className="spread-title">{spread.title}</h2>}
        {spread.text && <p className="spread-text">{spread.text}</p>}
      </div>
    ),
    right: (
      <div className="spread-pad spread-collage">
        {photos.map((photo) => (
          <Polaroid key={photo.id} photo={photo} />
        ))}
      </div>
    ),
  };
}
