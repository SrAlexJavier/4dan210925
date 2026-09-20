import * as THREE from 'three';

/**
 * Translucidez SIN `transmission`.
 *
 * `MeshPhysicalMaterial` con `transmission > 0` obliga al renderer a
 * renderizar la escena opaca a un render target adicional cada frame. Sobre
 * decenas de petalos y tres hojas, en un movil de gama media, eso solo ya se
 * lleva por delante el objetivo de 50 fps.
 *
 * Lo que queremos no es refraccion: es que un petalo iluminado por detras se
 * encienda. Eso es un termino de dispersion envolvente y cuesta cuatro
 * instrucciones en el fragment shader, cero pases extra.
 */

export interface BacklitUniforms {
  uBacklight: { value: THREE.Color };
  uWrap: { value: number };
  /** Direccion hacia la luz, en espacio de vista. Se actualiza por frame. */
  uLightDirV: { value: THREE.Vector3 };
}

export interface BacklitMaterial extends THREE.MeshPhysicalMaterial {
  userData: { backlit: BacklitUniforms };
}

export function makeBacklitMaterial(
  params: THREE.MeshPhysicalMaterialParameters,
  opts: { backlight?: THREE.ColorRepresentation; wrap?: number } = {},
): BacklitMaterial {
  const material = new THREE.MeshPhysicalMaterial(params) as BacklitMaterial;

  const uniforms: BacklitUniforms = {
    uBacklight: { value: new THREE.Color(opts.backlight ?? '#FFD98A') },
    uWrap: { value: opts.wrap ?? 0.55 },
    uLightDirV: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() },
  };
  material.userData.backlit = uniforms;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBacklight = uniforms.uBacklight;
    shader.uniforms.uWrap = uniforms.uWrap;
    shader.uniforms.uLightDirV = uniforms.uLightDirV;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uBacklight;
         uniform float uWrap;
         uniform vec3 uLightDirV;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
         {
           // vNormal esta en espacio de vista, igual que uLightDirV.
           float backNdotL = clamp(-dot(normalize(vNormal), normalize(uLightDirV)), 0.0, 1.0);
           float wrapped = pow(backNdotL, 2.2) * uWrap;
           gl_FragColor.rgb += uBacklight * wrapped * (1.0 - roughnessFactor * 0.4);
         }`,
      );
  };

  // Dos materiales con el mismo codigo comparten programa; esta clave evita
  // que three los trate como incompatibles.
  material.customProgramCacheKey = () => 'backlit-physical-v1';

  return material;
}

const tmp = new THREE.Vector3();

/** Actualiza la direccion de luz en espacio de vista. Una vez por frame. */
export function updateBacklight(
  material: BacklitMaterial | null | undefined,
  lightWorldPosition: THREE.Vector3,
  camera: THREE.Camera,
) {
  const u = material?.userData?.backlit;
  // Un `Material.copy()` deja `userData` como objetos planos: si alguien clona
  // el material, los uniforms dejan de ser Vector3 y hay que ignorarlos.
  if (!u || typeof u.uLightDirV?.value?.copy !== 'function') return;
  tmp.copy(lightWorldPosition).normalize().transformDirection(camera.matrixWorldInverse);
  u.uLightDirV.value.copy(tmp);
}
