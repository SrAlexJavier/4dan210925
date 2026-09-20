import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BLOOM_IN,
  CROSSING_SCALE_MD,
  CROWN,
  DISC,
  IDLE,
  LEAVES,
  LEAVES_SM,
  LIGULE,
  MID_RING,
  PULL,
  STEM,
} from '../../constants/flowerModel';
import { BREAKPOINTS, LIGHTS } from '../../constants/theme';
import { useContent } from '../../context/ContentContext';
import { useStageFraming } from '../../hooks/useStageFraming';
import { usePetalInteraction, type HoverKind } from '../../hooks/usePetalInteraction';
import { useLeafInteraction } from '../../hooks/useLeafInteraction';
import { useStemInteraction } from '../../hooks/useStemInteraction';
import { isOverChrome } from '../../hooks/usePointerGuard';
import { discChime } from '../audio/sceneAudio';
import { Ligule } from './Ligule';
import { LiguleRingInstanced } from './LiguleRingInstanced';
import { SeedDisc } from './SeedDisc';
import { Stem } from './Stem';
import { Receptacle } from './Receptacle';
import { Leaf } from './Leaf';
import { FallenPetals, type FallenPetalsHandle } from './FallenPetals';
import { FloatingPollen, type PollenHandle } from './FloatingPollen';
import { contactShadowTexture } from './materials/veinTexture';
import { updateBacklight, type BacklitMaterial } from './materials/backlitPhysical';
import { PROXY_MATERIAL } from './petalRig';

interface SunflowerModelProps {
  reduced: boolean;
  onHover: (kind: HoverKind) => void;
}

const FRAME_30 = 1000 / 30;

