import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { domeZ } from '../../constants/flowerModel';
import { PALETTE } from '../../constants/theme';
import { createLiguleGeometry } from './geometry';
import { liguleVeins } from './materials/veinTexture';
import { makeBacklitMaterial } from './materials/backlitPhysical';
import { easeOutBack, hash01 } from './petalRig';

interface RingProps {
  count: number;
  scale: number;
  tilt: number;
  birthRadius: number;
  phase?: number;
  introRef: React.RefObject<number>;
  startAt: number;
  stagger: number;
  reduced: boolean;
}

/**
 * Anillo medio y corona de transicion: no son interactivos, asi que van en un
 * `InstancedMesh` y cuestan una draw call cada uno. Compartir material no
 * fusiona draw calls; instanciar si.
 */
export function LiguleRingInstanced({
  count,
  scale,
  tilt,
  birthRadius,
  phase = 0,
  introRef,
  startAt,
  stagger,
  reduced,
}: RingProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const done = useRef(false);
  const geometry = useMemo(() => createLiguleGeometry(), []);
  const veins = useMemo(() => liguleVeins(), []);

  const material = useMemo(
    () =>
      makeBacklitMaterial(
        {
          vertexColors: true,
          map: veins.shade,
          roughnessMap: veins.rough,
          roughness: 0.55,
          metalness: 0,
          sheen: 0.65,
          sheenRoughness: 0.4,
          sheenColor: new THREE.Color('#FFE9A0'),
          side: THREE.DoubleSide,
          emissive: new THREE.Color(PALETTE.petalBase),
          emissiveIntensity: 0.02,
        },
        { backlight: '#FFD98A', wrap: 0.5 },
      ),
    [veins],
  );

  const slots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const theta = phase + (i / count) * Math.PI * 2;
        return {
          theta,
          delay: startAt + i * stagger,
          twist: (hash01(i + count * 7) - 0.5) * 0.14,
        };
      }),
    [count, phase, startAt, stagger],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const write = (progressOf: (i: number) => number) => {
    const mesh = ref.current;
    if (!mesh) return;
    slots.forEach((s, i) => {
      const k = progressOf(i);
      dummy.position.set(
        Math.cos(s.theta) * birthRadius,
        Math.sin(s.theta) * birthRadius,
        domeZ(birthRadius) * 0.8,
      );
      dummy.rotation.order = 'ZYX';
      dummy.rotation.set(tilt, s.twist, s.theta - Math.PI / 2);
      dummy.scale.setScalar(scale * k);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.frustumCulled = false;
    write(() => (reduced ? 1 : 0));
    done.current = reduced;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, reduced, birthRadius, tilt, scale]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (done.current) return;
    const intro = introRef.current;
    let complete = true;
    write((i) => {
      const t = (intro - slots[i].delay) / 300;
      if (t < 1) complete = false;
      if (t <= 0) return 0;
      return easeOutBack(Math.min(t, 1), 1.06);
    });
    if (complete) done.current = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, material, count]} raycast={() => null} />
  );
}
