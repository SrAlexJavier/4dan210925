import { useState } from 'react';

export type WebGLSupport = 'pending' | 'yes' | 'no';

function probe(): WebGLSupport {
  if (typeof document === 'undefined') return 'pending';
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    if (!gl) return 'no';
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return 'yes';
  } catch {
    return 'no';
  }
}

/** Se resuelve una sola vez, en el primer render: no hay estado intermedio. */
export function useWebGLSupport(): WebGLSupport {
  const [support] = useState(probe);
  return support;
}