export function SunflowerModel({ reduced, onHover }: SunflowerModelProps) {
  const {
    content,
    interactionEnabled,
    isAlbumOpen,
    reportPluck,
    setMissingPetals,
    setPulling,
    whisper,
    markInteraction,
    registerFlower,
    ceremony,
  } = useContent();

  const framing = useStageFraming();
  const { size, camera } = useThree();

  const plantRef = useRef<THREE.Group>(null);
  const stemGroupRef = useRef<THREE.Group>(null);
  const neckRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const discGroupRef = useRef<THREE.Group>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const keyTargetRef = useRef<THREE.Object3D>(null);
  const rimTargetRef = useRef<THREE.Object3D>(null);
  const fallenRef = useRef<FallenPetalsHandle | null>(null);
  const pollenRef = useRef<PollenHandle | null>(null);

  const introRef = useRef(0);
  const headSizeRef = useRef(framing.headSize);
  headSizeRef.current = framing.headSize;

  const helio = useRef({ yaw: 0, pitch: 0 });
  const discPulse = useRef(-1);
  const albumMix = useRef(0);
  const accumulator = useRef(0);
  const materials = useRef<Set<BacklitMaterial>>(new Set());
  const keyWorld = useMemo(() => new THREE.Vector3(), []);

  const isSmall = size.width < BREAKPOINTS.sm;
  const isMedium = size.width >= BREAKPOINTS.md && size.width < BREAKPOINTS.lg;
  const leafSpecs = isSmall ? LEAVES_SM : LEAVES;

  const petals = usePetalInteraction({
    enabled: interactionEnabled,
    reduced,
    headSizeRef,
    fallenRef,
    pollenRef,
    onPluck: reportPluck,
    onMissing: setMissingPetals,
    onPullingChange: setPulling,
    onHover,
    onInteract: markInteraction,
    introAt: reduced ? -1 : BLOOM_IN.rings.at + (CROWN.count + MID_RING.count) * BLOOM_IN.rings.stagger,
  });

  const leaves = useLeafInteraction({
    enabled: interactionEnabled,
    reduced,
    headSizeRef,
    fallenRef,
    pollenRef,
    onHover,
    onInteract: markInteraction,
  });

  const stem = useStemInteraction({
    enabled: interactionEnabled,
    reduced,
    headSizeRef,
    onHover,
    onInteract: markInteraction,
  });

  /** Tocar el centro de la flor: pulso, destello, polen y susurro. */
  const touchDisc = useCallback(() => {
    markInteraction();
    discPulse.current = 0;
    const list = content.flower.discWhispers;
    if (list.length > 0) whisper(list[Math.floor(Math.random() * list.length)]);
    pollenRef.current?.burst(new THREE.Vector3(0, 0, DISC.domeHeight), 40, 0.8);
    discChime();
  }, [content.flower.discWhispers, markInteraction, whisper]);

  // Los botones del espejo a11y ejecutan exactamente estas funciones.
  useEffect(() => {
    registerFlower({
      pluckNext: petals.pluckNext,
      brushLeaf: leaves.brushLeaf,
      touchDisc,
      nudgeStem: stem.nudge,
      rebloom: petals.rebloom,
    });
    return () => registerFlower(null);
  }, [registerFlower, petals.pluckNext, petals.rebloom, leaves.brushLeaf, stem.nudge, touchDisc]);

  // Ceremonia del petalo 21: estallido de polen y refloracion completa.
  useEffect(() => {
    if (!ceremony) return;
    pollenRef.current?.burst(new THREE.Vector3(0, 0, DISC.domeHeight), 90, 1.4);
    discPulse.current = 0;
    const timer = window.setTimeout(() => petals.rebloom(), 700);
    return () => window.clearTimeout(timer);
  }, [ceremony, petals]);

  /**
   * `DirectionalLight.target` apunta por defecto al origen DEL MUNDO, no al
   * del grupo. Sin reasignarlo, mover la planta dejaria las dos luces
   * apuntando a otro sitio.
   */
  useEffect(() => {
    if (keyRef.current && keyTargetRef.current) keyRef.current.target = keyTargetRef.current;
    if (rimRef.current && rimTargetRef.current) rimRef.current.target = rimTargetRef.current;
  }, []);

  // La invitacion, una sola vez, al terminar el florecimiento de entrada.
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => petals.invite(0), BLOOM_IN.invitation.at);
    return () => window.clearTimeout(timer);
  }, [reduced, petals]);

  useFrame((state, delta) => {
    const dtMs = Math.min(delta, 1 / 20) * 1000;
    introRef.current = Math.min(introRef.current + dtMs, 600_000);

    // Con el album abierto el bucle de la flor baja a 30 fps: ya no es el foco
    // y libera CPU para el flip de paginas, que si se mira de cerca.
    if (isAlbumOpen) {
      accumulator.current += dtMs;
      if (accumulator.current < FRAME_30) return;
    }
    const step = isAlbumOpen ? accumulator.current : dtMs;
    accumulator.current = 0;

    const lean = petals.update(step);
    const mixTarget = isAlbumOpen ? 1 : 0;
    albumMix.current += (mixTarget - albumMix.current) * Math.min(1, step / 620);
    const mix = albumMix.current;

    const t = state.clock.elapsedTime;
    leaves.update(step, mix * IDLE.albumLeafTilt, reduced ? 0 : t);
    const push = stem.update(step);
    const windAmp = reduced ? 0 : IDLE.windAmplitude * (1 - mix * (1 - IDLE.windAlbumFactor));
    const wind = (phase: number) =>
      (Math.sin((t * 2 * Math.PI) / IDLE.windCycle + phase) * 0.6 +
        Math.sin((t * 2 * Math.PI) / (IDLE.windCycle * 0.37) + phase * 1.7) * 0.4) *
      windAmp;

    // Heliotropismo. Mientras el album esta abierto, la flor mira al album,
    // no al cursor: la atencion la dirige el sujeto, no un filtro.
    const damping = reduced ? 0.08 : IDLE.helioDamping;
    const targetYaw = isAlbumOpen
      ? IDLE.albumYaw
      : reduced
        ? 0
        : state.pointer.x * IDLE.helioYaw;
    // `pointer.y` es +1 arriba. Mirar hacia abajo (rotation.x positivo) es lo
    // que mete los petalos de abajo detras del tallo, asi que tiene tope.
    const targetPitch = isAlbumOpen
      ? IDLE.albumPitch
      : reduced
        ? 0
        : -state.pointer.y *
          (state.pointer.y >= 0 ? IDLE.helioPitchUp : IDLE.helioPitchDown);
    helio.current.yaw += (targetYaw - helio.current.yaw) * damping;
    helio.current.pitch += (targetPitch - helio.current.pitch) * damping;

    // Tirar de un petalo no mueve un petalo: mueve la cabeza, el cuello y el
    // tallo en proporciones decrecientes.
    const leanX = lean.x * lean.amount;
    const leanY = lean.y * lean.amount;
    const neckK = PULL.share.neck / PULL.share.head;
    const stemK = PULL.share.stem / PULL.share.head;

    const head = headRef.current;
    if (head) {
      head.rotation.set(
        helio.current.pitch + wind(0) * 0.45 - leanY,
        helio.current.yaw + wind(1.1) * 0.55 + leanX,
        wind(2.3) * 0.3,
      );
    }

    /**
     * El cuello y el tallo siguen a la cabeza con una fraccion del angulo.
     * Girar solo la cabeza deja el tallo como un palo clavado; girarlo entero
     * con el mismo angulo lo convierte en una pajita. La proporcion 1 / 0.32 /
     * 0.12 es lo que se lee como un ser vivo que se vuelve hacia algo.
     */
    const neck = neckRef.current;
    if (neck) {
      neck.rotation.set(
        helio.current.pitch * IDLE.helioNeckShare + wind(0.6) * 0.7 - leanY * neckK,
        helio.current.yaw * IDLE.helioNeckShare + wind(1.7) * 0.5 + leanX * neckK,
        0,
      );
    }

    const stemGroup = stemGroupRef.current;
    if (stemGroup) {
      // El giro es sobre la base del tallo, que queda fuera de cuadro: lo que
      // se ve es la planta entera inclinandose, no un pivote.
      stemGroup.rotation.set(
        helio.current.pitch * IDLE.helioStemShare + wind(1.3) * 0.5 - leanY * stemK,
        helio.current.yaw * IDLE.helioStemShare + wind(0.2) * 0.3 + leanX * stemK + push.twist,
        -mix * IDLE.albumStemGive + push.lean,
      );
    }

    // Paralaje del campo de semillas y pulso al tocar el centro.
    const disc = discGroupRef.current;
    if (disc) {
      const parallax = (2 * Math.PI) / 180;
      disc.rotation.x = -state.pointer.y * parallax;
      disc.rotation.y = state.pointer.x * parallax;
      if (discPulse.current >= 0) {
        discPulse.current += step;
        const p = discPulse.current / 620;
        if (p >= 1) {
          discPulse.current = -1;
          disc.scale.setScalar(1);
        } else {
          disc.scale.setScalar(1 + 0.07 * Math.sin(p * Math.PI) * (1 - p * 0.35));
        }
      }
    }

    // Posicion de la planta. Nada de filter, nada de scale, nada de blur:
    // la flor sigue en primer plano y nitida.
    const plant = plantRef.current;
    if (plant) {
      plant.position.set(
        framing.x + mix * IDLE.albumShiftX,
        framing.y - STEM.length * framing.headSize,
        0,
      );
      plant.scale.setScalar(framing.headSize);
    }

    // Luz: brillo x0.88 con el album abierto, y el rim sigue al puntero.
    const brightness = THREE.MathUtils.lerp(1, IDLE.albumBrightness, mix);
    const key = keyRef.current;
    const rim = rimRef.current;
    if (key) key.intensity = LIGHTS.key.intensity * brightness;
    if (rim) {
      const pulling = lean.amount > 0.01 ? 1 : 0;
      const target = THREE.MathUtils.lerp(LIGHTS.rim.intensity, LIGHTS.rimPulling, pulling);
      rim.intensity += (target * brightness - rim.intensity) * 0.12;
      rim.position.x +=
        (LIGHTS.rim.position[0] + state.pointer.x * 2.4 - rim.position.x) * LIGHTS.rimDamping;
      rim.position.y +=
        (LIGHTS.rim.position[1] + state.pointer.y * 1.6 - rim.position.y) * LIGHTS.rimDamping;
    }

    // Direccion de luz en espacio de vista para el termino de retroiluminacion.
    if (key && plant) {
      key.getWorldPosition(keyWorld);
      materials.current.clear();
      plant.traverse((obj) => {
        const mat = (obj as THREE.Mesh).material as BacklitMaterial | undefined;
        if (mat?.userData?.backlit) materials.current.add(mat);
      });
      for (const mat of materials.current) updateBacklight(mat, keyWorld, camera);
    }
  });

  const shadowTexture = useMemo(() => contactShadowTexture(), []);
  const discProxy = useMemo(() => new THREE.CircleGeometry(DISC.radius * 0.94, 20), []);
  // En 900–1099 px la hoja frontal acorta su alcance.
  const specs = useMemo(
    () =>
      leafSpecs.map((spec) =>
        spec.crosses && isMedium
          ? {
              ...spec,
              length: spec.length * CROSSING_SCALE_MD,
              width: spec.width * CROSSING_SCALE_MD,
            }
          : spec,
      ),
    [leafSpecs, isMedium],
  );

  useEffect(() => () => discProxy.dispose(), [discProxy]);

  return (
    <group ref={plantRef}>
      {/* Key y Rim son hijos de la planta: si no, al moverla al 25 % del
          ancho, la luz principal le llegaria de canto. */}
      <directionalLight
        ref={keyRef}
        color={LIGHTS.key.color}
        intensity={LIGHTS.key.intensity}
        position={[...LIGHTS.key.position]}
      />
      <object3D ref={keyTargetRef} position={[0, STEM.length, 0]} />
      <directionalLight
        ref={rimRef}
        color={LIGHTS.rim.color}
        intensity={LIGHTS.rim.intensity}
        position={[...LIGHTS.rim.position]}
      />
      <object3D ref={rimTargetRef} position={[0, STEM.length, 0]} />
      <hemisphereLight
        args={[LIGHTS.hemi.sky, LIGHTS.hemi.ground, LIGHTS.hemi.intensity]}
      />

      {/* Sombra de contacto: un sprite, una draw call, cero pases. */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      <group ref={stemGroupRef}>
        <Stem
          introRef={introRef}
          reduced={reduced}
          onOver={stem.onOver}
          onOut={stem.onOut}
          onDown={stem.onDown}
        />

        {specs.map((spec, order) => (
          <Leaf
            key={spec.id}
            spec={spec}
            order={order}
            petioleLength={spec.petiole}
            introRef={introRef}
            reduced={reduced}
            register={leaves.register}
            onOver={leaves.onOver}
            onOut={leaves.onOut}
            onDown={leaves.onDown}
          />
        ))}

        <FallenPetals
          ref={fallenRef}
          reduced={reduced}
          throttled={isAlbumOpen}
          leavesRef={leaves.leaves}
          onLeafLoad={leaves.addLoad}
        />

        <group ref={neckRef} position={[0, STEM.length, 0]}>
          <group ref={headRef} position={[0, 0, IDLE.headForward]}>
            <Receptacle />
            <group ref={discGroupRef}>
              <SeedDisc introRef={introRef} reduced={reduced} throttled={isAlbumOpen} />
              <mesh
                geometry={discProxy}
                material={PROXY_MATERIAL}
                position={[0, 0, DISC.domeHeight + 0.01]}
                onPointerOver={(e) => {
                  if (!interactionEnabled || isOverChrome(e)) return;
                  onHover('disc');
                }}
                onPointerOut={() => onHover(null)}
                onPointerDown={(e) => {
                  if (!interactionEnabled || isOverChrome(e)) return;
                  e.stopPropagation();
                  touchDisc();
                }}
              />
            </group>

            <LiguleRingInstanced
              count={MID_RING.count}
              scale={MID_RING.scale}
              tilt={MID_RING.tilt}
              birthRadius={MID_RING.birthRadius}
              phase={MID_RING.phase}
              introRef={introRef}
              startAt={BLOOM_IN.rings.at + 21 * BLOOM_IN.rings.stagger}
              stagger={BLOOM_IN.rings.stagger}
              reduced={reduced}
            />

            <LiguleRingInstanced
              count={CROWN.count}
              scale={CROWN.scale}
              tilt={CROWN.tilt}
              birthRadius={CROWN.birthRadius}
              introRef={introRef}
              startAt={BLOOM_IN.rings.at}
              stagger={BLOOM_IN.rings.stagger}
              reduced={reduced}
            />

            {Array.from({ length: LIGULE.count }, (_, i) => (
              <Ligule
                key={i}
                index={i}
                register={petals.register}
                onOver={petals.onOver}
                onOut={petals.onOut}
                onDown={petals.onDown}
              />
            ))}

            <FloatingPollen
              ref={pollenRef}
              introRef={introRef}
              reduced={reduced}
              throttled={isAlbumOpen}
            />
          </group>
        </group>
      </group>
    </group>
  );
}
