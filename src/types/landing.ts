export type SpreadLayout = 'duo' | 'hero' | 'collage' | 'note' | 'closing';
export type PetalMode = 'oracle' | 'memory' | 'none';
export type PhotoAccent = 'washi' | 'clip' | 'petal' | 'stamp';

export interface PhotoItem {
  id: string;
  src: string;
  /** Obligatorio: las nueve fotos son contenido, no decoración. */
  alt: string;
  caption?: string;
  date?: string;
  /** -3 a 3 grados. */
  rotation: number;
  accent?: PhotoAccent;
  /** Color de reserva mientras el JPEG decodifica. Evita el hueco blanco. */
  dominantColor: string;
}

export interface OracleConfig {
  enabled: boolean;
  /** Se alternan por contador de arranques, no por pétalo. */
  phrases: [string, string];
  /** Sustituye a la frase en el arranque nº 21. */
  final: string;
}

export interface FlowerConfig {
  petalMode: PetalMode;
  oracle: OracleConfig;
  /** 21 frases, usadas si petalMode === 'memory'. */
  petalMemories: string[];
  /** Frases al tocar el centro de la flor. */
  discWhispers: string[];
  hint: string;
  rebloomIdleMs: number;
}

export interface HeroConfig {
  title: string;
  subtitle: string;
}

export interface SpreadItem {
  id: string;
  layout: SpreadLayout;
  /** Ids de PhotoItem. */
  photos: string[];
  title?: string;
  text?: string;
  signature?: string;
}

export interface AlbumConfig {
  coverTitle: string;
  countLabel: string;
  openLabel: string;
  closeLabel: string;
  indicatorLabel: string;
  photos: PhotoItem[];
  spreads: SpreadItem[];
}

export interface LandingContent {
  hero: HeroConfig;
  flower: FlowerConfig;
  album: AlbumConfig;
}
