import type { ThreeEvent } from '@react-three/fiber';

/**
 * El canvas se pinta por encima del álbum pero escucha los eventos desde el
 * contenedor que está por debajo (`eventSource`). Efecto secundario: un clic
 * sobre el álbum **también** lanza un raycast contra la flor. Sin este guardia,
 * abrir el álbum podría arrancar un pétalo que estuviera justo detrás.
 */
export function isOverAlbum(e: ThreeEvent<PointerEvent> | PointerEvent): boolean {
  const native = 'nativeEvent' in e ? e.nativeEvent : e;
  const target = native.target as HTMLElement | null;
  return !!target?.closest?.('[data-album-surface]');
}

/** Igual, pero sobre cualquier superficie de interfaz que deba ganar al canvas. */
export function isOverChrome(e: ThreeEvent<PointerEvent> | PointerEvent): boolean {
  const native = 'nativeEvent' in e ? e.nativeEvent : e;
  const target = native.target as HTMLElement | null;
  return !!target?.closest?.('[data-album-surface], [data-ui-surface]');
}
