// Tiny offline synth: every sound is a pure function of sample time, written
// into a stereo float buffer on the same timeline as the picture.
import fs from 'node:fs';

export const SR = 44100;

export function createMix(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), n };
}

// Deterministic noise.
let seed = 1;
export const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};

const add = (mix, i, v, pan = 0) => {
  if (i < 0 || i >= mix.n) return;
  mix.L[i] += v * Math.min(1, 1 - pan);
  mix.R[i] += v * Math.min(1, 1 + pan);
};

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function kick(mix, t, gain = 1) {
  const s = Math.floor(t * SR);
  const len = 0.45 * SR;
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    const f = 45 + 130 * Math.exp(-x * 28);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-x * 7.5);
    const click = i < 60 ? noise() * (1 - i / 60) * 0.4 : 0;
    add(mix, s + i, (Math.sin(ph) * env + click) * 0.9 * gain);
  }
}

export function clap(mix, t, gain = 1) {
  const s = Math.floor(t * SR);
  const len = 0.25 * SR;
  let lp = 0, prev = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    // three quick bursts then a tail
    const burst = x < 0.03 ? Math.exp(-((x % 0.01) * 300)) : Math.exp(-(x - 0.03) * 18);
    const n = noise();
    lp += 0.35 * (n - lp);
    const hp = lp - prev; prev = lp;
    add(mix, s + i, hp * burst * 1.6 * gain, 0.1);
  }
}

export function hat(mix, t, gain = 1, open = false) {
  const s = Math.floor(t * SR);
  const len = (open ? 0.22 : 0.05) * SR;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const n = noise();
    const hp = n - prev; prev = n;
    add(mix, s + i, hp * Math.exp(-(i / SR) * (open ? 14 : 70)) * 0.22 * gain, -0.25);
  }
}

// Short sine pluck, for UI clicks and blips.
export function blip(mix, t, hz = 1200, gain = 1, pan = 0) {
  const s = Math.floor(t * SR);
  const len = 0.12 * SR;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    add(mix, s + i, Math.sin(2 * Math.PI * hz * x) * Math.exp(-x * 40) * 0.28 * gain, pan);
  }
}

// Filtered noise sweep rising into time `end`.
export function riser(mix, start, end, gain = 1) {
  const s = Math.floor(start * SR);
  const len = Math.floor((end - start) * SR);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const k = i / len;
    const a = 0.02 + 0.5 * k * k;
    lp += a * (noise() - lp);
    add(mix, s + i, lp * k * k * 0.7 * gain, Math.sin(k * 20) * 0.3);
  }
}

// Reverse-swell whoosh centred on time t.
export function whoosh(mix, t, dur = 0.35, gain = 1) {
  const s = Math.floor((t - dur) * SR);
  const len = Math.floor(dur * 1.4 * SR);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR - dur;
    const env = x < 0 ? Math.pow(1 + x / dur, 3) : Math.exp(-x * 25);
    lp += (0.05 + 0.3 * env) * (noise() - lp);
    add(mix, s + i, lp * env * 0.9 * gain, x * 2);
  }
}

// Low boom + noise for big hits.
export function impact(mix, t, gain = 1) {
  const s = Math.floor(t * SR);
  const len = 1.6 * SR;
  let ph = 0, lp = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * (38 + 60 * Math.exp(-x * 10))) / SR;
    lp += 0.08 * (noise() - lp);
    add(mix, s + i, (Math.sin(ph) * Math.exp(-x * 2.2) * 0.8 + lp * Math.exp(-x * 4) * 0.8) * gain);
  }
}

// Saw bass note through a one-pole lowpass.
export function bass(mix, t, dur, midi, gain = 1) {
  const s = Math.floor(t * SR);
  const len = Math.floor(dur * SR);
  const hz = midiHz(midi);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    const saw = 2 * ((x * hz) % 1) - 1;
    const sub = Math.sin(2 * Math.PI * hz * x);
    const cut = 0.04 + 0.12 * Math.exp(-x * 9);
    lp += cut * (saw - lp);
    const env = Math.min(1, x * 200) * Math.min(1, (len - i) / (0.01 * SR));
    add(mix, s + i, (lp * 0.5 + sub * 0.6) * env * 0.42 * gain);
  }
}

// Detuned saw pad chord.
export function pad(mix, t, dur, midis, gain = 1) {
  const s = Math.floor(t * SR);
  const len = Math.floor(dur * SR);
  const voices = midis.flatMap((m) => [-0.09, 0.09].map((d) => midiHz(m + d)));
  const lpL = new Array(voices.length).fill(0);
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    const env = Math.min(1, x / 0.08) * Math.min(1, (len - i) / (0.15 * SR));
    let l = 0, r = 0;
    voices.forEach((hz, v) => {
      const saw = 2 * ((x * hz + v * 0.13) % 1) - 1;
      lpL[v] += 0.06 * (saw - lpL[v]);
      if (v % 2) r += lpL[v]; else l += lpL[v];
    });
    add(mix, s + i, l * env * 0.07 * gain, -0.6);
    add(mix, s + i, r * env * 0.07 * gain, 0.6);
  }
}

// Sidechain: duck the given buffer region after each kick time.
export function duck(buf, kicks, amount = 0.6, release = 0.22) {
  for (const t of kicks) {
    const s = Math.floor(t * SR);
    const len = Math.floor(release * SR);
    for (let i = 0; i < len && s + i < buf.n; i++) {
      const g = 1 - amount * (1 - i / len) ** 2;
      buf.L[s + i] *= g;
      buf.R[s + i] *= g;
    }
  }
}

// Mix buses into one, add a simple stereo delay-reverb, soft-clip and normalize.
export function master(buses, { reverb = 0.18, fadeOut = 0.3 } = {}) {
  const n = buses[0].n;
  const out = createMix(n / SR);
  for (const b of buses) for (let i = 0; i < n; i++) { out.L[i] += b.L[i]; out.R[i] += b.R[i]; }
  const taps = [[0.031, 0.5], [0.047, 0.42], [0.071, 0.33], [0.113, 0.25], [0.167, 0.17]];
  const L = Float32Array.from(out.L), R = Float32Array.from(out.R);
  for (const [d, g] of taps) {
    const off = Math.floor(d * SR);
    for (let i = off; i < n; i++) { out.L[i] += R[i - off] * g * reverb; out.R[i] += L[i - off] * g * reverb; }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) {
    out.L[i] = Math.tanh(out.L[i] * 1.2);
    out.R[i] = Math.tanh(out.R[i] * 1.2);
    peak = Math.max(peak, Math.abs(out.L[i]), Math.abs(out.R[i]));
  }
  const g = 0.89 / (peak || 1);
  const fo = Math.floor(fadeOut * SR);
  for (let i = 0; i < n; i++) {
    const f = i > n - fo ? (n - i) / fo : 1;
    out.L[i] *= g * f; out.R[i] *= g * f;
  }
  return out;
}

export function writeWav(file, mix) {
  const n = mix.n;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix.L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix.R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
