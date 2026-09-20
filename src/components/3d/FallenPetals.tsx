import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FALL } from '../../constants/flowerModel';
import { PALETTE } from '../../constants/theme';
import { createLiguleGeometry } from './geometry';
import { liguleVeins } from './materials/veinTexture';
import { makeBacklitMaterial } from './materials/backlitPhysical';
import { easeOutCubic } from './petalRig';
import type { LeafRig } from './Leaf';

type Phase = 'idle' | 'falling' | 'settling' | 'resting' | 'fading';

interface Slot {
  mesh: THREE.Mesh;
  phase: Phase;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  phaseOffset: number;
  since: number;
  /** Si aterriza sobre una hoja, cual, y su posicion en el espacio de esa hoja. */
  leafId: number | null;
  leafLocal: THREE.Vector3;
  leafQuat: THREE.Quaternion;
}

export interface FallenPetalsHandle {
  /** Posicion y orientacion EN MUNDO; el pool las convierte a su espacio. */
  spawn(world: { position: THREE.Vector3; quaternion: THREE.Quaternion }): void;
  /** Los petalos apoyados en esa hoja resbalan y reanudan la caida. */
  releaseFromLeaf(leafId: number): number;
  activeCount(): number;
}

interface FallenPetalsProps {
  reduced: boolean;
  throttled: boolean;
  leavesRef: React.RefObject<Map<number, LeafRig>>;
  onLeafLoad: (leafId: number, delta: number) => void;
}

/**
 * Pool fijo de 8. El noveno arranque recicla el mas antiguo con un
 * desvanecimiento rapido, sin parpadeo ni salto.
 */
