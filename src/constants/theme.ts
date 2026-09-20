/**
 * Fuente única de la paleta. Los mismos hex se declaran en `index.css` como
 * custom properties; aquí viven en la forma que consume Three.
 */
export const PALETTE = {
  nightDeep: '#1E2620',
  nightMid: '#2F3A2E',
  glowWarm: '#6B5A2E',

  petalTip: '#FFE066',
  petalMid: '#FFC93C',
  petalBase: '#D97A0F',
  petalTension: '#FFD873',
  petalFallen: '#E8A93A',

  discDark: '#3A2412',
  discClosed: '#54341A',
  discSeed: '#C08B3E',
  discOpen: '#E8952B',

  leaf: '#5C7A4A',
  leafShadow: '#36492C',
  leafVein: '#7E9668',

  paper: '#F7EFDF',
  paperEdge: '#E3D4B4',
  linen: '#6E7A5C',
  foil: '#C9A227',
  ink: '#3B3128',
} as const;

export const LIGHTS = {
  key: { color: '#FFF3D6', intensity: 2.4, position: [4, 6, 3] as const },
  rim: { color: '#FFB45C', intensity: 1.1, position: [-3.5, 1.5, -4] as const },
  rimPulling: 1.5,
  hemi: { sky: '#FFF0CC', ground: '#2A3326', intensity: 0.45 },
  /** Amortiguación del seguimiento del rim light al puntero. */
  rimDamping: 0.04,
} as const;

export const CAMERA = {
  fov: 32,
  fovSmall: 42,
  position: [0, 0, 6.2] as const,
  near: 0.1,
  far: 24,
} as const;

/** Escala tipográfica 13 / 16 / 20 / 25 / 31 / 39 / 49, razón 1.25. */
export const TYPE_SCALE = [13, 16, 20, 25, 31, 39, 49] as const;

export const BREAKPOINTS = {
  sm: 600,
  md: 900,
  lg: 1100,
} as const;
