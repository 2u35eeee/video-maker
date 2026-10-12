// Pure functions of time. Nothing here keeps state, so seek(t) stays deterministic.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (k) => k * k * (3 - 2 * k);
export const easeOutCubic = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInCubic = (k) => Math.pow(clamp(k), 3);
export const easeInOutCubic = (k) => {
  k = clamp(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};

// Spring presets: stiffness / damping / mass.
export const SPRINGS = {
  snappy: { k: 520, c: 34, m: 1 }, // UI: buttons, toggles (tiny overshoot)
  default: { k: 220, c: 24, m: 1 }, // cards, containers, camera
  heavy: { k: 140, c: 26, m: 1.4 }, // big type, logo lockups (no overshoot)
  playful: { k: 300, c: 12, m: 1 }, // mascots, stickers (visible overshoot)
};

// Closed-form damped spring from 0 to 1, started at local time t = 0.
export function spring(t, preset = 'default') {
  if (t <= 0) return 0;
  const { k, c, m } = typeof preset === 'string' ? SPRINGS[preset] : preset;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const r1 = -w0 * (z - Math.sqrt(z * z - 1));
  const r2 = -w0 * (z + Math.sqrt(z * z - 1));
  const A = r2 / (r2 - r1);
  return 1 - (A * Math.exp(r1 * t) + (1 - A) * Math.exp(r2 * t));
}

// A value that changes target several times. Instead of restarting a spring,
// add one spring per change, each from its own start time, so the motion stays
// continuous and any frame can be computed directly.
// keys: [{ t, v, p? }], first key is the initial value.
export function track(t, keys, preset = 'default') {
  let v = keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const d = keys[i].v - keys[i - 1].v;
    v += d * spring(t - keys[i].t, keys[i].p || preset);
  }
  return v;
}

// Same as track() but for [r, g, b] colours.
export function trackColor(t, keys, preset = 'default') {
  return [0, 1, 2].map((ch) => track(t, keys.map((k) => ({ ...k, v: k.v[ch] })), preset));
}

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgb = ([r, g, b], a = 1) =>
  `rgba(${Math.round(clamp(r, 0, 255))},${Math.round(clamp(g, 0, 255))},${Math.round(clamp(b, 0, 255))},${a})`;
export const mixColor = (a, b, k) => a.map((x, i) => lerp(x, b[i], k));

// Beat grid.
export const beatGrid = (bpm) => {
  const beat = 60 / bpm;
  return {
    beat,
    bar: beat * 4,
    at: (n) => n * beat, // time of beat n
    index: (t) => Math.floor(t / beat + 1e-6),
    phase: (t) => (t / beat) - Math.floor(t / beat + 1e-6), // 0..1 within beat
    // decaying pulse that hits 1 on every beat
    pulse: (t, decay = 8) => Math.exp(-decay * ((t / beat) - Math.floor(t / beat + 1e-6)) * beat),
  };
};

// Deterministic hash-based random in [0, 1).
export function rand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
