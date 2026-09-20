import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { pollenTexture } from './materials/veinTexture';
import { hash01 } from './petalRig';

const COUNT = 140;

export interface PollenHandle {
  /** Motas sueltas desde un punto: hoja acariciada, disco tocado, ceremonia. */
  burst(origin: THREE.Vector3, amount: number, spread?: number): void;
}

interface PollenProps {
  introRef: React.RefObject<number>;
  reduced: boolean;
  throttled: boolean;
}

/**
 * El polen es `Points` y se saca del raycast explicitamente: sin eso, cada
 * `pointermove` probaria 140 particulas para nada.
 */
export const FloatingPollen = forwardRef<PollenHandle, PollenProps>(function FloatingPollen(
  { introRef, reduced, throttled },
  ref,
) {
  const points = useRef<THREE.Points>(null);
  const cursor = useRef(0);
  const skipped = useRef(0);

  const { geometry, material, positions, velocities, lives, homes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const homes = new Float32Array(COUNT * 3);
    const lives = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const a = hash01(i) * Math.PI * 2;
      const r = 0.24 + hash01(i + 13) * 0.42;
      const y = (hash01(i + 27) - 0.4) * 0.7;
      homes[i * 3] = Math.cos(a) * r;
      homes[i * 3 + 1] = y;
      homes[i * 3 + 2] = Math.sin(a) * r * 0.55;
      positions[i * 3] = homes[i * 3];
      positions[i * 3 + 1] = homes[i * 3 + 1];
      positions[i * 3 + 2] = homes[i * 3 + 2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      map: pollenTexture(),
      size: 0.022,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: '#FFDF9B',
    });

    return { geometry, material, positions, velocities, lives, homes };
  }, []);

  useImperativeHandle(ref, () => ({
    burst(origin, amount, spread = 0.9) {
      for (let n = 0; n < amount; n++) {
        const i = cursor.current;
        cursor.current = (cursor.current + 1) % COUNT;
        positions[i * 3] = origin.x;
        positions[i * 3 + 1] = origin.y;
        positions[i * 3 + 2] = origin.z;
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI - Math.PI / 2;
        const s = (0.12 + Math.random() * 0.22) * spread;
        velocities[i * 3] = Math.cos(a) * Math.cos(e) * s;
        velocities[i * 3 + 1] = Math.sin(e) * s + 0.06;
        velocities[i * 3 + 2] = Math.sin(a) * Math.cos(e) * s * 0.6;
        lives[i] = 1;
      }
    },
  }));

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    if (throttled) {
      skipped.current += delta;
      if (skipped.current < 1 / 30) return;
      skipped.current = 0;
    }
    const dt = Math.min(delta, 1 / 30);
    const intro = introRef.current;

    // El polen empieza a emitirse a 1 750 ms.
    const target = intro < 1750 ? 0 : 0.85;
    material.opacity += (target - material.opacity) * Math.min(1, dt * 2.2);

    if (reduced) {
      // Estatico: solo parpadeo de opacidad.
      material.opacity *= 0.96 + 0.04 * Math.sin(state.clock.elapsedTime * 0.8);
      return;
    }

    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      if (lives[i] > 0) {
        lives[i] = Math.max(0, lives[i] - dt * 0.55);
        velocities[ix + 1] -= 0.12 * dt;
        velocities[ix] *= 0.965;
        velocities[ix + 1] *= 0.965;
        velocities[ix + 2] *= 0.965;
        positions[ix] += velocities[ix] * dt;
        positions[ix + 1] += velocities[ix + 1] * dt;
        positions[ix + 2] += velocities[ix + 2] * dt;
      } else {
        // Movimiento browniano alrededor de su sitio.
        const p = hash01(i) * 6.28;
        positions[ix] += Math.sin(t * 0.42 + p) * 0.02 * dt;
        positions[ix + 1] += (Math.cos(t * 0.33 + p) * 0.03 + 0.006) * dt;
        positions[ix + 2] += Math.sin(t * 0.27 + p * 1.7) * 0.015 * dt;

        // Reengancha despacio a su posicion de referencia.
        positions[ix] += (homes[ix] - positions[ix]) * 0.4 * dt;
        positions[ix + 1] += (homes[ix + 1] - positions[ix + 1]) * 0.4 * dt;
        positions[ix + 2] += (homes[ix + 2] - positions[ix + 2]) * 0.4 * dt;
      }
    }

    (points.current?.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} raycast={() => null} />;
});
