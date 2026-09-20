import { useContent } from '../../context/ContentContext';

/** Canto de paginas: nueve franjas, deliberadamente no equiespaciadas. */
const EDGES = [6, 14, 21, 31, 44, 55, 68, 79, 90];

/**
 * Un libro real apoyado sobre una superficie insinuada, centrado en la
 * columna derecha. El portal toma el relevo en cuanto se abre.
 */
export function AlbumPanel() {
  const { content, openAlbum, isAlbumOpen } = useContent();
  const { album } = content;

  if (isAlbumOpen) return null;

  return (
    <div className="album-panel" data-album-surface>
      <button
        type="button"
        className="album-panel__button"
        onClick={openAlbum}
        aria-label={album.openLabel}
        aria-haspopup="dialog"
        data-album-open-button
      >
        <span className="album-cover">
          <span className="album-cover__peek" aria-hidden="true" />
          <svg className="album-cover__linen" aria-hidden="true" focusable="false">
            <filter id="linen-weave">
              <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#linen-weave)" />
          </svg>
          <span className="album-cover__title">{album.coverTitle}</span>
          <span className="album-cover__edges" aria-hidden="true">
            {EDGES.map((top) => (
              <span key={top} style={{ top: `${top}%` }} />
            ))}
          </span>
          <span className="album-cover__ribbon" aria-hidden="true" />
        </span>
      </button>
      <span className="album-panel__cta" aria-hidden="true">
        {album.openLabel}
      </span>
      <span className="album-panel__count">{album.countLabel}</span>
    </div>
  );
}
