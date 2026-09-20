import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../../constants/theme';
import { DISC, DISC_RMAX, LEAF, LIGULE, STEM, domeZ, seedPolar } from '../../constants/flowerModel';

/* ──────────────────────────────────────────────────────────────────────
   La ligula.

   v2 sumaba el arco longitudinal y el «nervio central» con el mismo signo,
   asi que el nervio profundizaba el mismo hueco que ya hacia el arco y el
   petalo salia plano. Aqui la quilla SOBRESALE (+z) con amplitud que nace
   en cero, el arco solo se acentua hacia la punta, y los bordes caen
   respecto a la quilla. Ese barrido de luz por la quilla es el 80 % de la
   lectura de «petalo» frente a «trozo de plastico amarillo».
   ────────────────────────────────────────────────────────────────────── */

let liguleGeo: THREE.BufferGeometry | null = null;

export function createLiguleGeometry(): THREE.BufferGeometry {
  if (liguleGeo) return liguleGeo;

  const g = new THREE.PlaneGeometry(LIGULE.width, LIGULE.length, LIGULE.segW, LIGULE.segL);
  // Base en y = 0, punta en y = length.
  g.translate(0, LIGULE.length / 2, 0);

  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const cBase = new THREE.Color(PALETTE.petalBase);
  const cMid = new THREE.Color(PALETTE.petalMid);
  const cTip = new THREE.Color(PALETTE.petalTip);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const v = THREE.MathUtils.clamp(y / LIGULE.length, 0, 1);
    const u = x / LIGULE.width + 0.5;

    const fold = Math.pow(Math.sin(v * Math.PI), 1.6); // 0 en base y punta
    const curl = Math.pow(v, 1.9); // solo la punta se arquea

    // 1. quilla central: el nervio sobresale, con amplitud que nace en 0
    z += (0.5 - Math.abs(u - 0.5)) * 0.062 * fold;
    // 2. arco longitudinal: cuchara que se acentua hacia la punta
    z -= curl * 0.085;
    // 3. alabeo: los bordes caen respecto a la quilla
    z -= Math.pow(Math.abs(u - 0.5) * 2, 2.1) * 0.044 * fold;

    // 4. afinado y dientes de la punta
    const taper = 1 - Math.pow(v, 2.4) * 0.52;
    const teeth =
      v > 0.88 ? Math.sin((u - 0.5) * Math.PI * 6) * 0.006 * ((v - 0.88) / 0.12) : 0;
    x *= taper;
    y += teeth;

    pos.setXYZ(i, x, y, z);

    // Color por vertice: tres paradas en v.
    if (v < 0.45) c.copy(cBase).lerp(cMid, v / 0.45);
    else c.copy(cMid).lerp(cTip, (v - 0.45) / 0.55);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  pos.needsUpdate = true;
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  liguleGeo = g;
  return g;
}

/** Proxy de colision: dos triangulos, compartidos por las 24 piezas. */
let proxyGeo: THREE.BufferGeometry | null = null;

export function createProxyGeometry(): THREE.BufferGeometry {
  if (!proxyGeo) {
    proxyGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    proxyGeo.translate(0, 0.5, 0);
  }
  return proxyGeo;
}

/* ── Semilla del disco ─────────────────────────────────────────────── */

let seedGeo: THREE.BufferGeometry | null = null;

export function createSeedGeometry(): THREE.BufferGeometry {
  if (!seedGeo) {
    // Un hexagono aplastado: es lo que tesela el disco sin huecos.
    seedGeo = new THREE.CircleGeometry(0.5, 6);
  }
  return seedGeo;
}

/** Base del disco: un domo levemente convexo. */
export function createDiscBaseGeometry(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(DISC.radius * 1.02, 48);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, domeZ(Math.hypot(x, y)) * 0.92);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Posiciones polares de las 420 semillas, calculadas una sola vez. */
export function seedLayout() {
  const out: { x: number; y: number; z: number; scale: number; rNorm: number }[] = [];
  for (let n = 0; n < DISC.seedCount; n++) {
    const { r, theta, rNorm, scale } = seedPolar(n);
    out.push({
      x: Math.cos(theta) * r,
      y: Math.sin(theta) * r,
      z: domeZ(r),
      scale,
      rNorm: Math.min(rNorm, 1),
    });
  }
  return out;
}

export { DISC_RMAX };

/* ──────────────────────────────────────────────────────────────────────
   La hoja: cordada, grande, dentada, con nervadura marcada.
   `ShapeGeometry` triangula plano y sin vertices interiores, asi que hay
   que subdividir antes de poder deformarla.
   ────────────────────────────────────────────────────────────────────── */

