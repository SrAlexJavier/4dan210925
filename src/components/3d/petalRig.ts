import * as THREE from 'three';
import { LIGULE, PULL } from '../../constants/flowerModel';
import type { BacklitMaterial } from './materials/backlitPhysical';

/** Material invisible compartido por los 24 proxies de colision. */
export const PROXY_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });

/**
 * `material.visible = false`, NO `mesh.visible = false`: el renderer comprueba
 * `material.visible` antes de encolar el objeto, asi que no se dibuja, pero el
 * objeto sigue en el grafo y el raycaster lo prueba sin depender de la version
 * de three ni de la configuracion de R3F.
 */

export type PetalState =
  | { k: 'attached' }
  | { k: 'hovered' }
  | { k: 'pulling'; rawPull: number; twist: number; armed: boolean }
  | { k: 'springing'; startedAt: number; from: number }
  | { k: 'gone' }
  | { k: 'regrowing'; startedAt: number };

export interface PetalRig {
  index: number;
  theta: number;
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: BacklitMaterial;
  twist: number;
}

export function makePetalStates(count: number): PetalState[] {
  return Array.from({ length: count }, () => ({ k: 'attached' }) as PetalState);
}

/** Angulo de una ligula del anillo exterior. */
export function liguleTheta(index: number, count = LIGULE.count) {
  return (index / count) * Math.PI * 2;
}

/**
 * Curva de resistencia asintotica. Lineal se siente a goma barata; asi el
 * petalo nunca se estira mas de PULL.max y lo que sigue creciendo es la
 * tension acumulada, que es lo que decide el umbral.
 */
export function visualPull(rawPull: number) {
  return PULL.max * (1 - Math.exp(-Math.max(0, rawPull) / PULL.max));
}

/** Ruido determinista por indice: dos vecinos nunca son identicos. */
export function hash01(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const springTmp = { value: 0 };

/**
 * Muelle con rebote real, no `ease-out`. ~620 ms, dos oscilaciones visibles.
 * Devuelve el factor 1 -> 0 del tiron residual.
 */
export function springDecay(elapsedMs: number, reduced: boolean) {
  const { stiffness, damping, mass } = PULL.spring;
  const t = elapsedMs / 1000;
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (reduced || zeta >= 1) {
    // Critico-amortiguado: la accion se mantiene, el rebote no.
    springTmp.value = (1 + omega * t) * Math.exp(-omega * t);
    return springTmp.value;
  }

  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return (
    Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  );
}

export function easeOutBack(t: number, overshoot = 1.04) {
  const c = (overshoot - 1) * 10 + 1.70158;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
