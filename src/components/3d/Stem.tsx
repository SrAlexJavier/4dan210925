import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { PALETTE } from '../../constants/theme';
import { createProxyGeometry, createStemGeometry } from './geometry';
import { PROXY_MATERIAL, easeOutCubic } from './petalRig';
import { BLOOM_IN, STEM } from '../../constants/flowerModel';

interface StemProps {
  introRef: React.RefObject<number>;
  reduced: boolean;
  onOver: (e: ThreeEvent<PointerEvent>) => void;
  onOut: (e: ThreeEvent<PointerEvent>) => void;
  onDown: (e: ThreeEvent<PointerEvent>) => void;
}

/** El proxy no llega hasta el cuello: ahi manda la cabeza. */
const PROXY_LENGTH = STEM.length - 0.62;

export function Stem({ introRef, reduced, onOver, onOut, onDown }: StemProps) {
  const ref = useRef<THREE.Mesh>(null);
  const done = useRef(false);
  const { geometry } = useMemo(() => createStemGeometry(0.4), []);
  const proxyGeometry = useMemo(() => createProxyGeometry(), []);

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

  return (
    <>
      <mesh ref={ref} geometry={geometry} material={material} raycast={() => null} />
      {/* Banda generosa por delante del tubo: el tallo es fino y hay que
          poder agarrarlo tambien con el dedo. */}
      <mesh
        geometry={proxyGeometry}
        material={PROXY_MATERIAL}
        position={[0, 0.1, 0.07]}
        scale={[0.17, PROXY_LENGTH, 1]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerDown={onDown}
      />
    </>
  );
}
