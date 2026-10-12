import { clamp, lerp, invLerp, spring, track, trackColor, hex, rgb, mixColor, beatGrid, rand, easeInCubic, easeOutCubic, easeInOutCubic } from '/engine/lib/motion.js';
import { BPM, DURATION, SECTIONS, MORPH_CLICKS, HOOK_LINES, WORD_HITS } from './timeline.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1080);
const H = Number(q.get('h') || 1920);
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

// Design space is 1080x1920; other formats letterbox the same design for now.
const DW = 1080, DH = 1920;
const S = Math.min(W / DW, H / DH);

const C = {
  ink: hex('#0E0E12'),
  ink2: hex('#17171E'),
  paper: hex('#F2EDE4'),
  orange: hex('#FF5B1F'),
  blue: hex('#2F6BFF'),
  lime: hex('#C8F04A'),
};
const CN = '"PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif';
const MONO = '"SF Mono","Menlo","Monaco",monospace';
const beat = beatGrid(BPM);
const TAU = Math.PI * 2;

// ---------- helpers ----------
function bg(c) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rgb(c);
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(S, 0, 0, S, (W - DW * S) / 2, (H - DH * S) / 2);
}

function text(str, x, y, { size = 60, font = CN, weight = 600, color = C.paper, alpha = 1, align = 'center', base = 'middle', spacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = rgb(color, alpha);
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.letterSpacing = '0px';
}

// Per-character springy line. Each char starts `stagger` after the previous.
function springLine(str, cx, cy, t0, t, { size, color, stagger = 0.045, preset = 'snappy', rise = 120, font = CN, weight = 600 }) {
  ctx.font = `${weight} ${size}px ${font}`;
  const chars = [...str];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  chars.forEach((ch, i) => {
    const p = spring(t - t0 - i * stagger, preset);
    if (p <= 0.001) { x += widths[i]; return; }
    ctx.save();
    ctx.translate(x + widths[i] / 2, cy + (1 - p) * rise);
    ctx.scale(lerp(0.6, 1, Math.min(p, 1.2)), lerp(0.6, 1, Math.min(p, 1.2)));
    text(ch, 0, 0, { size, color, alpha: clamp(p * 1.6), font, weight });
    ctx.restore();
    x += widths[i];
  });
}

function roundRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function timecode(t, color) {
  const s = t.toFixed(2).padStart(5, '0');
  text(`t = ${s}s`, 90, 170, { size: 30, font: MONO, weight: 500, color, alpha: 0.55, align: 'left' });
  text(`seek(t) · ${String(Math.floor(t * 60)).padStart(4, '0')}`, DW - 90, 170, { size: 30, font: MONO, weight: 500, color, alpha: 0.55, align: 'right' });
}

function caption(str, color, lt, y = 1560) {
  const p = spring(lt - 0.15, 'default');
  text(str, DW / 2, y + (1 - p) * 30, { size: 38, color, alpha: clamp(p) * 0.75, weight: 500, spacing: 4 });
}

// Film grain: a few pre-baked deterministic noise tiles, cycled at 24 fps.
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

// ---------- 1. hook ----------
function hook(lt, t) {
  bg(C.ink);
  const push = 1 + 0.035 * lt;
  const exit = easeInCubic(invLerp(1.82, 2.0, lt));
  ctx.save();
  ctx.translate(DW / 2, 960 - exit * 260);
  ctx.scale(push, push);
  ctx.translate(-DW / 2, -960);
  const lines = ['这条视频', '没有一帧', '是剪出来的'];
  lines.forEach((l, i) => springLine(l, DW / 2, 760 + i * 200, HOOK_LINES[i], t, { size: 150, color: i === 2 ? C.orange : C.paper }));
  // underline sweeps on beat 3
  const u = spring(lt - 1.5, 'snappy');
  if (u > 0) {
    ctx.fillStyle = rgb(C.orange);
    ctx.fillRect(DW / 2 - 380, 1265, 760 * clamp(u), 10);
  }
  ctx.restore();
  timecode(t, C.paper);
}

// ---------- 2. particles ----------
const GRID = 40;
let particles = null;
function buildParticles() {
  const off = document.createElement('canvas');
  off.width = 1000; off.height = 360;
  const o = off.getContext('2d');
  o.fillStyle = '#fff';
  o.font = `800 230px ${MONO}`;
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  o.fillText('seek(t)', 500, 185);
  const data = o.getImageData(0, 0, off.width, off.height).data;
  const pts = [];
  for (let y = 0; y < off.height; y += 6) for (let x = 0; x < off.width; x += 6) if (data[(y * off.width + x) * 4 + 3] > 128) pts.push([x, y]);
  const N = GRID * GRID;
  const targets = [];
  for (let i = 0; i < N; i++) {
    const p = pts[Math.floor((i / N) * pts.length)];
    targets.push([p[0] - 500 + DW / 2 + (rand(i) - 0.5) * 3, p[1] - 180 + 960 + (rand(i + 7) - 0.5) * 3]);
  }
  targets.sort((a, b) => a[0] - b[0]);
  const span = 900, step = span / (GRID - 1);
  const grid = [];
  for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) grid.push([DW / 2 - span / 2 + gx * step, 960 - span / 2 + gy * step]);
  // grid is already in x-major order, so index i maps left columns to left glyphs
  particles = grid.map((g, i) => ({ g, p: targets[i], d: Math.hypot(g[0] - DW / 2, g[1] - 960) }));
}
function particlesScene(lt, t) {
  bg(C.ink);
  if (!particles) buildParticles();
  const pulse = beat.pulse(t, 5);
  for (const pt of particles) {
    const intro = spring(lt - pt.d / 1800, 'snappy');
    if (intro <= 0) continue;
    const wave = Math.sin(pt.d * 0.028 - lt * 9) * (0.5 + 0.5 * pulse);
    const k = spring(lt - 1.0 - ((pt.g[0] - 90) / 900) * 0.35, 'default');
    const x = lerp(pt.g[0], pt.p[0], k);
    const y = lerp(pt.g[1] + wave * 16 * (1 - clamp(k)), pt.p[1], k);
    const r = lerp(3 + wave * 2.2, 4.2, clamp(k)) * Math.min(intro, 1.15);
    const hot = k > 0.5 && rand(pt.d) > 0.86;
    ctx.fillStyle = rgb(hot ? C.orange : C.paper, lerp(0.85, 1, clamp(k)));
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
    ctx.fill();
  }
  caption('1600 个粒子 · 一个函数', C.paper, lt - 1.45, 1320);
  timecode(t, C.paper);
}

