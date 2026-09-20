import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { LIGULE, domeZ } from '../../constants/flowerModel';
import { PALETTE } from '../../constants/theme';
import { createLiguleGeometry, createProxyGeometry } from './geometry';
import { liguleVeins } from './materials/veinTexture';
import { makeBacklitMaterial } from './materials/backlitPhysical';
import { PROXY_MATERIAL, hash01, type PetalRig } from './petalRig';

interface LiguleProps {
  index: number;
  register: (index: number, rig: PetalRig | null) => void;
  onOver: (index: number, e: ThreeEvent<PointerEvent>) => void;
  onOut: (index: number, e: ThreeEvent<PointerEvent>) => void;
  onDown: (index: number, e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Una ligula del anillo exterior: malla individual porque se anima y se
 * arranca por separado, con un proxy de colision de dos triangulos para que
 * el raycast no tenga que probar los 88 triangulos de la malla real.
 */
export function Ligule({ index, register, onOver, onOut, onDown }: LiguleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => createLiguleGeometry(), []);
  const proxyGeometry = useMemo(() => createProxyGeometry(), []);
  const veins = useMemo(() => liguleVeins(), []);

  const material = useMemo(() => {
    const m = makeBacklitMaterial(
      {
        vertexColors: true,
        map: veins.shade,
        roughnessMap: veins.rough,
        roughness: 0.52,
        metalness: 0,
        sheen: 0.65,
        sheenRoughness: 0.4,
        sheenColor: new THREE.Color('#FFE9A0'),
        side: THREE.DoubleSide,
        emissive: new THREE.Color(PALETTE.petalTip),
        emissiveIntensity: 0,
      },
      { backlight: '#FFD98A', wrap: 0.55 },
    );
    // +-2 % determinista: dos vecinos nunca son identicos.
    m.color.setScalar(1 + (hash01(index) - 0.5) * 0.04);
    return m;
  }, [index, veins]);

  useEffect(() => () => material.dispose(), [material]);

  const theta = (index / LIGULE.count) * Math.PI * 2;

  useEffect(() => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;
    const twist = (hash01(index + 91) - 0.5) * 2 * LIGULE.twist;
    group.rotation.order = 'ZYX';
    group.rotation.set(LIGULE.tilt, twist, theta - Math.PI / 2);
    group.matrixAutoUpdate = false;
    group.updateMatrix();
    register(index, { index, theta, group, mesh, material, twist });
    return () => register(index, null);
  }, [index, theta, material, register]);

  return (
    <group
      ref={groupRef}
      position={[
        Math.cos(theta) * LIGULE.birthRadius,
        Math.sin(theta) * LIGULE.birthRadius,
        domeZ(LIGULE.birthRadius) * 0.8,
      ]}
    >
      <mesh ref={meshRef} geometry={geometry} material={material} raycast={() => null} />
      <mesh
        geometry={proxyGeometry}
        material={PROXY_MATERIAL}
        position={[0, 0, 0.012]}
        scale={[LIGULE.width * 1.6, LIGULE.length * 1.08, 1]}
        onPointerOver={(e) => onOver(index, e)}
        onPointerOut={(e) => onOut(index, e)}
        onPointerDown={(e) => onDown(index, e)}
      />
    </group>
  );
}
