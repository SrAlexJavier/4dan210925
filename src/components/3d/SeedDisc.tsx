import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { DISC } from '../../constants/flowerModel';
import { PALETTE } from '../../constants/theme';
import { createDiscBaseGeometry, createSeedGeometry, seedLayout } from './geometry';
import { smoothstep } from './petalRig';

interface SeedDiscProps {
  /** Milisegundos desde el montaje; gobierna el florecimiento de entrada. */
  introRef: React.RefObject<number>;
  reduced: boolean;
  /** Con el album abierto la flor ya no es el foco: 30 fps bastan. */
  throttled: boolean;
}

/**
 * En *Helianthus annuus* los flosculos del disco abren de la periferia hacia
 * el centro: la corona de polen brillante esta en el BORDE y el centro es el
 * territorio apretado y oscuro de lo que aun no ha abierto. v2 lo tenia
 * invertido.
 *
 * `uOpenFront` baja de 0.78 a 0.30 a lo largo de 240 s y se reinicia: la flor
 * madura mientras la pagina esta abierta. No hay animacion perceptible en
 * ningun frame, pero a los cuatro minutos la flor no es la misma.
 */
export function SeedDisc({ introRef, reduced, throttled }: SeedDiscProps) {
  const skipped = useRef(0);
  const instanced = useRef<THREE.InstancedMesh>(null);
  const seedGeometry = useMemo(() => createSeedGeometry(), []);
  const baseGeometry = useMemo(() => createDiscBaseGeometry(), []);
  const layout = useMemo(() => seedLayout(), []);

  const uniforms = useMemo(
    () => ({
      uOpenFront: { value: 1 },
      uDiscDark: { value: new THREE.Color(PALETTE.discClosed) },
      uDiscOpen: { value: new THREE.Color(PALETTE.discOpen) },
      uEmissive: { value: 0.22 },
    }),
    [],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.74,
      metalness: 0.04,
    });

    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aRadius;
           uniform float uOpenFront;
           varying float vOpen;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vOpen = smoothstep(uOpenFront - 0.14, uOpenFront + 0.06, aRadius);
           transformed *= mix(0.82, 1.0, vOpen);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uDiscDark;
           uniform vec3 uDiscOpen;
           uniform float uEmissive;
           varying float vOpen;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           diffuseColor.rgb *= mix(uDiscDark, uDiscOpen, vOpen);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           totalEmissiveRadiance += uDiscOpen * uEmissive * vOpen;`,
        );
    };

    m.customProgramCacheKey = () => 'seed-disc-v1';
    return m;
  }, [uniforms]);

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.discDark,
        roughness: 0.86,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    const mesh = instanced.current;
    if (!mesh) return;

    const radii = new Float32Array(layout.length);
    const dummy = new THREE.Object3D();

    layout.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, 0, i * 1.7);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      radii[i] = s.rNorm;
    });

    mesh.geometry.setAttribute('aRadius', new THREE.InstancedBufferAttribute(radii, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [layout]);

  useEffect(
    () => () => {
      material.dispose();
      baseMaterial.dispose();
    },
    [material, baseMaterial],
  );

  useFrame((_, delta) => {
    if (throttled) {
      skipped.current += delta;
      if (skipped.current < 1 / 30) return;
      skipped.current = 0;
    }

    const intro = introRef.current;
    // Entrada: el borde del disco se enciende entre 1 400 y 1 950 ms.
    if (intro < 1950) {
      const t = smoothstep(1400, 1950, intro);
      uniforms.uOpenFront.value = THREE.MathUtils.lerp(1, DISC.openFrontStart, t);
      return;
    }

    if (reduced) {
      uniforms.uOpenFront.value = DISC.openFrontStart;
      return;
    }

    // Maduracion: 240 s en bucle, por debajo del umbral de percepcion.
    const span = DISC.openFrontStart - DISC.openFrontEnd;
    const step = (span / (DISC.maturationMs / 1000)) * delta;
    let next = uniforms.uOpenFront.value - step;
    if (next < DISC.openFrontEnd) next = DISC.openFrontStart;
    uniforms.uOpenFront.value = next;
  });

  return (
    <group>
      <mesh geometry={baseGeometry} material={baseMaterial} raycast={() => null} />
      <instancedMesh
        ref={instanced}
        args={[seedGeometry, material, layout.length]}
        raycast={() => null}
      />
    </group>
  );
}
