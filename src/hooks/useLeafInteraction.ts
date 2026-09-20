import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { LEAF } from '../constants/flowerModel';
import type { LeafRig } from '../components/3d/Leaf';
import type { FallenPetalsHandle } from '../components/3d/FallenPetals';
import type { PollenHandle } from '../components/3d/FloatingPollen';
import { isOverChrome } from './usePointerGuard';
import { leafRustle } from '../components/audio/sceneAudio';
import type { HoverKind } from './usePetalInteraction';

interface Options {
  enabled: boolean;
  reduced: boolean;
  headSizeRef: React.RefObject<number>;
  fallenRef: React.RefObject<FallenPetalsHandle | null>;
  pollenRef: React.RefObject<PollenHandle | null>;
  onHover: (kind: HoverKind) => void;
  onInteract: () => void;
}

interface LeafDrag {
  id: number;
  plane: THREE.Plane;
  origin: THREE.Vector3;
  bendAxis: THREE.Vector3;
  pointerId: number;
  element: Element | null;
}

interface LeafMotion {
  bend: number;
  caress: number;
  velocityBend: number;
  velocityCaress: number;
  sweepAt: number;
  restingPetals: number;
}

const SPRING = { stiffness: 120, damping: 11 };

/**
 * Rotar el peciolo mueve la hoja pero la deja rigida; una hoja de girasol se
 * comba. Aqui van los dos niveles: rotacion del peciolo y curvatura por
 * vertice del limbo.
 */
