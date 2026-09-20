import { useRef, useState } from 'react';
import { StageBackground } from './StageBackground';
import { HeaderOverlay } from '../ui/HeaderOverlay';
import { AudioToggles } from '../ui/AudioToggles';
import { FlowerWhisper } from '../ui/FlowerWhisper';
import { A11yMirror } from '../ui/A11yMirror';
import { AlbumPanel } from '../album/AlbumPanel';
import { FlowerCanvas } from '../3d/FlowerCanvas';
import { StaticPoster } from '../fallback/StaticPoster';
import { CanvasBoundary } from '../fallback/CanvasBoundary';
import { useContent } from '../../context/ContentContext';
import { useWebGLSupport } from '../../hooks/useWebGLSupport';
import type { HoverKind } from '../../hooks/usePetalInteraction';

/**
 * Pila de capas:
 *
 *   60  AudioToggle, espejo a11y     auto
 *   50  FlowerCanvas (full-bleed)    none   <- por encima del album
 *   40  Susurro de la flor           none
 *   30  AlbumPanel (derecha)         auto
 *   20  HeaderOverlay                none
 *   10  Capas de fondo (3)           none
 *
 * El canvas esta arriba y NO recibe eventos: los clics lo atraviesan y llegan
 * al album. La flor se toca porque R3F lee los eventos de `.stage`
 * (`eventSource`) y calcula el raycast contra el rect del canvas. El canvas
 * se pinta encima pero escucha desde debajo.
 */
export function Stage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverKind>(null);
  const { isPulling, isAlbumOpen } = useContent();
  const webgl = useWebGLSupport();

  const onHover = (kind: HoverKind) => setHover(kind);

  return (
    <div
      className="stage"
      ref={stageRef}
      data-hover={hover ?? undefined}
      data-pulling={isPulling ? 'true' : undefined}
    >
      <StageBackground />
      <HeaderOverlay />
      <AlbumPanel />
      <div className="album-scrim" data-on={isAlbumOpen ? 'true' : 'false'} aria-hidden="true" />
      {webgl === 'yes' && (
        <CanvasBoundary fallback={<StaticPoster />}>
          <FlowerCanvas stageRef={stageRef} onHover={onHover} />
        </CanvasBoundary>
      )}
      {webgl === 'no' && <StaticPoster />}
      <FlowerWhisper />
      <A11yMirror />
      <AudioToggles />
    </div>
  );
}
