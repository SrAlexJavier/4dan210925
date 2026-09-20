import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { STEM_DRAG } from '../constants/flowerModel';
import { isOverChrome } from './usePointerGuard';
import { leafRustle } from '../components/audio/sceneAudio';
import type { HoverKind } from './usePetalInteraction';

interface Options {
  enabled: boolean;
  reduced: boolean;
  headSizeRef: React.RefObject<number>;
  onHover: (kind: HoverKind) => void;
  onInteract: () => void;
}

interface StemDrag {
  plane: THREE.Plane;
  origin: THREE.Vector3;
  right: THREE.Vector3;
  pointerId: number;
  element: Element | null;
}

/**
 * El tallo deja de ser solo el sitio donde se propagan las respuestas de los
 * petalos y pasa a ser un objetivo: se puede empujar de lado. Inclina la
 * planta entera y la hace girar un poco sobre su eje, asi que la cabeza se
 * ensena de perfil. Es el unico gesto que mueve el conjunto.
 */
export function useStemInteraction(opts: Options) {
  const { camera, raycaster, gl } = useThree();
  const drag = useRef<StemDrag | null>(null);
  const motion = useRef({ lean: 0, twist: 0, vLean: 0, vTwist: 0 });
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const castToPlane = (clientX: number, clientY: number, plane: THREE.Plane) => {
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, hitPoint);
  };

  const endDrag = useCallback(() => {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    try {
      session.element?.releasePointerCapture?.(session.pointerId);
    } catch {
      /* el puntero ya se solto */
    }
    leafRustle();
    optsRef.current.onHover(null);
  }, []);

  const onOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!optsRef.current.enabled || isOverChrome(e)) return;
    optsRef.current.onHover('stem');
  }, []);

  const onOut = useCallback(() => {
    if (drag.current) return;
    optsRef.current.onHover(null);
  }, []);

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!optsRef.current.enabled || isOverChrome(e)) return;
      e.stopPropagation();
      optsRef.current.onInteract();

      const element = e.nativeEvent.target as Element | null;
      try {
        element?.setPointerCapture?.(e.nativeEvent.pointerId);
      } catch {
        /* ignorado */
      }

      const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
      const origin = e.point.clone();
      drag.current = {
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin),
        origin,
        // Eje horizontal de la camara: el gesto util es el lateral.
        right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize(),
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
      const dx = hit.clone().sub(session.origin).dot(session.right) / headSize;
      const t = THREE.MathUtils.clamp(dx / STEM_DRAG.travel, -1, 1);

      const m = motion.current;
      // Empujar a la derecha inclina la planta a la derecha: rotation.z
      // positivo lleva el extremo hacia -x, de ahi el signo.
      m.lean = -t * STEM_DRAG.leanMax;
      m.twist = t * STEM_DRAG.twistMax;
      m.vLean = 0;
      m.vTwist = 0;
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

  /** El boton del espejo a11y ejecuta el mismo gesto. */
  const nudge = useCallback(() => {
    const m = motion.current;
    m.lean = -STEM_DRAG.leanMax * 0.8;
    m.twist = STEM_DRAG.twistMax * 0.8;
    m.vLean = 0;
    m.vTwist = 0;
    optsRef.current.onInteract();
    window.setTimeout(() => {
      m.lean = 0;
      m.twist = 0;
      leafRustle();
    }, 260);
  }, []);

  const update = (deltaMs: number) => {
    const m = motion.current;
    if (drag.current) return m;

    const dt = Math.min(deltaMs, 40) / 1000;
    const { stiffness, damping } = STEM_DRAG.spring;

    if (optsRef.current.reduced) {
      const k = Math.min(1, dt * 9);
      m.lean = THREE.MathUtils.lerp(m.lean, 0, k);
      m.twist = THREE.MathUtils.lerp(m.twist, 0, k);
      return m;
    }

    m.vLean += (-stiffness * m.lean - damping * m.vLean) * dt;
    m.vTwist += (-stiffness * m.twist - damping * m.vTwist) * dt;
    m.lean += m.vLean * dt;
    m.twist += m.vTwist * dt;
    if (Math.abs(m.lean) < 1e-4 && Math.abs(m.vLean) < 1e-3) m.lean = 0;
    if (Math.abs(m.twist) < 1e-4 && Math.abs(m.vTwist) < 1e-3) m.twist = 0;
    return m;
  };

  return useMemo(
    () => ({ onOver, onOut, onDown, nudge, update }),
     
    [onOver, onOut, onDown, nudge],
  );
}
