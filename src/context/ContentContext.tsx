import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import raw from '../data/content.json';
import type { LandingContent, PhotoItem } from '../types/landing';
import { REBLOOM } from '../constants/flowerModel';
import { useIdleTimer } from '../hooks/useIdleTimer';
import {
  ensureAudio,
  setEffectsEnabled,
  startAmbient,
  stopAmbient,
  audioSupported,
} from '../components/audio/sceneAudio';

const content = raw as LandingContent;

/** Lo que la capa 3D publica para que el espejo a11y llame a lo mismo. */
export interface FlowerApi {
  pluckNext: () => void;
  brushLeaf: (index: number) => void;
  touchDisc: () => void;
  rebloom: () => void;
}

export interface Whisper {
  text: string;
  id: number;
}

export interface ContentValue {
  content: LandingContent;
  photoById: Map<string, PhotoItem>;

  isAlbumOpen: boolean;
  openAlbum: () => void;
  closeAlbum: () => void;
  spreadIndex: number;
  spreadCount: number;
  isBackCover: boolean;
  goNext: () => void;
  goPrev: () => void;
  flipDirection: 1 | -1;
  isFlipping: boolean;
  setFlipping: (v: boolean) => void;

  /** !isAlbumOpen && !isFlipping */
  interactionEnabled: boolean;
  pluckedCount: number;
  missingPetals: number;
  setMissingPetals: (n: number) => void;
  /** La capa 3D avisa de un arranque; aqui vive el oraculo. */
  reportPluck: () => void;
  isPulling: boolean;
  setPulling: (v: boolean) => void;
  ceremony: boolean;

  lastWhisper: Whisper | null;
  whisper: (text: string) => void;
  announcement: string;
  announce: (text: string) => void;

  rebloom: () => void;
  registerFlower: (api: FlowerApi | null) => void;
  flowerRef: React.RefObject<FlowerApi | null>;

  hasInteracted: boolean;
  markInteraction: () => void;

  effectsOn: boolean;
  setEffectsOn: (v: boolean) => void;
  musicOn: boolean;
  setMusicOn: (v: boolean) => void;
  audioAvailable: boolean;
}

const Ctx = createContext<ContentValue | null>(null);

export function useContent(): ContentValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useContent fuera de <ContentProvider>');
  return value;
}

/**
 * `<Canvas>` monta su propio reconciliador: el contexto de React no cruza esa
 * frontera por si solo. Este puente vuelve a proveer el MISMO valor dentro de
 * la escena, asi que no hay dos fuentes de verdad.
 */
