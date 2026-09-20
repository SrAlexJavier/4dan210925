import { useMediaQuery } from './useMediaQuery';

/**
 * `reduced-motion` no significa «menos funciones», significa «menos movimiento
 * involuntario». Lo que se quita es el rebote, el revoloteo y todo lo que se
 * mueve sin que nadie lo haya pedido.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
