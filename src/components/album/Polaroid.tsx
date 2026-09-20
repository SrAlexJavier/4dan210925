import { useState, type CSSProperties } from 'react';
import type { PhotoItem } from '../../types/landing';

function Accent({ kind }: { kind?: PhotoItem['accent'] }) {
  if (!kind) return null;
  if (kind === 'washi') return <span className="accent accent--washi" aria-hidden="true" />;

  if (kind === 'clip') {
    return (
      <svg className="accent accent--clip" viewBox="0 0 22 46" aria-hidden="true">
        <path
          d="M11 43V9a5 5 0 0 1 10 0v28a8 8 0 0 1-16 0V11"
          fill="none"
          stroke="#9aa39b"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === 'stamp') {
    return (
      <svg className="accent accent--stamp" viewBox="0 0 42 46" aria-hidden="true">
        <path
          d="M3 3h36v40H3z"
          fill="#f2e6cd"
          stroke="#c9a227"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        <circle cx="21" cy="20" r="9" fill="none" stroke="#8e6f19" strokeWidth="1.2" />
        <path d="M13 34h16" stroke="#8e6f19" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  // Una ligula del mismo girasol, prensada: mismo perfil, desaturada, con
  // pliegue. Cierra el circulo entre las dos mitades de la pantalla.
  return (
    <svg className="accent accent--petal" viewBox="0 0 30 64" aria-hidden="true">
      <path
        d="M15 63c-7-10-11-22-11-33C4 18 9 6 15 1c6 5 11 17 11 29 0 11-4 23-11 33Z"
        fill="#d9bb72"
        stroke="#b99a52"
        strokeWidth="0.8"
      />
      <path d="M15 4v56" stroke="#b08f45" strokeWidth="0.9" opacity="0.7" />
      <path d="M9 22c4 4 8 4 12 0" fill="none" stroke="#b08f45" strokeWidth="0.7" opacity="0.5" />
    </svg>
  );
}

export function Polaroid({ photo, className }: { photo: PhotoItem; className?: string }) {
  const [ready, setReady] = useState(false);

  return (
    <figure
      className={className ? `polaroid ${className}` : 'polaroid'}
      style={{ rotate: `${photo.rotation}deg`, margin: 0 }}
    >
      <div
        className="polaroid__frame"
        style={{ '--fallback': photo.dominantColor } as CSSProperties}
      >
        <img
          src={photo.src}
          alt={photo.alt}
          decoding="async"
          data-ready={ready ? 'true' : 'false'}
          onLoad={() => setReady(true)}
          onError={() => setReady(false)}
        />
      </div>
      {photo.caption && <figcaption className="polaroid__caption">{photo.caption}</figcaption>}
      {photo.date && <span className="polaroid__date">{photo.date}</span>}
      <Accent kind={photo.accent} />
    </figure>
  );
}