export function useLeafInteraction(opts: Options) {
  const { camera, raycaster, gl } = useThree();
  const leaves = useRef<Map<number, LeafRig>>(new Map());
  const motion = useRef<Map<number, LeafMotion>>(new Map());
  const drag = useRef<LeafDrag | null>(null);
  const hoverId = useRef(-1);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const motionOf = (id: number): LeafMotion => {
    let m = motion.current.get(id);
    if (!m) {
      m = {
        bend: 0,
        caress: 0,
        velocityBend: 0,
        velocityCaress: 0,
        sweepAt: 2,
        restingPetals: 0,
      };
      motion.current.set(id, m);
    }
    return m;
  };

  const register = useCallback((id: number, rig: LeafRig | null) => {
    if (rig) leaves.current.set(id, rig);
    else leaves.current.delete(id);
  }, []);

  /** Un petalo se apoya (o se va) de una hoja. Maximo tres. */
  const addLoad = useCallback((id: number, delta: number) => {
    const m = motionOf(id);
    m.restingPetals = THREE.MathUtils.clamp(m.restingPetals + delta, 0, LEAF.maxRestingPetals);
  }, []);

  const castToPlane = (clientX: number, clientY: number, plane: THREE.Plane) => {
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, hitPoint);
  };

  const release = useCallback((id: number) => {
    const m = motionOf(id);
    // Los petalos que hubiera encima resbalan y reanudan la caida.
    const freed = optsRef.current.fallenRef.current?.releaseFromLeaf(id) ?? 0;
    if (freed > 0) m.restingPetals = 0;

    leafRustle();
    const rig = leaves.current.get(id);
    if (rig) {
      const origin = new THREE.Vector3(0, rig.spec.length * 0.6, 0);
      rig.blade.localToWorld(origin);
      optsRef.current.pollenRef.current?.burst(origin, 3 + Math.floor(Math.random() * 4), 0.4);
    }
    m.sweepAt = 2;
  }, []);

  const endDrag = useCallback(() => {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    try {
      session.element?.releasePointerCapture?.(session.pointerId);
    } catch {
      /* el puntero ya se solto */
    }
    release(session.id);
    optsRef.current.onHover(null);
  }, [release]);

  const onOver = useCallback((id: number, e: ThreeEvent<PointerEvent>) => {
    if (!optsRef.current.enabled || isOverChrome(e)) return;
    motionOf(id).sweepAt = -0.2;
    hoverId.current = id;
    optsRef.current.onHover('leaf');
  }, []);

  const onOut = useCallback((id: number) => {
    if (drag.current?.id === id) return;
    motionOf(id).sweepAt = 2;
    if (hoverId.current === id) {
      hoverId.current = -1;
      optsRef.current.onHover(null);
    }
  }, []);

  const onDown = useCallback(
    (id: number, e: ThreeEvent<PointerEvent>) => {
      if (!optsRef.current.enabled || isOverChrome(e)) return;
      const rig = leaves.current.get(id);
      if (!rig) return;

      e.stopPropagation();
      optsRef.current.onInteract();

      const element = e.nativeEvent.target as Element | null;
      try {
        element?.setPointerCapture?.(e.nativeEvent.pointerId);
      } catch {
        /* ignorado */
      }

      rig.blade.updateWorldMatrix(true, false);
      const origin = rig.blade.localToWorld(new THREE.Vector3(0, rig.spec.length * 0.6, 0));
      // El limbo se dobla en su +Z local: ese es el eje util del gesto.
      const bendAxis = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(rig.blade.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
      const normal = camera.getWorldDirection(new THREE.Vector3()).negate();

      drag.current = {
        id,
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin),
        origin,
        bendAxis,
        pointerId: e.nativeEvent.pointerId,
        element,
      };
    },
    [camera],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = drag.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const hit = castToPlane(event.clientX, event.clientY, session.plane);
      if (!hit) return;

      const headSize = Math.max(optsRef.current.headSizeRef.current, 1e-4);
      const raw = hit.clone().sub(session.origin).dot(session.bendAxis) / headSize;

      const m = motionOf(session.id);
      m.bend = THREE.MathUtils.clamp(raw * 2.2, -1, 1) * LEAF.bendMax;
      m.caress = THREE.MathUtils.clamp(raw * 1.1, -1, 1) * LEAF.petioleMax;
      m.velocityBend = 0;
      m.velocityCaress = 0;
    };

    const onUp = (event: PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      endDrag();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDrag]);

  useEffect(() => {
    if (!opts.enabled && drag.current) endDrag();
  }, [opts.enabled, endDrag]);

  /** El boton del espejo a11y ejecuta exactamente el mismo gesto. */
  const brushLeaf = useCallback(
    (id: number) => {
      const m = motionOf(id);
      m.bend = 0.75;
      m.caress = LEAF.petioleMax * 0.8;
      m.velocityBend = 0;
      m.velocityCaress = 0;
      m.sweepAt = -0.2;
      optsRef.current.onInteract();
      window.setTimeout(() => {
        m.bend = 0;
        m.caress = 0;
        release(id);
      }, 260);
    },
    [release],
  );

  const update = (deltaMs: number, albumTilt: number) => {
    const dt = Math.min(deltaMs, 40) / 1000;
    const dragging = drag.current?.id ?? -1;
    const reduced = optsRef.current.reduced;

    for (const [id, rig] of leaves.current) {
      const m = motionOf(id);

      if (id !== dragging) {
        // Muelle de vuelta: dos rebotes visibles, o ninguno si reduced.
        const springStep = (value: number, velocity: number): [number, number] => {
          if (reduced) {
            const next = THREE.MathUtils.lerp(value, 0, Math.min(1, dt * 9));
            return [Math.abs(next) < 1e-4 ? 0 : next, 0];
          }
          const accel = -SPRING.stiffness * value - SPRING.damping * velocity;
          const v = velocity + accel * dt;
          const next = value + v * dt;
          return [Math.abs(next) < 1e-4 && Math.abs(v) < 1e-3 ? 0 : next, v];
        };

        [m.bend, m.velocityBend] = springStep(m.bend, m.velocityBend);
        [m.caress, m.velocityCaress] = springStep(m.caress, m.velocityCaress);
      }

      if (m.sweepAt < 1.2) m.sweepAt += deltaMs / 260;
      rig.bend.uSweep.value = m.sweepAt;

      rig.drive.bend = m.bend;
      rig.drive.caress = m.caress;
      rig.drive.restingWeight = m.restingPetals * LEAF.restingWeightPerPetal;
      rig.drive.albumTilt = albumTilt;
      rig.material.emissiveIntensity = id === dragging ? 0.05 : 0;
    }
  };

  return useMemo(
    () => ({ register, onOver, onOut, onDown, brushLeaf, addLoad, update, leaves }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [register, onOver, onOut, onDown, brushLeaf, addLoad],
  );
}