// ---------- 3. morph ----------
function cursor(x, y, press) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.6 * press, 1.6 * press);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.lineTo(9, 26); ctx.lineTo(16, 41); ctx.lineTo(22, 38); ctx.lineTo(15, 23); ctx.lineTo(27, 23);
  ctx.closePath();
  ctx.fillStyle = rgb(C.ink);
  ctx.strokeStyle = rgb(C.paper);
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
function morph(lt, t) {
  bg(C.paper);
  const [c1, c2, c3] = MORPH_CLICKS;
  const a = 0.05; // shape answers 50 ms after the click
  const keys = (vals) => [{ t: 0, v: vals[0] }, { t: c1 + a, v: vals[1] }, { t: c2 + a, v: vals[2] }, { t: c3 + a, v: vals[3] }];
  const w = track(t, keys([160, 560, 260, 820]), 'snappy');
  const h = track(t, keys([160, 170, 260, 620]), 'snappy');
  const r = track(t, keys([80, 85, 130, 48]), 'snappy');
  const col = trackColor(t, keys([C.orange, C.ink, C.blue, C.ink]), 'snappy');
  const intro = spring(lt, 'playful');
  const cx = DW / 2, cy = 900;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(intro, intro);
  roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fillStyle = rgb(col);
  ctx.fill();

  // contents, each living between its click and the next
  const live = (from, to) => clamp(spring(t - from, 'snappy')) * (1 - clamp(spring(t - to + 0.02, 'snappy')));
  const btn = live(c1 + a + 0.05, c2 + a);
  if (btn > 0.01) text('▶  播放', 0, 4, { size: 64, color: C.paper, alpha: btn });
  const ld = live(c2 + a + 0.05, c3 + a);
  if (ld > 0.01) {
    ctx.strokeStyle = rgb(C.paper, ld);
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    const rot = (t - c2) * 9;
    const len = 0.6 + 0.35 * Math.sin((t - c2) * 7);
    ctx.beginPath();
    ctx.arc(0, 0, 80, rot, rot + len * Math.PI * 1.5);
    ctx.stroke();
  }
  const ch = clamp(spring(t - c3 - a - 0.08, 'snappy'));
  if (ch > 0.01) {
    const vals = [0.32, 0.5, 0.42, 0.68, 0.81, 1.0];
    const bw = 78, gap = 34, base = 210;
    const x0 = -((bw + gap) * vals.length - gap) / 2;
    vals.forEach((v, i) => {
      const hb = 330 * v * spring(t - c3 - 0.12 - i * 0.05, 'playful');
      roundRect(x0 + i * (bw + gap), base - hb, bw, hb, 14);
      ctx.fillStyle = rgb(i === vals.length - 1 ? C.orange : C.paper, ch * (i === vals.length - 1 ? 1 : 0.85));
      ctx.fill();
    });
    text('+312%', x0, -215, { size: 76, font: MONO, weight: 700, color: C.paper, alpha: ch, align: 'left' });
    text('本周', -x0, -215, { size: 40, color: C.paper, alpha: ch * 0.6, align: 'right' });
  }
  ctx.restore();

  // cursor glides to each target just before its click
  const tgt = [[cx + 30, cy + 20], [cx + 40, cy + 30], [cx + 260, cy + 90]];
  const ckeys = (ax) => [{ t: 0, v: ax === 0 ? 1000 : 1700 }, ...tgt.map((p, i) => ({ t: MORPH_CLICKS[i] - 0.3, v: p[ax] }))];
  const px = track(t, ckeys(0), 'default');
  const py = track(t, ckeys(1), 'default');
  const press = MORPH_CLICKS.reduce((m, c) => m * (1 - 0.18 * Math.exp(-Math.pow((t - c) / 0.05, 2))), 1);
  cursor(px, py, press);
  caption('一个形状 · 从不切镜', C.ink, lt, 1360);
  timecode(t, C.ink);
}

