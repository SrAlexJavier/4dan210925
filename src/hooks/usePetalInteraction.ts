import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { LIGULE, PULL, REBLOOM } from '../constants/flowerModel';
import { PALETTE } from '../constants/theme';
import {
  easeOutBack,
  springDecay,
  visualPull,
  type PetalRig,
  type PetalState,
} from '../components/3d/petalRig';
import type { FallenPetalsHandle } from '../components/3d/FallenPetals';
import type { PollenHandle } from '../components/3d/FloatingPollen';
import { isOverChrome } from './usePointerGuard';
import {
  petalArm,
  petalSnap,
  petalTension,
  rebloomChord,
  type TensionHandle,
} from '../components/audio/sceneAudio';

export type HoverKind = 'ligule' | 'leaf' | 'disc' | 'stem' | null;

interface Options {
  enabled: boolean;
  reduced: boolean;
  headSizeRef: React.RefObject<number>;
  fallenRef: React.RefObject<FallenPetalsHandle | null>;
  pollenRef: React.RefObject<PollenHandle | null>;
  onPluck: () => void;
  onMissing: (missing: number) => void;
  onPullingChange: (pulling: boolean) => void;
  onHover: (kind: HoverKind) => void;
  onInteract: () => void;
  /**
   * Instante del florecimiento de entrada en que arranca el anillo exterior,
   * con 16 ms de desfase por pieza. -1 lo desactiva (reduced-motion).
   */
  introAt: number;
}

interface DragSession {
  index: number;
  plane: THREE.Plane;
  tipRest: THREE.Vector3;
  outward: THREE.Vector3;
  tangent: THREE.Vector3;
  pointerId: number;
  element: Element | null;
  tension: TensionHandle;
  armed: boolean;
  rawPull: number;
  twist: number;
  pointerVelocity: THREE.Vector3;
  lastHit: THREE.Vector3;
}

const TIP_LOCAL = new THREE.Vector3(0, LIGULE.length, 0);
const BASE_LOCAL = new THREE.Vector3(0, 0, 0);

/**
 * El estado vive en refs, no en el estado de React: un `setState` por frame
 * durante un arrastre haria re-renderizar el arbol 60 veces por segundo. Lo
 * unico que sube a React es el contador de arrancados y cuantos faltan.
 */
