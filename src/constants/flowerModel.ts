/**
 * Todas las proporciones del girasol, normalizadas con
 * **diámetro de la cabeza = 1.0**. Ningún número mágico vive fuera de aquí.
 */

const DEG = Math.PI / 180;

export const GOLDEN_ANGLE = 137.507 * DEG;

/* ── Disco ─────────────────────────────────────────────────────────── */

export const DISC = {
  radius: 0.26,
  /** z = domeHeight · (1 − (r/rmax)²) */
  domeHeight: 0.052,
  seedCount: 420,
  /** r(n) = seedRadiusK · √n */
  seedRadiusK: 0.0127,
  seedScaleBase: 0.0165,
  /** Frente de floración: 1 = nada abierto, 0 = abierto hasta el centro. */
  openFrontStart: 0.78,
  openFrontEnd: 0.3,
  /** La flor madura despacio mientras la página está abierta. */
  maturationMs: 240_000,
} as const;

export const DISC_RMAX = DISC.seedRadiusK * Math.sqrt(DISC.seedCount - 1);

export function seedPolar(n: number) {
  const r = DISC.seedRadiusK * Math.sqrt(n);
  const theta = n * GOLDEN_ANGLE;
  const rNorm = r / DISC_RMAX;
  return { r, theta, rNorm, scale: DISC.seedScaleBase * (0.55 + 0.45 * rNorm) };
}

export function domeZ(r: number) {
  const t = Math.min(r / DISC_RMAX, 1);
  return DISC.domeHeight * (1 - t * t);
}

/* ── Lígulas: anillo exterior, interactivo ─────────────────────────── */

export const LIGULE = {
  count: 21,
  birthRadius: 0.24,
  length: 0.26,
  width: 0.088,
  tilt: 12 * DEG,
  /** Torsión propia de cada lígula, ±. */
  twist: 4 * DEG,
  segW: 4,
  segL: 11,
} as const;

/** Anillo medio: solo profundidad. InstancedMesh. */
export const MID_RING = {
  count: 13,
  scale: 0.82,
  tilt: 26 * DEG,
  phase: GOLDEN_ANGLE,
  birthRadius: 0.225,
} as const;

/** Corona de transición: esconde la costura disco↔pétalo. InstancedMesh. */
export const CROWN = {
  count: 21,
  scale: 0.22,
  tilt: 58 * DEG,
  birthRadius: 0.255,
} as const;

/* ── Tallo ─────────────────────────────────────────────────────────── */

export const STEM = {
  length: 1.55,
  baseRadius: 0.021,
  neckRadius: 0.014,
  lateralDrift: 0.03,
  radialSegments: 8,
  tubularSegments: 28,
} as const;

/* ── Hojas ─────────────────────────────────────────────────────────── */

export interface LeafSpec {
  id: number;
  length: number;
  width: number;
  /** Altura de inserción en el tallo, 0 = base, 1 = cuello. */
  height: number;
  azimuth: number;
  /**
   * Largo del pecíolo, en diámetros de cabeza. El alcance total de la hoja es
   * `petiole + length`: es lo que decide si la hoja frontal llega de verdad a
   * solapar la esquina del álbum o se queda en el corredor.
   */
  petiole: number;
  /** Elevación del pecíolo en reposo. */
  elevation: number;
  /** La hoja que cruza por delante del álbum. */
  crosses?: boolean;
}

export const LEAVES: LeafSpec[] = [
  { id: 0, length: 0.55, width: 0.44, height: 0.34, azimuth: 205 * DEG, petiole: 0.1, elevation: 16 * DEG },
  {
    // Es la hoja que cruza por delante del album: su limbo es grande a
    // proposito, porque el primer plano se gana con la hoja, no con un
    // peciolo largo que se lee como un alambre.
    id: 1,
    length: 0.98,
    width: 0.6,
    height: 0.8,
    azimuth: 332 * DEG,
    petiole: 0.2,
    elevation: 16 * DEG,
    crosses: true,
  },
  { id: 2, length: 0.38, width: 0.31, height: 0.86, azimuth: 160 * DEG, petiole: 0.08, elevation: 22 * DEG },
];

