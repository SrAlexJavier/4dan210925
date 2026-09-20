import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PALETTE } from '../../constants/theme';
import { createStemGeometry } from './geometry';
import { easeOutCubic } from './petalRig';
import { BLOOM_IN } from '../../constants/flowerModel';

interface StemProps {
  introRef: React.RefObject<number>;
  reduced: boolean;
}

export function Stem({ introRef, reduced }: StemProps) {
  const ref = useRef<THREE.Mesh>(null);
  const done = useRef(false);
  const { geometry } = useMemo(() => createStemGeometry(0.4), []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.leaf,
        roughness: 0.82,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    if (ref.current) ref.current.scale.y = reduced ? 1 : 0.001;
    done.current = reduced;
  }, [reduced]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (done.current || !ref.current) return;
    const t = Math.min(1, introRef.current / BLOOM_IN.stem.dur);
    ref.current.scale.y = Math.max(0.001, easeOutCubic(t));
    if (t >= 1) done.current = true;
  });

  return <mesh ref={ref} geometry={geometry} material={material} raycast={() => null} />;
}