// ---------- 4. words ----------
const WORDS = [
  { bg: C.orange, fg: C.ink, cn: '弹簧', en: 'SPRING' },
  { bg: C.blue, fg: C.paper, cn: '节拍', en: 'BEAT' },
  { bg: C.paper, fg: C.ink, cn: '镜头', en: 'CAMERA' },
  { bg: C.ink, fg: C.orange, cn: '声音', en: 'SOUND' },
];
function words(lt, t) {
  let i = 0;
  while (i < WORD_HITS.length - 1 && t >= WORD_HITS[i + 1]) i++;
  const w = WORDS[i];
  const wt = t - WORD_HITS[i];
  bg(w.bg);
  // ring expanding from the hit
  const ring = easeOutCubic(clamp(wt / 0.5));
  ctx.strokeStyle = rgb(w.fg, 0.18 * (1 - ring));
  ctx.lineWidth = 40 * (1 - ring) + 2;
  ctx.beginPath();
  ctx.arc(DW / 2, 900, 200 + ring * 700, 0, TAU);
  ctx.stroke();

  const s = lerp(1.55, 1, spring(wt, 'heavy'));
  const rot = lerp(-0.12, 0, spring(wt, 'snappy'));
  ctx.save();
  ctx.translate(DW / 2, 900);
  ctx.rotate(rot);
  ctx.scale(s, s);
  text(w.cn, 0, 0, { size: 300, color: w.fg, weight: 600 });
  ctx.restore();
  const e = spring(wt - 0.08, 'snappy');
  text(w.en, DW / 2 + (1 - e) * 120, 1180, { size: 58, font: MONO, weight: 700, color: w.fg, alpha: clamp(e), spacing: 18 });
  text(`0${i + 1} / 04`, DW / 2, 640, { size: 34, font: MONO, weight: 500, color: w.fg, alpha: 0.6 });
  timecode(t, w.fg);
}

