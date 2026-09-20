/**
 * Tres capas CSS: degradado radial, grano de pelicula y vineta.
 * Cero coste de GPU y es lo que hace que el fondo no parezca un color plano.
 */
export function StageBackground() {
  return (
    <>
      <div className="bg-layer bg-radial" aria-hidden="true" />
      <svg className="bg-layer bg-grain" aria-hidden="true" focusable="false">
        <filter id="film-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-grain)" />
      </svg>
      <div className="bg-layer bg-vignette" aria-hidden="true" />
    </>
  );
}