function leafOutline(samples: number, toothDepth: number): THREE.Vector2[] {
  const path = new THREE.CurvePath<THREE.Vector2>();
  path.add(
    new THREE.CubicBezierCurve(
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.22, 0.02),
      new THREE.Vector2(0.46, 0.3),
      new THREE.Vector2(0.34, 0.72),
    ),
  );
  path.add(
    new THREE.CubicBezierCurve(
      new THREE.Vector2(0.34, 0.72),
      new THREE.Vector2(0.28, 0.9),
      new THREE.Vector2(0.1, 0.97),
      new THREE.Vector2(0, 1),
    ),
  );

  const raw = path.getSpacedPoints(samples);

  // Serrado: se desplazan los puntos intermedios a lo largo de la normal
  // exterior, alternando diente y seno.
  const right: THREE.Vector2[] = raw.map((p, i) => {
    if (i === 0 || i === raw.length - 1) return p.clone();
    const t = raw[i + 1].clone().sub(raw[i - 1]).normalize();
    const n = new THREE.Vector2(t.y, -t.x);
    const amount = i % 2 === 0 ? toothDepth : -toothDepth * 0.35;
    return p.clone().addScaledVector(n, amount);
  });

  const left = right
    .slice(1, right.length - 1)
    .reverse()
    .map((p) => new THREE.Vector2(-p.x, p.y));

  return [...right, ...left];
}

function subdivideOnce(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const out = new Float32Array(pos.count * 4 * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const bc = new THREE.Vector3();
  const ca = new THREE.Vector3();

  let w = 0;
  const push = (v: THREE.Vector3) => {
    out[w++] = v.x;
    out[w++] = v.y;
    out[w++] = v.z;
  };

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.copy(a).add(b).multiplyScalar(0.5);
    bc.copy(b).add(c).multiplyScalar(0.5);
    ca.copy(c).add(a).multiplyScalar(0.5);

    push(a); push(ab); push(ca);
    push(ab); push(b); push(bc);
    push(ca); push(bc); push(c);
    push(ab); push(bc); push(ca);
  }

  const next = new THREE.BufferGeometry();
  next.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return next;
}

export interface LeafGeometryOptions {
  length: number;
  width: number;
}

export function createLeafGeometry({ length, width }: LeafGeometryOptions) {
  const shape = new THREE.Shape(leafOutline(LEAF.outlineSamples, LEAF.toothDepth));
  let geo: THREE.BufferGeometry = new THREE.ShapeGeometry(shape);

  // Subdividir hasta poder deformar de verdad: ~420 vertices por hoja.
  for (let i = 0; i < 3; i++) {
    geo = mergeVertices(subdivideOnce(geo), 1e-5);
    if ((geo.attributes.position as THREE.BufferAttribute).count >= 380) break;
  }

  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const sx = width / (box.max.x - box.min.x);
  const sy = length / (box.max.y - box.min.y);
  geo.scale(sx, sy, 1);
  geo.translate(0, -box.min.y * sy, 0);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(pos.count * 2);
  const halfW = width / 2;
  const proportion = length / 0.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const v = THREE.MathUtils.clamp(y / length, 0, 1);
    const u = THREE.MathUtils.clamp(x / (halfW * 2) + 0.5, 0, 1);

    // En reposo la hoja cuelga y se comba: la punta cae, el centro acanala.
    let z = -Math.pow(v, 1.7) * LEAF.droop * proportion;
    z += (0.5 - Math.abs(u - 0.5)) * LEAF.channel * Math.sin(v * Math.PI) * proportion;

    pos.setZ(i, z);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  pos.needsUpdate = true;
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  return geo;
}

/* ── Tallo ─────────────────────────────────────────────────────────── */

export function createStemGeometry(seed = 0.4) {
  const drift = STEM.lateralDrift;
  const points = [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
    const wobble = Math.sin((i + seed) * 2.1) * drift;
    return new THREE.Vector3(wobble * (1 - t * 0.35), t * STEM.length, wobble * 0.4);
  });

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const geo = new THREE.TubeGeometry(
    curve,
    STEM.tubularSegments,
    STEM.baseRadius,
    STEM.radialSegments,
    false,
  );

  // TubeGeometry tiene radio constante: se afina a mano hacia el cuello.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const center = new THREE.Vector3();
  const p = new THREE.Vector3();
  const rings = STEM.tubularSegments + 1;
  const perRing = STEM.radialSegments + 1;

  for (let s = 0; s < rings; s++) {
    const t = s / STEM.tubularSegments;
    curve.getPointAt(t, center);
    const k = THREE.MathUtils.lerp(1, STEM.neckRadius / STEM.baseRadius, Math.pow(t, 0.85));
    for (let r = 0; r < perRing; r++) {
      const i = s * perRing + r;
      p.fromBufferAttribute(pos, i).sub(center).multiplyScalar(k).add(center);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();

  return { geometry: geo, curve };
}

/** La curva del tallo, compartida: las hojas cuelgan de ella. */
let stemCurveCache: THREE.CatmullRomCurve3 | null = null;

export function getStemCurve(): THREE.CatmullRomCurve3 {
  if (!stemCurveCache) stemCurveCache = createStemGeometry(0.4).curve;
  return stemCurveCache;
}

/** Peciolo: un tubo fino de la insercion en el tallo a la base del limbo. */
export function createPetioleGeometry(length: number) {
  const geo = new THREE.CylinderGeometry(0.009, 0.013, Math.max(length, 0.001), 6, 1, true);
  geo.translate(0, Math.max(length, 0.001) / 2, 0);
  return geo;
}