// ---------- 5. iso ----------
function iso(lt, t) {
  bg(C.ink2);
  const N = 9, a = 64;
  const cos30 = Math.cos(Math.PI / 6);
  const zoom = lerp(0.96, 1.06, easeInOutCubic(lt / 2));
  const ox = DW / 2, oy = 520;
  const ph = beat.phase(t);
  const blocks = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) blocks.push([i, j]);
  blocks.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  ctx.save();
  ctx.translate(DW / 2, 960);
  ctx.scale(zoom, zoom);
  ctx.translate(-DW / 2, -960);
  for (const [i, j] of blocks) {
    const ci = i - (N - 1) / 2, cj = j - (N - 1) / 2;
    const d = Math.hypot(ci, cj);
    const rise = spring(lt - (i + j) * 0.03, 'playful');
    const ripple = Math.exp(-Math.pow(d - ph * 7, 2) * 0.8) * (1 - ph);
    const hgt = (30 + 70 * (0.5 + 0.5 * Math.sin(i * 0.8 + j * 0.5 + lt * 4)) + 190 * ripple) * rise;
    const x = ox + (i - j) * a * cos30;
    const y = oy + (i + j) * a * 0.5 + 280;
    const heat = clamp(hgt / 260);
    const top = mixColor(C.paper, C.orange, heat);
    // left face
    ctx.beginPath();
    ctx.moveTo(x - a * cos30, y - hgt); ctx.lineTo(x, y + a * 0.5 - hgt); ctx.lineTo(x, y + a * 0.5); ctx.lineTo(x - a * cos30, y);
    ctx.closePath();
    ctx.fillStyle = rgb(mixColor(top, C.ink, 0.45));
    ctx.fill();
    // right face
    ctx.beginPath();
    ctx.moveTo(x + a * cos30, y - hgt); ctx.lineTo(x, y + a * 0.5 - hgt); ctx.lineTo(x, y + a * 0.5); ctx.lineTo(x + a * cos30, y);
    ctx.closePath();
    ctx.fillStyle = rgb(mixColor(top, C.ink, 0.65));
    ctx.fill();
    // top
    ctx.beginPath();
    ctx.moveTo(x, y - a * 0.5 - hgt); ctx.lineTo(x + a * cos30, y - hgt); ctx.lineTo(x, y + a * 0.5 - hgt); ctx.lineTo(x - a * cos30, y - hgt);
    ctx.closePath();
    ctx.fillStyle = rgb(top);
    ctx.fill();
  }
  ctx.restore();
  caption('81 个方块 · 等轴测', C.paper, lt, 1500);
  timecode(t, C.paper);
}

