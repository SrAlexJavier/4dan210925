import * as THREE from 'three';

/**
 * Texturas generadas en canvas: cero peticiones de red, un `useMemo` y
 * compartidas por todas las piezas.
 */

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('canvas 2d no disponible');
  return { el, ctx };
}

function finish(el: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(el);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Nervaduras de la ligula: tres pares de lineas paralelas en 64x256.
 * Se usa como `roughnessMap` (las nervaduras son mas mate) y se mezcla al
 * color con un 6 % de oscurecimiento.
 */
let ligulePair: { rough: THREE.Texture; shade: THREE.Texture } | null = null;

export function liguleVeins() {
  if (ligulePair) return ligulePair;
  const W = 64;
  const H = 256;

  const rough = canvas(W, H);
  rough.ctx.fillStyle = '#d8d8d8';
  rough.ctx.fillRect(0, 0, W, H);

  const shade = canvas(W, H);
  shade.ctx.fillStyle = '#ffffff';
  shade.ctx.fillRect(0, 0, W, H);

  // Tres pares: el nervio central y dos secundarias a cada lado, que se
  // juntan hacia la punta igual que en una ligula real.
  const pairs = [0, 0.19, 0.34];
  for (const offset of pairs) {
    for (const sign of offset === 0 ? [0] : [-1, 1]) {
      rough.ctx.beginPath();
      shade.ctx.beginPath();
      for (let y = 0; y <= H; y += 4) {
        const v = y / H;
        // Convergen hacia la punta.
        const spread = offset * (1 - Math.pow(v, 1.5) * 0.78);
        const x = W / 2 + sign * spread * W;
        if (y === 0) {
          rough.ctx.moveTo(x, y);
          shade.ctx.moveTo(x, y);
        } else {
          rough.ctx.lineTo(x, y);
          shade.ctx.lineTo(x, y);
        }
      }
      rough.ctx.strokeStyle = '#ffffff';
      rough.ctx.lineWidth = offset === 0 ? 3 : 2;
      rough.ctx.stroke();

      shade.ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      shade.ctx.lineWidth = offset === 0 ? 4 : 3;
      shade.ctx.stroke();
    }
  }

  const shadeTex = finish(shade.el);
  // Se usa como `map`: multiplica al color por vertice, asi que va en sRGB.
  shadeTex.colorSpace = THREE.SRGBColorSpace;
  ligulePair = { rough: finish(rough.el), shade: shadeTex };
  return ligulePair;
}

/**
 * Nervadura de la hoja: nervio central de 3 px, cinco pares de secundarias
 * a 38 grados y un ruido fino de fondo. Una sola textura para las tres hojas,
 * usada a la vez como `bumpMap` y multiplicando el color un 8 %.
 */
let leafTex: { bump: THREE.Texture; shade: THREE.Texture } | null = null;

export function leafVeins() {
  if (leafTex) return leafTex;
  const S = 256;
  const { el, ctx } = canvas(S, S);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);

  // Ruido fino: la hoja de girasol es aspera.
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  ctx.lineCap = 'round';

  // Nervio central, de la base (abajo) a la punta (arriba).
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(S / 2, S);
  ctx.lineTo(S / 2, 4);
  ctx.stroke();

  // Cinco pares de secundarias saliendo a 38 grados.
  const rad = (38 * Math.PI) / 180;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d6d6d6';
  for (let i = 0; i < 5; i++) {
    const t = 0.12 + i * 0.17;
    const y = S - t * S;
    const reach = (1 - t) * S * 0.46 + 14;
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(S / 2, y);
      ctx.lineTo(S / 2 + sign * reach * Math.cos(rad), y - reach * Math.sin(rad));
      ctx.stroke();
    }
  }

  // Segunda pasada, blanca: la misma nervadura sirve para multiplicar el
  // color un 8 %. Mismo dibujo, dos usos, una sola generacion.
  const shade = canvas(S, S);
  shade.ctx.fillStyle = '#ffffff';
  shade.ctx.fillRect(0, 0, S, S);
  shade.ctx.drawImage(el, 0, 0);
  shade.ctx.globalCompositeOperation = 'lighter';
  shade.ctx.fillStyle = 'rgba(255,255,255,0.84)';
  shade.ctx.fillRect(0, 0, S, S);
  shade.ctx.globalCompositeOperation = 'source-over';
  const shadeTex = finish(shade.el);
  shadeTex.colorSpace = THREE.SRGBColorSpace;

  leafTex = { bump: finish(el), shade: shadeTex };
  return leafTex;
}

/**
 * Sombra de contacto: un sprite con degradado radial bajo la base del tallo.
 * Sustituye a `ContactShadows`, que costaba un pase de profundidad por frame
 * para una sombra casi invisible sobre un fondo sin suelo.
 */
let shadowTex: THREE.Texture | null = null;

export function contactShadowTexture(): THREE.Texture {
  if (shadowTex) return shadowTex;
  const S = 128;
  const { el, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(8,12,9,0.85)');
  g.addColorStop(0.55, 'rgba(8,12,9,0.32)');
  g.addColorStop(1, 'rgba(8,12,9,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  shadowTex = finish(el);
  return shadowTex;
}

/** Mota de polen: un punto blando, sin bordes. */
let pollenTex: THREE.Texture | null = null;

export function pollenTexture(): THREE.Texture {
  if (pollenTex) return pollenTex;
  const S = 64;
  const { el, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,238,180,1)');
  g.addColorStop(0.4, 'rgba(255,214,110,0.55)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = finish(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  pollenTex = tex;
  return pollenTex;
}