export function usePetalInteraction(opts: Options) {
  const { camera, raycaster, gl } = useThree();

  const rigs = useRef<(PetalRig | null)[]>(Array(LIGULE.count).fill(null));
  const homes = useRef<THREE.Vector3[]>(
    Array.from({ length: LIGULE.count }, () => new THREE.Vector3()),
  );
  const states = useRef<PetalState[]>(
    Array.from({ length: LIGULE.count }, () => ({ k: 'attached' }) as PetalState),
  );
  const pluckOrder = useRef<number[]>([]);
  const drag = useRef<DragSession | null>(null);
  const clockMs = useRef(0);
  const dirty = useRef<Set<number>>(new Set());
  const lean = useRef({ x: 0, y: 0, amount: 0, recoilAt: -1, recoilAmount: 0 });
  const invitation = useRef<{ index: number; startedAt: number } | null>(null);
  /**
   * R3F puede emitir el `pointerout` de la ligula que se deja DESPUES del
   * `pointerover` de la que se entra. Sin llevar la cuenta, pasar el puntero
   * de un petalo al de al lado apaga el cursor y el hover.
   */
  const hoverIndex = useRef(-1);
  const tensionColor = useMemo(() => new THREE.Color(PALETTE.petalTension), []);
  const baseColors = useRef<THREE.Color[]>([]);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const reportMissing = useCallback(() => {
    const missing = states.current.filter(
      (s) => s.k === 'gone' || s.k === 'regrowing',
    ).length;
    optsRef.current.onMissing(missing);
  }, []);

  const register = useCallback((index: number, rig: PetalRig | null) => {
    rigs.current[index] = rig;
    if (rig) {
      homes.current[index].copy(rig.group.position);
      baseColors.current[index] = rig.material.color.clone();
      const introAt = optsRef.current.introAt;
      if (introAt >= 0 && clockMs.current < introAt + LIGULE.count * 16 + 400) {
        states.current[index] = { k: 'regrowing', startedAt: introAt + index * 16 };
        rig.mesh.scale.setScalar(0.001);
      }
      dirty.current.add(index);
    }
  }, []);

  /* ── Geometria del tiron ─────────────────────────────────────────── */

  const ndc = useMemo(() => new THREE.Vector2(), []);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const tmpHit = useMemo(() => new THREE.Vector3(), []);

  const castToPlane = (clientX: number, clientY: number, plane: THREE.Plane) => {
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, tmpHit);
  };

  const detach = useCallback(
    (index: number) => {
      const rig = rigs.current[index];
      if (!rig) return;

      rig.group.updateWorldMatrix(true, false);
      const position = rig.group.getWorldPosition(new THREE.Vector3());
      const quaternion = rig.group.getWorldQuaternion(new THREE.Quaternion());

      optsRef.current.fallenRef.current?.spawn({ position, quaternion });
      optsRef.current.pollenRef.current?.burst(
        rig.group.position.clone().multiplyScalar(1),
        4,
        0.5,
      );

      rig.group.visible = false;
      states.current[index] = { k: 'gone' };
      pluckOrder.current.push(index);
      petalSnap();
      optsRef.current.onPluck();
      reportMissing();
    },
    [reportMissing],
  );

  /** El boton del espejo a11y ejecuta exactamente esto. */
  const pluckNext = useCallback(() => {
    if (!optsRef.current.enabled) return;
    const index = states.current.findIndex((s) => s.k !== 'gone' && s.k !== 'regrowing');
    if (index < 0) return;
    optsRef.current.onInteract();
    detach(index);
  }, [detach]);

  const rebloom = useCallback(() => {
    const order = [...pluckOrder.current].reverse();
    if (order.length === 0) return;
    order.forEach((index, n) => {
      if (states.current[index].k !== 'gone') return;
      states.current[index] = {
        k: 'regrowing',
        startedAt: clockMs.current + n * REBLOOM.staggerMs,
      };
      const rig = rigs.current[index];
      if (rig) {
        rig.group.visible = true;
        rig.mesh.scale.setScalar(0.001);
      }
      dirty.current.add(index);
    });
    pluckOrder.current = [];
    rebloomChord();
    reportMissing();
  }, [reportMissing]);

  /* ── Gestos ──────────────────────────────────────────────────────── */

  const endDrag = useCallback(
    (commit: boolean) => {
      const session = drag.current;
      if (!session) return;
      drag.current = null;
      session.tension.stop();
      try {
        session.element?.releasePointerCapture?.(session.pointerId);
      } catch {
        /* el puntero ya se solto */
      }

      const { index } = session;
      if (commit && session.armed) {
        detach(index);
      } else {
        states.current[index] = {
          k: 'springing',
          startedAt: clockMs.current,
          from: session.rawPull,
        };
        // La cabeza retrocede en sentido contrario: eso es lo que le da masa.
        const rig = rigs.current[index];
        if (rig) {
          lean.current.recoilAt = clockMs.current;
          lean.current.recoilAmount =
            (visualPull(session.rawPull) / PULL.max) * PULL.share.head * PULL.headRecoil;
          lean.current.x = Math.cos(rig.theta);
          lean.current.y = Math.sin(rig.theta);
        }
        dirty.current.add(index);
        dirty.current.add((index + 1) % LIGULE.count);
        dirty.current.add((index + LIGULE.count - 1) % LIGULE.count);
      }
      optsRef.current.onPullingChange(false);
    },
    [detach],
  );

  const onOver = useCallback((index: number, e: ThreeEvent<PointerEvent>) => {
    if (!optsRef.current.enabled || isOverChrome(e)) return;
    if (drag.current) return;
    if (states.current[index].k === 'attached') {
      states.current[index] = { k: 'hovered' };
      dirty.current.add(index);
    }
    hoverIndex.current = index;
    optsRef.current.onHover('ligule');
  }, []);

  const onOut = useCallback((index: number, e: ThreeEvent<PointerEvent>) => {
    void e;
    if (drag.current?.index === index) return;
    if (states.current[index].k === 'hovered') {
      states.current[index] = { k: 'attached' };
      dirty.current.add(index);
    }
    if (hoverIndex.current === index) {
      hoverIndex.current = -1;
      optsRef.current.onHover(null);
    }
  }, []);

  const onDown = useCallback(
    (index: number, e: ThreeEvent<PointerEvent>) => {
      if (!optsRef.current.enabled || isOverChrome(e)) return;
      const rig = rigs.current[index];
      if (!rig) return;
      const st = states.current[index];
      if (st.k === 'gone' || st.k === 'regrowing') return;

      e.stopPropagation();
      optsRef.current.onInteract();

      const element = e.nativeEvent.target as Element | null;
      try {
        // Sin captura, sacar el dedo del petalo cancela el gesto a media
        // caricia. Con captura, el petalo sigue al dedo hasta que se levanta.
        element?.setPointerCapture?.(e.nativeEvent.pointerId);
      } catch {
        /* algunos navegadores lo rechazan en pointerdown sintetico */
      }

      rig.group.updateWorldMatrix(true, false);
      const tip = rig.group.localToWorld(tmpA.copy(TIP_LOCAL)).clone();
      const base = rig.group.localToWorld(tmpB.copy(BASE_LOCAL)).clone();
      const outward = tip.clone().sub(base).normalize();

      const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, tip);
      const tangent = outward.clone().cross(normal).normalize();

      drag.current = {
        index,
        plane,
        tipRest: tip,
        outward,
        tangent,
        pointerId: e.nativeEvent.pointerId,
        element,
        tension: petalTension(),
        armed: false,
        rawPull: 0,
        twist: 0,
        pointerVelocity: new THREE.Vector3(),
        lastHit: tip.clone(),
      };

      states.current[index] = { k: 'pulling', rawPull: 0, twist: 0, armed: false };
      optsRef.current.onPullingChange(true);
      dirty.current.add(index);
    },
    [camera, tmpA, tmpB],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = drag.current;
      if (!session || session.pointerId !== event.pointerId) return;

      const hit = castToPlane(event.clientX, event.clientY, session.plane);
      if (!hit) return;

      session.pointerVelocity.copy(hit).sub(session.lastHit);
      session.lastHit.copy(hit);

      const headSize = Math.max(optsRef.current.headSizeRef.current, 1e-4);
      const delta = hit.clone().sub(session.tipRest).divideScalar(headSize);
      session.rawPull = Math.max(0, delta.dot(session.outward));
      session.twist = delta.dot(session.tangent);

      const wasArmed = session.armed;
      session.armed = session.rawPull > PULL.armThreshold;
      if (session.armed && !wasArmed) petalArm();

      session.tension.set(session.rawPull / PULL.armThreshold);
      states.current[session.index] = {
        k: 'pulling',
        rawPull: session.rawPull,
        twist: session.twist,
        armed: session.armed,
      };
      dirty.current.add(session.index);
      dirty.current.add((session.index + 1) % LIGULE.count);
      dirty.current.add((session.index + LIGULE.count - 1) % LIGULE.count);
    };

    const onUp = (event: PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      endDrag(true);
    };

    const onCancel = () => endDrag(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDrag]);

  /**
   * Al suspenderse la interaccion (el album se abre), cualquier arrastre en
   * curso se resuelve como vuelta elastica. Nunca como arranque: no se
   * arranca nada por accidente al abrir el album.
   */
  useEffect(() => {
    if (!opts.enabled && drag.current) endDrag(false);
  }, [opts.enabled, endDrag]);

  /* ── Aplicacion por frame ────────────────────────────────────────── */

  const outwardLocal = useMemo(() => new THREE.Vector3(), []);

  const neighbourPull = (index: number) => {
    const session = drag.current;
    if (!session) return 0;
    const d = Math.abs(session.index - index);
    const wrapped = Math.min(d, LIGULE.count - d);
    if (wrapped !== 1) return 0;
    return (visualPull(session.rawPull) / PULL.max) * PULL.share.neighbour;
  };

  const apply = (index: number): boolean => {
    const rig = rigs.current[index];
    if (!rig) return false;
    const st = states.current[index];

    let pull = 0;
    let hover = 0;
    let armed = false;
    let scale = 1;
    let keep = false;

    // La invitacion: una sola ligula se levanta 4 grados y vuelve, una vez.
    const invite = invitation.current;
    let inviteLift = 0;
    if (invite && invite.index === index) {
      const elapsed = clockMs.current - invite.startedAt;
      const t = elapsed / 900;
      if (t >= 1) invitation.current = null;
      else {
        inviteLift = Math.sin(t * Math.PI) * 0.8;
        keep = true;
      }
    }

    switch (st.k) {
      case 'gone':
        rig.group.visible = false;
        return false;
      case 'hovered':
        hover = 1;
        keep = false;
        break;
      case 'pulling':
        pull = visualPull(st.rawPull) / PULL.max;
        armed = st.armed;
        keep = true;
        break;
      case 'springing': {
        const elapsed = clockMs.current - st.startedAt;
        pull = (visualPull(st.from) / PULL.max) * springDecay(elapsed, optsRef.current.reduced);
        keep = elapsed < 900;
        if (!keep) states.current[index] = { k: 'attached' };
        break;
      }
      case 'regrowing': {
        const elapsed = clockMs.current - st.startedAt;
        if (elapsed < 0) {
          scale = 0.001;
          keep = true;
          break;
        }
        const t = Math.min(1, elapsed / REBLOOM.perPetalMs);
        scale = Math.max(0.001, easeOutBack(t, REBLOOM.overshoot));
        keep = t < 1;
        if (!keep) states.current[index] = { k: 'attached' };
        break;
      }
      default:
        break;
    }

    pull += neighbourPull(index);
    if (pull > 0) keep = true;

    rig.group.visible = true;
    rig.group.rotation.x =
      LIGULE.tilt + (hover + inviteLift) * PULL.hoverLift - pull * PULL.petalRotMax;

    /**
     * El tiron se lee sobre todo como desplazamiento radial: la cabeza mira a
     * camara, asi que rotar el petalo sobre su base solo lo escorza. La
     * rotacion queda como respuesta secundaria y el recorrido util es este,
     * acotado por la curva asintotica a PULL.max.
     */
    outwardLocal.set(Math.cos(rig.theta), Math.sin(rig.theta), 0);
    rig.group.position
      .copy(homes.current[index])
      .addScaledVector(outwardLocal, pull * PULL.max + (armed ? PULL.gap : 0));

    rig.mesh.scale.set(scale, scale * (1 + pull * PULL.petalStretchMax), scale);
    rig.material.emissiveIntensity = hover * 0.16 + pull * 0.1;

    const base = baseColors.current[index];
    if (base) {
      // La base palidece hacia --petal-tension al armarse.
      rig.material.color.copy(base).lerp(tensionColor, armed ? 0.55 : 0);
    }

    rig.group.updateMatrix();
    return keep;
  };

  /** Lo llama el bucle de la planta. Devuelve la inclinacion de la cabeza. */
  const update = (deltaMs: number) => {
    clockMs.current += deltaMs;

    if (invitation.current) dirty.current.add(invitation.current.index);

    const pending = dirty.current;
    if (pending.size > 0) {
      const list = [...pending];
      pending.clear();
      for (const index of list) {
        if (apply(index)) pending.add(index);
      }
    }

    // Respuesta repartida por la planta.
    const session = drag.current;
    if (session) {
      const rig = rigs.current[session.index];
      const amount = (visualPull(session.rawPull) / PULL.max) * PULL.share.head;
      if (rig) {
        lean.current.x = Math.cos(rig.theta);
        lean.current.y = Math.sin(rig.theta);
      }
      lean.current.amount = amount;
      lean.current.recoilAt = -1;
    } else if (lean.current.recoilAt >= 0) {
      const elapsed = clockMs.current - lean.current.recoilAt;
      const t = Math.min(1, elapsed / PULL.headRecoilMs);
      // Contragolpe: sentido contrario, amplitud 0.35, se asienta en 900 ms.
      lean.current.amount = -lean.current.recoilAmount * (1 - t) * Math.cos(t * Math.PI * 1.4);
      if (t >= 1) {
        lean.current.recoilAt = -1;
        lean.current.amount = 0;
      }
    } else {
      lean.current.amount *= 0.9;
    }

    return lean.current;
  };

  /** Tercera y ultima animacion no provocada por el usuario. */
  const invite = useCallback((index: number) => {
    if (states.current[index].k === 'gone') return;
    invitation.current = { index, startedAt: clockMs.current };
    dirty.current.add(index);
  }, []);

  return useMemo(
    () => ({
      register,
      onOver,
      onOut,
      onDown,
      update,
      pluckNext,
      rebloom,
      invite,
    }),
    // El objeto es estable a proposito: los hijos no se re-renderizan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [register, onOver, onOut, onDown, pluckNext, rebloom, invite],
  );
}
