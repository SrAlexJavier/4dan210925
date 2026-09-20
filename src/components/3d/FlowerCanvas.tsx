import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { CAMERA, BREAKPOINTS } from '../../constants/theme';
import { ContentBridge, useContent } from '../../context/ContentContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { HoverKind } from '../../hooks/usePetalInteraction';
import { SunflowerModel } from './SunflowerModel';

interface FlowerCanvasProps {
  stageRef: React.RefObject<HTMLDivElement | null>;
  onHover: (kind: HoverKind) => void;
}

export function FlowerCanvas({ stageRef, onHover }: FlowerCanvasProps) {
  const value = useContent();
  const reduced = useReducedMotion();
  const isSmall = useMediaQuery(`(max-width: ${BREAKPOINTS.sm - 1}px)`);
  const [visible, setVisible] = useState(true);

  // Render pausado con la pestana en segundo plano.
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const dpr = useMemo<[number, number]>(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    return cores <= 4 ? [1, 1.5] : [1, 2];
  }, []);

  // Bloom solo con dpr >= 1.5 y sin reduced-motion.
  const bloom = dpr[1] >= 1.5 && !reduced && !isSmall;

  return (
    <Canvas
      className="flower-canvas"
      eventSource={stageRef as React.RefObject<HTMLElement>}
      eventPrefix="client"
      dpr={dpr}
      frameloop={visible ? 'always' : 'never'}
      camera={{
        fov: isSmall ? CAMERA.fovSmall : CAMERA.fov,
        position: [...CAMERA.position],
        near: CAMERA.near,
        far: CAMERA.far,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ContentBridge value={value}>
        <SunflowerModel reduced={reduced} onHover={onHover} />
        {bloom && (
          <EffectComposer>
            <Bloom intensity={0.45} luminanceThreshold={0.72} luminanceSmoothing={0.24} mipmapBlur />
          </EffectComposer>
        )}
      </ContentBridge>
    </Canvas>
  );
}