// ---------- 6. waves ----------
function waves(lt, t) {
  bg(C.ink);
  const L = 34, x0 = 150, x1 = DW - 150, top = 560, gap = 26;
  const kickP = beat.pulse(t, 6);
  for (let l = 0; l < L; l++) {
    const yb = top + l * gap;
    const draw = easeOutCubic(clamp((lt - l * 0.012) / 0.45));
    if (draw <= 0) continue;
    const xe = lerp(x0, x1, draw);
    const pts = [];
    for (let x = x0; x <= xe; x += 5) {
      const u = (x - DW / 2) / 170;
      const env = Math.exp(-u * u);
      const n = Math.sin(x * 0.045 + l * 1.7 + lt * 6) * 0.5 + Math.sin(x * 0.11 - l * 2.3 + lt * 3.1) * 0.3 + Math.sin(x * 0.021 + l * 0.9) * 0.4;
      const amp = env * (40 + 110 * kickP * (0.6 + 0.4 * Math.sin(l * 0.7))) * (0.6 + 0.4 * n);
      pts.push([x, yb - Math.max(0, amp)]);
    }
    // fill below the ridge to hide the lines behind it, then stroke only the ridge
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineTo(pts[pts.length - 1][0], yb + 40);
    ctx.lineTo(x0, yb + 40);
    ctx.closePath();
    ctx.fillStyle = rgb(C.ink);
    ctx.fill();
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = rgb(l === 21 ? C.orange : C.paper, l === 21 ? 1 : 0.92);
    ctx.lineWidth = l === 21 ? 4 : 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  // mask the bottom closing edges of the last ridge
  ctx.fillStyle = rgb(C.ink);
  ctx.fillRect(0, top + L * gap - gap + 3, DW, 60);
  caption('34 条波形 · 跟着鼓点跳', C.paper, lt, 1560);
  timecode(t, C.paper);
}

// ---------- 7. tunnel ----------
function tunnel(lt, t) {
  bg(C.ink);
  const n = 26, spacing = 120, depth = n * spacing, f = 520;
  const travel = 900 * lt + 700 * lt * lt;
  const cx = DW / 2, cy = 900;
  const items = [];
  for (let k = 0; k < n; k++) {
    let z = (k * spacing - travel) % depth;
    if (z < 0) z += depth;
    z += 40;
    items.push({ k: k + Math.floor((travel + k * spacing) / depth) * n, z });
  }
  items.sort((p, q) => q.z - p.z);
  for (const it of items) {
    const sc = f / it.z;
    const size = 520 * sc;
    const alpha = clamp(1 - it.z / depth) * clamp((it.z - 40) / 80);
    const cols = [C.orange, C.paper, C.blue];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(it.k * 0.16 + lt * 0.9);
    ctx.strokeStyle = rgb(cols[((it.k % 3) + 3) % 3], alpha);
    ctx.lineWidth = Math.max(1, 6 * sc);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  text(`t = ${t.toFixed(2)}`, cx, cy, { size: 64, font: MONO, weight: 700, color: C.paper });
  const flash = easeInCubic(invLerp(1.55, 2.0, lt));
  if (flash > 0) {
    ctx.fillStyle = rgb(C.paper, flash);
    ctx.fillRect(0, 0, DW, DH);
  }
  timecode(t, C.paper);
}

// ---------- 8. end card ----------
function endCard(lt, t) {
  bg(C.paper);
  springLine('全程', DW / 2, 720, 14.05, t, { size: 170, color: C.ink, preset: 'heavy', rise: 80 });
  springLine('代码生成', DW / 2, 910, 14.15, t, { size: 170, color: C.ink, preset: 'heavy', rise: 80 });
  const rule = spring(lt - 0.4, 'default');
  ctx.fillStyle = rgb(C.ink);
  ctx.fillRect(DW / 2 - 330 * clamp(rule), 1040, 660 * clamp(rule), 4);
  const brand = spring(lt - 0.5, 'snappy');
  text('Claude Opus 5.5', DW / 2, 1120 + (1 - brand) * 30, { size: 56, font: MONO, weight: 700, color: C.orange, alpha: clamp(brand) });
  const pipe = 'seek(t) → Playwright → ffmpeg';
  const typed = Math.floor(clamp((lt - 0.75) / 0.6) * [...pipe].length);
  const caret = Math.floor(t * 4) % 2 ? '▍' : ' ';
  text([...pipe].slice(0, typed).join('') + (lt > 0.7 ? caret : ''), DW / 2, 1210, { size: 38, font: MONO, weight: 500, color: C.ink, alpha: 0.7 });
  caption('没有剪辑软件 · 没有素材 · 只有代码', C.ink, lt - 1.0, 1330);
  // flash carried over from the tunnel cut
  const flash = 1 - easeOutCubic(clamp(lt / 0.35));
  if (flash > 0) {
    ctx.fillStyle = rgb([255, 255, 255], flash);
    ctx.fillRect(0, 0, DW, DH);
  }
  timecode(t, C.ink);
}

const DRAW = { hook, particles: particlesScene, morph, words, iso, waves, tunnel, end: endCard };

window.VIDEO = { duration: DURATION, bpm: BPM };
window.seek = (t) => {
  t = clamp(t, 0, DURATION - 1e-6);
  const sec = SECTIONS.find((s) => t >= s.start && t < s.end) || SECTIONS[SECTIONS.length - 1];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  DRAW[sec.id](t - sec.start, t);
  drawGrain(t);
};

await document.fonts.ready;
buildParticles();
window.seek(0);
window.ready = true;
