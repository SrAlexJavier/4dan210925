import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { BLOOM_IN, type LeafSpec } from '../../constants/flowerModel';
import { PALETTE } from '../../constants/theme';
import { createLeafGeometry, createPetioleGeometry, createProxyGeometry, getStemCurve } from './geometry';
import { leafVeins } from './materials/veinTexture';
import { makeBacklitMaterial, type BacklitMaterial } from './materials/backlitPhysical';
import { attachBend, type BendUniforms } from './materials/bendChunk';
import { PROXY_MATERIAL, easeOutCubic } from './petalRig';

/** Lo que la hoja publica para que el resto de la escena la use. */
export interface LeafRig {
  id: number;
  spec: LeafSpec;
  petioleLength: number;
  anchor: THREE.Group;
  petiole: THREE.Group;
  blade: THREE.Mesh;
  material: BacklitMaterial;
  bend: BendUniforms;
  /** Lo escribe `useLeafInteraction`; la hoja lo lee y compone. */
  drive: {
    caress: number;
    bend: number;
    restingWeight: number;
    albumTilt: number;
  };
}

interface LeafProps {
  spec: LeafSpec;
  order: number;
  petioleLength: number;
  introRef: React.RefObject<number>;
  reduced: boolean;
  register: (id: number, rig: LeafRig | null) => void;
  onOver: (id: number, e: ThreeEvent<PointerEvent>) => void;
  onOut: (id: number, e: ThreeEvent<PointerEvent>) => void;
  onDown: (id: number, e: ThreeEvent<PointerEvent>) => void;
}

const UNFURL_FROM = (-70 * Math.PI) / 180;

export function Leaf({
  spec,
  order,
  petioleLength,
  introRef,
  reduced,
  register,
  onOver,
  onOut,
  onDown,
}: LeafProps) {
  const anchorRef = useRef<THREE.Group>(null);
  const petioleRef = useRef<THREE.Group>(null);
  const bladeRef = useRef<THREE.Mesh>(null);
  const rigRef = useRef<LeafRig | null>(null);

  const geometry = useMemo(
    () => createLeafGeometry({ length: spec.length, width: spec.width }),
    [spec.length, spec.width],
  );
  const petioleGeometry = useMemo(() => createPetioleGeometry(petioleLength), [petioleLength]);
  const proxyGeometry = useMemo(() => createProxyGeometry(), []);
  const veins = useMemo(() => leafVeins(), []);

  /**
   * Una hoja de girasol a contraluz se enciende verde por los bordes y ese es
   * todo el efecto que hace falta: `sheen` + el termino envolvente, nunca
   * `transmission`.
   */
  const material = useMemo(() => {
    const m = makeBacklitMaterial(
      {
        color: new THREE.Color(PALETTE.leaf),
        map: veins.shade,
        bumpMap: veins.bump,
        bumpScale: 0.012,
        roughness: 0.78,
        metalness: 0,
        sheen: 0.22,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#9FB77F'),
        side: THREE.DoubleSide,
        emissive: new THREE.Color(PALETTE.leafVein),
        emissiveIntensity: 0,
      },
      { backlight: '#B9D48C', wrap: 0.42 },
    );
    return m;
  }, [veins]);

  const bend = useMemo(() => attachBend(material, spec.length), [material, spec.length]);

  const petioleMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.leafShadow, roughness: 0.85 }),
    [],
  );

  const anchorPosition = useMemo(() => {
    const p = getStemCurve().getPointAt(THREE.MathUtils.clamp(spec.height, 0, 1));
    return [p.x, p.y, p.z] as [number, number, number];
  }, [spec.height]);

  useEffect(() => {
    const anchor = anchorRef.current;
    const petiole = petioleRef.current;
    const blade = bladeRef.current;
    if (!anchor || !petiole || !blade) return;

    const rig: LeafRig = {
      id: spec.id,
      spec,
      petioleLength,
      anchor,
      petiole,
      blade,
      material,
      bend,
      drive: { caress: 0, bend: 0, restingWeight: 0, albumTilt: 0 },
    };
    rigRef.current = rig;
    register(spec.id, rig);
    return () => {
      rigRef.current = null;
      register(spec.id, null);
    };
  }, [spec, petioleLength, material, bend, register]);

  useEffect(
    () => () => {
      geometry.dispose();
      petioleGeometry.dispose();
      material.dispose();
      petioleMaterial.dispose();
    },
    [geometry, petioleGeometry, material, petioleMaterial],
  );

  useFrame(() => {
    const petiole = petioleRef.current;
    const rig = rigRef.current;
    if (!petiole || !rig) return;

    const start = BLOOM_IN.leaves.at + order * BLOOM_IN.leaves.stagger;
    const t = reduced
      ? 1
      : THREE.MathUtils.clamp((introRef.current - start) / BLOOM_IN.leaves.dur, 0, 1);
    const unfurl = THREE.MathUtils.lerp(UNFURL_FROM, 0, easeOutCubic(t));
    const introBend = THREE.MathUtils.lerp(0.6, 0, easeOutCubic(t));

    const d = rig.drive;
    petiole.rotation.z =
      -Math.PI / 2 + spec.elevation + unfurl + d.caress - d.restingWeight + d.albumTilt;
    bend.uBend.value = introBend + d.bend;
  });

  return (
    <group ref={anchorRef} position={anchorPosition} rotation={[0, spec.azimuth, 0]}>
      <group ref={petioleRef}>
        <mesh geometry={petioleGeometry} material={petioleMaterial} raycast={() => null} />
        <group position={[0, petioleLength, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh ref={bladeRef} geometry={geometry} material={material} raycast={() => null} />
          <mesh
            geometry={proxyGeometry}
            material={PROXY_MATERIAL}
            position={[0, 0, 0.02]}
            scale={[spec.width * 1.05, spec.length * 1.02, 1]}
            onPointerOver={(e) => onOver(spec.id, e)}
            onPointerOut={(e) => onOut(spec.id, e)}
            onPointerDown={(e) => onDown(spec.id, e)}
          />
        </group>
      </group>
    </group>
  );
}
