import type * as THREE from 'three';

/**
 * Doblado del limbo de la hoja en el vertex shader.
 *
 * Rotar el peciolo mueve la hoja pero la deja rigida; una hoja de girasol se
 * comba. `w` con exponente 1.6 es lo que hace que la base apenas se mueva y
 * la punta se doble mucho, que es como se comporta una hoja sujeta por su
 * peciolo.
 */

export interface BendUniforms {
  uBend: { value: number };
  uLeafLength: { value: number };
  /** Posicion del barrido de luz por la nervadura, 0 -> 1. >1 apagado. */
  uSweep: { value: number };
}

/**
 * Idempotente a proposito: en StrictMode los `useMemo` se invocan dos veces
 * durante el desarrollo, y encadenar `onBeforeCompile` consigo mismo duplica
 * las declaraciones del shader y lo deja sin compilar.
 */
export function attachBend(
  material: THREE.Material,
  leafLength: number,
): BendUniforms {
  const existing = (material.userData as { bend?: BendUniforms }).bend;
  if (existing) {
    existing.uLeafLength.value = leafLength;
    return existing;
  }

  const uniforms: BendUniforms = {
    uBend: { value: 0 },
    uLeafLength: { value: leafLength },
    uSweep: { value: 2 },
  };

  (material.userData as { bend?: BendUniforms }).bend = uniforms;

  const prev = material.onBeforeCompile?.bind(material);

  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uBend = uniforms.uBend;
    shader.uniforms.uLeafLength = uniforms.uLeafLength;
    shader.uniforms.uSweep = uniforms.uSweep;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uBend;
         uniform float uLeafLength;
         varying float vLeafV;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float w = pow(clamp(transformed.y / uLeafLength, 0.0, 1.0), 1.6);
           float a = uBend * 1.25 * w;
           transformed.z += sin(a) * transformed.y * 0.5;
           transformed.y *= cos(a * 0.45);
           vLeafV = clamp(transformed.y / uLeafLength, 0.0, 1.0);
         }`,
      );

    // Barrido de luz por la nervadura al pasar el puntero: una banda estrecha
    // que recorre la hoja de la base a la punta en 260 ms.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uSweep;
         varying float vLeafV;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
         {
           float band = 1.0 - smoothstep(0.0, 0.16, abs(vLeafV - uSweep));
           gl_FragColor.rgb += vec3(0.30, 0.42, 0.22) * band * 0.55;
         }`,
      );
  };

  const baseKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${baseKey ? baseKey() : ''}|bend-v1`;

  return uniforms;
}
