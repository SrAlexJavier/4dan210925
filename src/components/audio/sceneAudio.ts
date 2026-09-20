/**
 * Seis voces, todas sintetizadas. Cero archivos, cero peticiones de red.
 * El `AudioContext` se crea en el primer gesto del usuario, nunca al montar.
 */

type Ctx = AudioContext;
type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let effectsOn = true;

export function audioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.AudioContext ?? (window as WebkitWindow).webkitAudioContext);
}

/** Llamar desde el primer gesto real del usuario. Idempotente. */
export function ensureAudio(): boolean {
  if (!audioSupported()) return false;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext!;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise(ctx, 2);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return true;
}

export function setEffectsEnabled(on: boolean) {
  effectsOn = on;
}

function makeNoise(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // Ruido rosa (tres polos): mas cuerpo que el blanco, menos siseo.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
  }
  return buf;
}

function live(): { c: AudioContext; out: GainNode } | null {
  if (!effectsOn || !ctx || !master || !noiseBuffer) return null;
  return { c: ctx, out: master };
}

function noiseSource(c: AudioContext): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

export interface TensionHandle {
  set(amount01: number): void;
  stop(): void;
}

/** Ruido rosa continuo, pasa-bajos a 700 Hz, ganancia proporcional al tiron. */
export function petalTension(): TensionHandle {
  const l = live();
  if (!l) return { set: () => {}, stop: () => {} };
  const { c, out } = l;
  const src = noiseSource(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(lp).connect(g).connect(out);
  src.start();
  let stopped = false;
  return {
    set(amount01: number) {
      if (stopped) return;
      const t = Math.max(0, Math.min(1, amount01));
      g.gain.setTargetAtTime(t * 0.05, c.currentTime, 0.04);
      lp.frequency.setTargetAtTime(500 + t * 500, c.currentTime, 0.08);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      g.gain.setTargetAtTime(0, c.currentTime, 0.03);
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* ya detenido */
        }
      }, 180);
    },
  };
}

/** 8 ms de ruido, pasa-banda 3 200 Hz Q 6. El aviso del punto de no retorno. */
export function petalArm() {
  const l = live();
  if (!l) return;
  const { c, out } = l;
  const src = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 6;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.04, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.02);
}

/** Chasquido + cuerpo grave de 190 Hz. El grave es lo que lo hace fisico. */
export function petalSnap() {
  const l = live();
  if (!l) return;
  const { c, out } = l;
  const t = c.currentTime;

  const src = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 4;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.05, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  src.connect(bp).connect(ng).connect(out);
  src.start(t);
  src.stop(t + 0.04);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, t);
  const og = c.createGain();
  og.gain.setValueAtTime(0.06, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + 0.06);
}

/** 160 ms, pasa-banda barriendo 1 200 -> 3 400 Hz, con comb de 9 ms. */
export function leafRustle() {
  const l = live();
  if (!l) return;
  const { c, out } = l;
  const t = c.currentTime;

  const src = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.6;
  bp.frequency.setValueAtTime(1200, t);
  bp.frequency.linearRampToValueAtTime(3400, t + 0.16);

  const delay = c.createDelay(0.05);
  delay.delayTime.value = 0.009;
  const fb = c.createGain();
  fb.gain.value = 0.45;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.05);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.16);

  src.connect(bp);
  bp.connect(g);
  bp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(g);
  g.connect(out);

  src.start(t);
  src.stop(t + 0.2);
}

/** Tres parciales calidos. La unica nota afinada de toda la pagina. */
export function rebloomChord() {
  const l = live();
  if (!l) return;
  const { c, out } = l;
  const t = c.currentTime;
  [196, 294, 392].forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const peak = 0.03 / (1 + i * 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.9);
    g.gain.setValueAtTime(peak, t + 1.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 2.6);
  });
}

/** Campana muy suave, dos parciales. Al tocar el centro del disco. */
export function discChime() {
  const l = live();
  if (!l) return;
  const { c, out } = l;
  const t = c.currentTime;
  [523.25, 1046.5].forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = c.createGain();
    const peak = i === 0 ? 0.035 : 0.012;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 0 ? 1.1 : 0.6));
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}

/**
 * Dos transitorios (agarre en t=0, suelta en t=140 ms), pasa-banda barriendo
 * 800 -> 3 200 Hz con Q 2.2. Con Q 0.7 suena a siseo, no a papel.
 */
export function pageFlip(variant: 'page' | 'cover' = 'page') {
  const l = live();
  if (!l) return;
  const { c, out } = l;
  const t = c.currentTime;
  const low = variant === 'cover';

  const burst = (at: number, amp: number, dur: number) => {
    const src = noiseSource(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(low ? 520 : 800, t + at);
    bp.frequency.exponentialRampToValueAtTime(low ? 1900 : 3200, t + at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.linearRampToValueAtTime(amp, t + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(t + at);
    src.stop(t + at + dur + 0.05);
  };

  burst(0, low ? 0.075 : 0.055, 0.12);
  burst(0.14, low ? 0.06 : 0.045, 0.16);
}

let ambient: { stop: () => void } | null = null;

/** Musica ambiental: apagada por defecto, sin autoplay, creada al activarse. */
export function startAmbient() {
  if (!ensureAudio() || !ctx || !master || ambient) return;
  const c = ctx;
  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(master);
  bus.gain.setTargetAtTime(0.045, c.currentTime, 2.4);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(bus);

  const voices = [98, 147, 196, 261.6].map((f, i) => {
    const osc = c.createOscillator();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = f * (1 + (i % 2 === 0 ? 0.0012 : -0.0015));
    const g = c.createGain();
    g.gain.value = 0.18 / (1 + i * 0.5);

    // Respiracion lenta y desfasada por voz: nada se repite a la vista.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.035 + i * 0.011;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.08 / (1 + i * 0.5);
    lfo.connect(lfoGain).connect(g.gain);

    osc.connect(g).connect(lp);
    osc.start();
    lfo.start();
    return { osc, lfo };
  });

  ambient = {
    stop() {
      bus.gain.setTargetAtTime(0, c.currentTime, 0.8);
      window.setTimeout(() => {
        voices.forEach(({ osc, lfo }) => {
          try {
            osc.stop();
            lfo.stop();
          } catch {
            /* ya detenido */
          }
        });
      }, 2600);
    },
  };
}

export function stopAmbient() {
  ambient?.stop();
  ambient = null;
}