/** 900–1099 px: la hoja frontal acorta su alcance. */
export const CROSSING_SCALE_MD = 0.62;

/** < 600 px: L3 se elimina y L1/L2 se pliegan hacia el plano de cámara. */
export const LEAVES_SM: LeafSpec[] = [
  { id: 0, length: 0.5, width: 0.4, height: 0.34, azimuth: 205 * DEG, petiole: 0.08, elevation: 16 * DEG },
  { id: 1, length: 0.44, width: 0.36, height: 0.66, azimuth: 335 * DEG, petiole: 0.1, elevation: 12 * DEG },
];

export const LEAF = {
  /** Serrado del borde. */
  teeth: 17,
  toothDepth: 0.018,
  outlineSamples: 34,
  /** Deformación en reposo. */
  droop: 0.18,
  channel: 0.09,
  /** Doblado máximo del pecíolo al acariciar. */
  petioleMax: 22 * DEG,
  bendMax: 1,
  restingWeightPerPetal: 0.02,
  maxRestingPetals: 3,
} as const;

/* ── Tirón del pétalo ──────────────────────────────────────────────── */

export const PULL = {
  /** En diámetros de cabeza. El pétalo nunca se estira más. */
  max: 0.42,
  /** rawPull por encima de este valor arma el desprendimiento. */
  armThreshold: 0.55,
  petalRotMax: 38 * DEG,
  petalStretchMax: 0.04,
  hoverLift: 5 * DEG,
  gap: 0.006,
  share: {
    head: 0.16,
    neck: 0.09,
    stem: 0.04,
    neighbour: 0.11,
  },
  spring: { stiffness: 180, damping: 14, mass: 0.6 },
  headRecoil: 0.35,
  headRecoilMs: 900,
} as const;

/* ── Caída ─────────────────────────────────────────────────────────── */

export const FALL = {
  gravity: 0.55,
  /** Por frame a 60 fps, escalado por dt. */
  drag: 0.86,
  poolSize: 8,
  groundY: -0.88,
  settleMs: 500,
  restMs: 7000,
  fadeMs: 1200,
  detachSpeed: 0.55,
  detachOutward: 0.6,
  detachCone: 12 * DEG,
} as const;

/* ── Refloración ───────────────────────────────────────────────────── */

export const REBLOOM = {
  perPetalMs: 380,
  staggerMs: 140,
  overshoot: 1.04,
  missingForButton: 5,
  ceremonyMs: 2200,
} as const;

/* ── Coreografía de entrada (§12.1) ────────────────────────────────── */

export const BLOOM_IN = {
  stem: { at: 0, dur: 620 },
  leaves: { at: 380, dur: 480, stagger: 90 },
  disc: { at: 560, dur: 400 },
  rings: { at: 700, stagger: 16 },
  openFront: { at: 1400, dur: 550 },
  pollen: { at: 1750 },
  chrome: { at: 1950, dur: 500 },
  invitation: { at: 2100, dur: 900 },
  hint: { at: 4500, dur: 3000 },
  total: 1950,
} as const;

/* ── Movimiento en reposo ──────────────────────────────────────────── */

export const IDLE = {
  windCycle: 10.5,
  windAmplitude: 0.055,
  windAlbumFactor: 0.45,
  helioYaw: 12 * DEG,
  helioPitch: 8 * DEG,
  helioDamping: 0.06,
  /** Mientras el álbum está abierto. */
  albumYaw: 18 * DEG,
  albumPitch: -4 * DEG,
  albumLeafTilt: 6 * DEG,
  albumStemGive: 3 * DEG,
  albumBrightness: 0.88,
  albumShiftX: -0.18,
} as const;

/* ── Encuadre (§2) ─────────────────────────────────────────────────── */

export const FRAMING = {
  headFractionOfHeight: 0.44,
  plantWidthInHeads: 1.55,
  columnFraction: 0.46,
  axisFraction: 0.25,
  yFraction: 0.06,
} as const;

export const FRAMING_SM = {
  headFractionOfHeight: 0.34,
  plantWidthInHeads: 1.4,
  columnFraction: 0.88,
  axisFraction: 0.5,
  yFraction: 0.12,
} as const;
