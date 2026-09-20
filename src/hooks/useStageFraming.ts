import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { BREAKPOINTS } from '../constants/theme';
import { FRAMING, FRAMING_SM } from '../constants/flowerModel';

export interface StageFraming {
  /** Diámetro de la cabeza en unidades de mundo: es la escala del modelo. */
  headSize: number;
  x: number;
  y: number;
  vw: number;
  vh: number;
  isSmall: boolean;
}

/**
 * Un único sitio decide el tamaño y la posición de la planta en mundo.
 * El modelo se construye normalizado (cabeza = 1.0) y aquí se escala.
 */
export function useStageFraming(): StageFraming {
  const viewport = useThree((s) => s.viewport);
  const size = useThree((s) => s.size);

  return useMemo(() => {
    const { width: vw, height: vh } = viewport;
    const isSmall = size.width < BREAKPOINTS.sm;
    const f = isSmall ? FRAMING_SM : FRAMING;

    const headSize = Math.min(
      f.headFractionOfHeight * vh,
      (f.columnFraction * vw) / f.plantWidthInHeads,
    );

    const x = isSmall ? 0 : -vw / 2 + f.axisFraction * vw;
    const y = f.yFraction * vh;

    return { headSize, x, y, vw, vh, isSmall };
  }, [viewport, size.width]);
}
