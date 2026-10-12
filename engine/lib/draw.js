// Shared canvas helpers for 9:16 scenes. Design space is 1080x1920.
import { clamp, lerp, spring, rgb, hex, rand } from './motion.js';

export const DW = 1080, DH = 1920;
export const CN = '"PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif';
export const MONO = '"SF Mono","Menlo","Monaco",monospace';
export const TAU = Math.PI * 2;
export const PALETTE = {
  ink: hex('#0E0E12'),
  ink2: hex('#17171E'),
  paper: hex('#F2EDE4'),
  orange: hex('#FF5B1F'),
  blue: hex('#2F6BFF'),
  lime: hex('#C8F04A'),
  grey: hex('#8A8A94'),
};

export function createStage() {
  const q = new URLSearchParams(location.search);
  const W = Number(q.get('w') || 1080), H = Number(q.get('h') || 1920);
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const S = Math.min(W / DW, H / DH);

  const reset = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  function bg(c) {
    reset();
    ctx.fillStyle = rgb(c);
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, (W - DW * S) / 2, (H - DH * S) / 2);
  }

  function text(str, x, y, { size = 60, font = CN, weight = 600, color = PALETTE.paper, alpha = 1, align = 'center', base = 'middle', spacing = 0 } = {}) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillStyle = rgb(color, alpha);
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(str, x, y);
    ctx.letterSpacing = '0px';
  }

  function measure(str, size, weight = 600, font = CN) {
    ctx.font = `${weight} ${size}px ${font}`;
    return ctx.measureText(str).width;
  }

  // Per-character springy line, centred on cx.
  function springLine(str, cx, cy, t0, t, { size, color, stagger = 0.045, preset = 'snappy', rise = 120, font = CN, weight = 600 }) {
    ctx.font = `${weight} ${size}px ${font}`;
    const chars = [...str];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
    chars.forEach((ch, i) => {
      const p = spring(t - t0 - i * stagger, preset);
      if (p > 0.001) {
        ctx.save();
        ctx.translate(x + widths[i] / 2, cy + (1 - p) * rise);
        const s = lerp(0.6, 1, Math.min(p, 1.2));
        ctx.scale(s, s);
        text(ch, 0, 0, { size, color, alpha: clamp(p * 1.6), font, weight });
        ctx.restore();
      }
      x += widths[i];
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  }

  // Rich text: segments wrapped in 【】 are drawn in `hi` colour. Auto-shrinks to maxW.
  function richText(str, cx, cy, { size = 64, color = PALETTE.paper, hi = PALETTE.orange, alpha = 1, maxW = 940, weight = 600 } = {}) {
    const segs = [];
    str.split(/(【[^】]*】)/).forEach((s) => {
      if (!s) return;
      if (s.startsWith('【')) segs.push({ s: s.slice(1, -1), hi: true });
      else segs.push({ s, hi: false });
    });
    let fs = size;
    let total = segs.reduce((a, g) => a + measure(g.s, fs, weight), 0);
    if (total > maxW) { fs = (fs * maxW) / total; total = maxW; }
    let x = cx - total / 2;
    for (const g of segs) {
      const w = measure(g.s, fs, weight);
      text(g.s, x, cy, { size: fs, color: g.hi ? hi : color, alpha, align: 'left', weight });
      x += w;
    }
    return { width: total, size: fs };
  }

  // Film grain: pre-baked deterministic noise tiles, cycled at 24 fps.
  const grain = [0, 1, 2, 3].map((g) => {
    const c = document.createElement('canvas');
    c.width = 360; c.height = 640;
    const x = c.getContext('2d');
    const img = x.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand(i * 0.37 + g * 9173.1) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  });
  function drawGrain(t, amount = 0.07) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = 'overlay';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grain[Math.floor(t * 24) % 4], 0, 0, W, H);
    ctx.restore();
  }

  return { canvas, ctx, W, H, S, reset, bg, text, measure, springLine, roundRect, richText, drawGrain };
}

// Seeded PRNG (mulberry32) for simulations that must replay identically.
export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