export const FallenPetals = forwardRef<FallenPetalsHandle, FallenPetalsProps>(
  function FallenPetals({ reduced, throttled, leavesRef, onLeafLoad }, ref) {
    const groupRef = useRef<THREE.Group>(null);
    const skipped = useRef(0);
    const slots = useRef<Slot[]>([]);
    const cursor = useRef(0);
    const clock = useRef(0);

    const geometry = useMemo(() => createLiguleGeometry(), []);
    const veins = useMemo(() => liguleVeins(), []);

    /**
     * Una fabrica y no `material.clone()`: al clonar, `userData` se copia en
     * profundidad y los `Vector3`/`Color` de los uniforms se convierten en
     * objetos planos, asi que el termino de retroiluminacion revienta.
     */
    const makeMaterial = useMemo(
      () => () => {
        const m = makeBacklitMaterial(
          {
            vertexColors: true,
            map: veins.shade,
            roughnessMap: veins.rough,
            roughness: 0.6,
            metalness: 0,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
          },
          { backlight: '#E8C070', wrap: 0.3 },
        );
        // Fuera de la luz principal el petalo caido pierde el amarillo vivo.
        m.color.set(PALETTE.petalFallen);
        return m;
      },
      [veins],
    );

    useEffect(() => {
      const group = groupRef.current;
      if (!group) return;
      const made: Slot[] = [];
      for (let i = 0; i < FALL.poolSize; i++) {
        const mesh = new THREE.Mesh(geometry, makeMaterial());
        mesh.visible = false;
        mesh.frustumCulled = false;
        group.add(mesh);
        made.push({
          mesh,
          phase: 'idle',
          velocity: new THREE.Vector3(),
          spin: new THREE.Vector3(),
          phaseOffset: Math.random() * 6.28,
          since: 0,
          leafId: null,
          leafLocal: new THREE.Vector3(),
          leafQuat: new THREE.Quaternion(),
        });
      }
      slots.current = made;
      return () => {
        made.forEach((s) => {
          group.remove(s.mesh);
          (s.mesh.material as THREE.Material).dispose();
        });
        slots.current = [];
      };
    }, [geometry, makeMaterial]);

    const retire = (slot: Slot) => {
      if (slot.leafId !== null) {
        onLeafLoad(slot.leafId, -1);
        slot.leafId = null;
      }
      slot.phase = 'idle';
      slot.mesh.visible = false;
    };

    useImperativeHandle(ref, () => ({
      spawn({ position, quaternion }) {
        const pool = slots.current;
        const group = groupRef.current;
        if (pool.length === 0 || !group) return;
        const slot = pool[cursor.current];
        cursor.current = (cursor.current + 1) % pool.length;
        if (slot.phase !== 'idle') retire(slot);

        // Conserva la transformacion en mundo: el petalo no salta al soltarse.
        group.updateWorldMatrix(true, false);
        slot.mesh.position.copy(group.worldToLocal(position.clone()));
        const parentQuat = group.getWorldQuaternion(new THREE.Quaternion()).invert();
        slot.mesh.quaternion.copy(parentQuat.multiply(quaternion));
        slot.mesh.scale.setScalar(1);
        slot.mesh.visible = true;
        (slot.mesh.material as THREE.MeshPhysicalMaterial).opacity = 1;

        // velocidad = puntero suavizado + eje exterior + cono de 12 grados
        const outward = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
        const cone = new THREE.Vector3(
          (Math.random() - 0.5) * 2 * Math.sin(FALL.detachCone),
          (Math.random() - 0.5) * 2 * Math.sin(FALL.detachCone),
          (Math.random() - 0.5) * 2 * Math.sin(FALL.detachCone),
        );
        slot.velocity.copy(outward).multiplyScalar(FALL.detachOutward).add(cone);
        slot.spin.set(0.6 + Math.random() * 0.6, Math.random() * 0.4, Math.random() * 0.5);
        slot.phaseOffset = Math.random() * 6.28;
        slot.phase = 'falling';
        slot.since = clock.current;
        slot.leafId = null;
      },

      releaseFromLeaf(leafId) {
        let n = 0;
        for (const slot of slots.current) {
          if (slot.leafId === leafId) {
            onLeafLoad(leafId, -1);
            slot.leafId = null;
            slot.phase = 'falling';
            slot.since = clock.current;
            slot.velocity.set((Math.random() - 0.5) * 0.12, -0.05, (Math.random() - 0.5) * 0.1);
            n += 1;
          }
        }
        return n;
      },

      activeCount() {
        return slots.current.filter((s) => s.phase !== 'idle').length;
      },
    }));

    const tmpV = new THREE.Vector3();
    const tmpW = new THREE.Vector3();
    const flat = new THREE.Quaternion();

    useFrame((_, delta) => {
      if (throttled) {
        skipped.current += delta;
        if (skipped.current < 1 / 30) return;
        skipped.current = 0;
      }
      const group = groupRef.current;
      if (!group) return;

      const dt = Math.min(delta, 1 / 30);
      clock.current += dt * 1000;
      const now = clock.current;
      const leaves = leavesRef.current;

      for (const slot of slots.current) {
        if (slot.phase === 'idle') continue;
        const mesh = slot.mesh;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;

        if (slot.phase === 'falling') {
          if (reduced) {
            // Caida recta de 250 ms, sin revoloteo.
            const t = Math.min(1, (now - slot.since) / 250);
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, FALL.groundY, t);
            if (t >= 1) {
              slot.phase = 'resting';
              slot.since = now;
            }
          } else {
            slot.velocity.y -= FALL.gravity * dt;
            slot.velocity.multiplyScalar(Math.pow(FALL.drag, dt * 60));

            // El petalo hace de ala, no de piedra.
            const flutter = Math.sin((now / 1000) * 7.4 + slot.phaseOffset);
            slot.velocity.x += flutter * 0.9 * dt;
            slot.velocity.z += Math.cos((now / 1000) * 5.1 + slot.phaseOffset) * 0.5 * dt;

            mesh.position.addScaledVector(slot.velocity, dt);
            mesh.rotation.x += (0.6 + flutter * 0.8) * dt * slot.spin.x;
            mesh.rotation.z += flutter * 0.55 * dt * slot.spin.z;
          }

          // Antes del suelo se comprueban las hojas grandes.
          if (slot.phase === 'falling' && leaves && slot.velocity.y < 0) {
            for (const rig of leaves.values()) {
              if (rig.id > 1) continue;
              mesh.getWorldPosition(tmpW);
              rig.blade.worldToLocal(tmpV.copy(tmpW));
              const halfW = rig.spec.width / 2;
              const ex = tmpV.x / halfW;
              const ey = (tmpV.y - rig.spec.length / 2) / (rig.spec.length / 2);
              if (Math.abs(tmpV.z) < 0.07 && ex * ex + ey * ey <= 1) {
                slot.leafId = rig.id;
                slot.leafLocal.copy(tmpV).setZ(0.012);
                slot.phase = 'settling';
                slot.since = now;
                slot.velocity.set(0, 0, 0);
                onLeafLoad(rig.id, 1);
                break;
              }
            }
          }

          if (slot.phase === 'falling' && mesh.position.y <= FALL.groundY) {
            mesh.position.y = FALL.groundY;
            slot.velocity.set(0, 0, 0);
            slot.phase = 'settling';
            slot.since = now;
          }
        }

        if (slot.phase === 'settling') {
          const t = reduced ? 1 : Math.min(1, (now - slot.since) / FALL.settleMs);
          // La rotacion se asienta en plano.
          flat.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, mesh.rotation.z));
          mesh.quaternion.slerp(flat, easeOutCubic(t) * 0.35 + 0.05);
          if (t >= 1) {
            slot.phase = 'resting';
            slot.since = now;
          }
        }

        if (slot.leafId !== null && leaves) {
          // Apoyado en la hoja: sigue a la hoja mientras esta se inclina.
          const rig = leaves.get(slot.leafId);
          if (rig) {
            rig.blade.localToWorld(tmpW.copy(slot.leafLocal));
            group.worldToLocal(tmpW);
            mesh.position.copy(tmpW);
          }
        }

        if (slot.phase === 'resting' && now - slot.since > FALL.restMs) {
          slot.phase = 'fading';
          slot.since = now;
        }

        if (slot.phase === 'fading') {
          const t = Math.min(1, (now - slot.since) / FALL.fadeMs);
          mat.opacity = 1 - t;
          if (t >= 1) retire(slot);
        }
      }
    });

    return <group ref={groupRef} />;
  },
);