export function ContentBridge({
  value,
  children,
}: {
  value: ContentValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [isAlbumOpen, setAlbumOpen] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [flipDirection, setFlipDirection] = useState<1 | -1>(1);
  const [isFlipping, setFlipping] = useState(false);

  const [pluckedCount, setPluckedCount] = useState(0);
  const [missingPetals, setMissingPetals] = useState(0);
  const [isPulling, setPulling] = useState(false);
  const [ceremony, setCeremony] = useState(false);

  const [lastWhisper, setLastWhisper] = useState<Whisper | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);

  const [effectsOn, setEffectsOnState] = useState(true);
  const [musicOn, setMusicOnState] = useState(false);

  const flowerRef = useRef<FlowerApi | null>(null);
  const whisperId = useRef(0);
  const audioAvailable = useMemo(() => audioSupported(), []);

  const spreadCount = content.album.spreads.length;
  const isBackCover = spreadIndex >= spreadCount;
  const interactionEnabled = !isAlbumOpen && !isFlipping;

  const photoById = useMemo(
    () => new Map(content.album.photos.map((p) => [p.id, p])),
    [],
  );

  const whisper = useCallback((text: string) => {
    whisperId.current += 1;
    setLastWhisper({ text, id: whisperId.current });
  }, []);

  const announce = useCallback((text: string) => setAnnouncement(text), []);

  const markInteraction = useCallback(() => {
    setHasInteracted(true);
    ensureAudio();
  }, []);

  /**
   * El oraculo. `pluckedCount` es monotono y no se reinicia al reflorecer:
   * el anillo exterior tiene 21 ligulas, numero impar, asi que alternando
   * desde la primera frase el arranque 21 vuelve a caer en «me quiere».
   * No hay logica especial en el ultimo petalo: es aritmetica.
   */
  const reportPluck = useCallback(() => {
    setPluckedCount((prev) => {
      const n = prev + 1;
      const { petalMode, oracle, petalMemories } = content.flower;
      const isFinal = n % 21 === 0;

      let text = '';
      if (petalMode === 'memory' && petalMemories.length > 0) {
        text = petalMemories[(n - 1) % petalMemories.length];
      } else if (petalMode === 'oracle' && oracle.enabled) {
        text = isFinal ? oracle.final : oracle.phrases[(n - 1) % 2];
      }

      if (text) {
        whisperId.current += 1;
        setLastWhisper({ text, id: whisperId.current });
      }
      setAnnouncement(
        text
          ? `Has arrancado un petalo. ${text}. Quedan ${Math.max(0, 21 - (n % 21 === 0 ? 21 : n % 21))}.`
          : 'Has arrancado un petalo.',
      );

      if (isFinal) {
        setCeremony(true);
        window.setTimeout(() => setCeremony(false), REBLOOM.ceremonyMs);
      }
      return n;
    });
  }, []);

  const rebloom = useCallback(() => {
    flowerRef.current?.rebloom();
    setAnnouncement('La flor ha vuelto a florecer.');
  }, []);

  const registerFlower = useCallback((api: FlowerApi | null) => {
    flowerRef.current = api;
  }, []);

  /* Refloracion silenciosa tras 22 s sin interaccion, solo si faltan petalos. */
  const { poke } = useIdleTimer(
    content.flower.rebloomIdleMs,
    () => {
      if (missingPetals > 0) flowerRef.current?.rebloom();
    },
    missingPetals > 0,
  );

  useEffect(() => {
    poke();
  }, [pluckedCount, missingPetals, isAlbumOpen, poke]);

  const openAlbum = useCallback(() => {
    markInteraction();
    setAlbumOpen(true);
    setSpreadIndex(0);
    setFlipDirection(1);
  }, [markInteraction]);

  const closeAlbum = useCallback(() => {
    setAlbumOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setSpreadIndex((i) => {
      if (i >= spreadCount) return i;
      setFlipDirection(1);
      return i + 1;
    });
  }, [spreadCount]);

  const goPrev = useCallback(() => {
    setSpreadIndex((i) => {
      if (i <= 0) return i;
      setFlipDirection(-1);
      return i - 1;
    });
  }, []);

  const setEffectsOn = useCallback((v: boolean) => {
    setEffectsOnState(v);
    setEffectsEnabled(v);
    if (v) ensureAudio();
  }, []);

  const setMusicOn = useCallback((v: boolean) => {
    setMusicOnState(v);
    if (v) startAmbient();
    else stopAmbient();
  }, []);

  useEffect(() => () => stopAmbient(), []);

  const value = useMemo<ContentValue>(
    () => ({
      content,
      photoById,
      isAlbumOpen,
      openAlbum,
      closeAlbum,
      spreadIndex,
      spreadCount,
      isBackCover,
      goNext,
      goPrev,
      flipDirection,
      isFlipping,
      setFlipping,
      interactionEnabled,
      pluckedCount,
      missingPetals,
      setMissingPetals,
      reportPluck,
      isPulling,
      setPulling,
      ceremony,
      lastWhisper,
      whisper,
      announcement,
      announce,
      rebloom,
      registerFlower,
      flowerRef,
      hasInteracted,
      markInteraction,
      effectsOn,
      setEffectsOn,
      musicOn,
      setMusicOn,
      audioAvailable,
    }),
    [
      photoById,
      isAlbumOpen,
      openAlbum,
      closeAlbum,
      spreadIndex,
      spreadCount,
      isBackCover,
      goNext,
      goPrev,
      flipDirection,
      isFlipping,
      interactionEnabled,
      pluckedCount,
      missingPetals,
      reportPluck,
      isPulling,
      ceremony,
      lastWhisper,
      whisper,
      announcement,
      announce,
      rebloom,
      registerFlower,
      hasInteracted,
      markInteraction,
      effectsOn,
      setEffectsOn,
      musicOn,
      setMusicOn,
      audioAvailable,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
