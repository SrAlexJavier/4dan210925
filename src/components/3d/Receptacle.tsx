import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { DISC } from '../../constants/flowerModel';
import { PALETTE } from '../../constants/theme';

/**
 * El receptaculo: la copa verde de detras de la cabeza.
 *
 * No es adorno. El tallo termina justo en el centro de la cabeza y las hojas
 * altas nacen a un palmo de ella; sin una pieza que cierre esa union, el tubo
 * del tallo y el peciolo se ven cruzando por delante de los petalos en cuanto
 * la cabeza gira. Un girasol de verdad tiene esta copa, y aqui ademas tapa la
 * costura. Una draw call.
 */
export function Receptacle() {
  const geometry = useMemo(() => {
    // Un casquete que abomba hacia ATRAS (-z). Se construye como el domo del
    // disco pero con el signo invertido, asi que nunca puede quedar por
    // delante de las semillas.
    const radius = DISC.radius * 1.3;
    const g = new THREE.CircleGeometry(radius, 36);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i)) / radius;
      pos.setZ(i, -0.085 * (1 - r * r) - 0.012);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.leafShadow,
        roughness: 0.88,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0, -0.02]}
      raycast={() => null}
    />
  );
}
