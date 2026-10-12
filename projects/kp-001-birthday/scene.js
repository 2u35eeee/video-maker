import { clamp, lerp, invLerp, spring, rgb, mixColor, easeOutCubic, easeInOutCubic, rand } from '/engine/lib/motion.js';
import { createStage, PALETTE as C, MONO, TAU, DW, mulberry32 } from '/engine/lib/draw.js';
import { VO, DURATION, cue } from './vo.js';

const st = createStage();
const { ctx, text, springLine, roundRect, richText } = st;

// ---------- the maths (exact, and a real simulation) ----------
const pShared = (n) => {
  let none = 1;
  for (let i = 0; i < n; i++) none *= (365 - i) / 365;
  return 1 - none;
};
const P23 = pShared(23); // 0.5073
const SIMS = 10000;
const simHit = new Uint8Array(SIMS);
{
  const r = mulberry32(20261013);
  for (let s = 0; s < SIMS; s++) {
    const seen = new Uint8Array(365);
    for (let i = 0; i < 23; i++) {
      const d = Math.floor(r() * 365);
      if (seen[d]) simHit[s] = 1;
      seen[d] = 1;
    }
  }
}
const simCum = new Uint32Array(SIMS + 1);
for (let i = 0; i < SIMS; i++) simCum[i + 1] = simCum[i] + simHit[i];

// ---------- timing ----------
const at = (id) => cue(id).start;
const LEAD = 0.12; // cut a touch before the voice
const SECTIONS = [
  { id: 'class', from: 0 },
  { id: 'answer', from: at('answer') - LEAD },
  { id: 'you', from: at('why') - LEAD },
  { id: 'pairs', from: at('any') - LEAD },
  { id: 'sim', from: at('sim') - LEAD },
  { id: 'curve', from: at('fifty') - LEAD },
  { id: 'end', from: at('outro') - LEAD },
];
SECTIONS.forEach((s, i) => (s.to = i < SECTIONS.length - 1 ? SECTIONS[i + 1].from : DURATION));

// ---------- shared pieces ----------
const CY = 820; // visual centre; subtitles live below at y≈1440

function person(x, y, s, color, alpha = 1) {
  if (s <= 0.001) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = rgb(color, alpha);
  ctx.beginPath();
  ctx.arc(0, -22, 17, 0, TAU);
  ctx.fill();
  roundRect(-24, 2, 48, 40, 20);
  ctx.fill();
  ctx.restore();
}

function header(t) {
  text('反直觉数学', 90, 250, { size: 34, color: C.paper, alpha: 0.55, align: 'left', weight: 500, spacing: 4 });
  text('01 · 生日悖论', DW - 90, 250, { size: 34, font: MONO, color: C.orange, alpha: 0.9, align: 'right', weight: 600 });
}

// Subtitles: hold each line until the next starts, pop on entry.
function subtitles(t) {
  let cur = null;
  for (let i = 0; i < VO.length; i++) {
    const next = VO[i + 1];
    if (t >= VO[i].start - 0.08 && (!next || t < next.start - 0.08)) cur = VO[i];
  }
  if (!cur || t > cur.end + 0.9) return;
  const p = spring(t - cur.start + 0.08, 'snappy');
  ctx.save();
  ctx.translate(DW / 2, 1440 + (1 - clamp(p)) * 24);
  const s = lerp(0.92, 1, clamp(p));
  ctx.scale(s, s);
  const { width, size } = richText(cur.sub, 0, -1000, { size: 66, alpha: 0 }); // measure only
  roundRect(-width / 2 - 34, -size * 0.85, width + 68, size * 1.7, 22);
  ctx.fillStyle = rgb(C.ink, 0.72 * clamp(p * 2));
  ctx.fill();
  richText(cur.sub, 0, 2, { size: 66, alpha: clamp(p * 2) });
  ctx.restore();
}

// ---------- 1. a class of 23 ----------
const GRID = (() => {
  const rows = [5, 5, 5, 5, 3], gap = 150, pts = [];
  rows.forEach((n, r) => {
    for (let c = 0; c < n; c++) pts.push([DW / 2 + (c - (n - 1) / 2) * gap, CY - 300 + r * gap]);
  });
  return pts;
})();
const PAIR_A = 6, PAIR_B = 17;

function classScene(t) {
  st.bg(C.ink);
  const t0 = 0, tq = at('question'), tg = at('guess');
  // highlight two people with a dashed arc when the question lands
  const q = spring(t - tq - 0.25, 'snappy');
  GRID.forEach(([x, y], i) => {
    const s = spring(t - t0 - i * 0.035, 'playful');
    const pick = (i === PAIR_A || i === PAIR_B) ? clamp(q) : 0;
    const dim = clamp(q) * (pick ? 0 : 0.55);
    person(x, y, s * (1 + 0.15 * pick), mixColor(C.paper, C.orange, pick), 1 - dim);
  });
  if (q > 0.01) {
    const [ax, ay] = GRID[PAIR_A], [bx, by] = GRID[PAIR_B];
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -t * 60;
    ctx.strokeStyle = rgb(C.orange, clamp(q));
    ctx.lineWidth = 6;
    ctx.beginPath();
    const mx = (ax + bx) / 2 - 260, my = (ay + by) / 2;
    ctx.moveTo(ax - 40, ay);
    ctx.quadraticCurveTo(mx, my, bx - 40, by);
    ctx.stroke();
    ctx.restore();
    const lp = spring(t - tq - 0.45, 'playful');
    ctx.save();
    ctx.translate(mx + 40, my);
    ctx.scale(clamp(lp, 0, 1.2), clamp(lp, 0, 1.2));
    roundRect(-110, -44, 220, 88, 44);
    ctx.fillStyle = rgb(C.orange);
    ctx.fill();
    text('同一天？', 0, 2, { size: 44, color: C.ink });
    ctx.restore();
  }
  // the guess: a grey thought bubble
  const g = spring(t - tg - 0.1, 'playful');
  if (g > 0.01) {
    ctx.save();
    ctx.translate(760, CY - 420);
    ctx.scale(clamp(g, 0, 1.15), clamp(g, 0, 1.15));
    roundRect(-170, -70, 340, 140, 70);
    ctx.fillStyle = rgb(C.grey, 0.95);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-120, 95, 18, 0, TAU);
    ctx.arc(-150, 135, 10, 0, TAU);
    ctx.fill();
    text('很低吧…', 0, 2, { size: 54, color: C.ink });
    ctx.restore();
  }
  header(t);
}

// ---------- 2. the answer ----------
function answerScene(t, lt) {
  st.bg(C.ink);
  const ta = at('answer'), tn = at('number');
  const fill = P23 * spring(t - ta - 0.15, 'heavy');
  const R = 300, cx = DW / 2, cy = CY;
  const intro = spring(lt, 'default');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(intro, intro);
  ctx.lineCap = 'round';
  ctx.lineWidth = 56;
  ctx.strokeStyle = rgb(C.paper, 0.12);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgb(C.orange);
  if (fill > 0.002) { ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * fill); ctx.stroke(); }
  // half-way tick
  ctx.strokeStyle = rgb(C.paper, 0.8);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, R - 44); ctx.lineTo(0, R + 44); ctx.stroke();
  text('50%', 0, R + 86, { size: 34, font: MONO, color: C.paper, alpha: 0.6 });
  const slam = spring(t - tn, 'playful');
  const s = 1 + 0.18 * Math.max(0, 1 - Math.abs(slam - 1) * 4) * (t > tn ? 1 : 0);
  ctx.scale(s, s);
  text(`${(fill * 100).toFixed(1)}%`, 0, 6, { size: 150, font: MONO, weight: 700, color: t > tn ? C.orange : C.paper });
  text('至少两人同一天生日', 0, 110, { size: 38, color: C.paper, alpha: 0.6 });
  ctx.restore();
  header(t);
}

// ---------- 3 & 4. the ring of 23 ----------
const RING = Array.from({ length: 23 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 23) * TAU;
  return [DW / 2 + Math.cos(a) * 360, CY + 20 + Math.sin(a) * 360];
});
const PAIRS = [];
for (let i = 0; i < 23; i++) for (let j = i + 1; j < 23; j++) PAIRS.push([i, j]);
// draw order for the 253 pairs: shuffled so the web fills evenly
const PAIR_ORDER = PAIRS.map((p, k) => [rand(k * 3.17), p]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function line(a, b, color, alpha, w, k = 1) {
  const [ax, ay] = RING[a], [bx, by] = RING[b];
  ctx.strokeStyle = rgb(color, alpha);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(lerp(ax, bx, k), lerp(ay, by, k));
  ctx.stroke();
}

function ring(t, lt, { youGlow = 1 } = {}) {
  RING.forEach(([x, y], i) => {
    const s = spring(lt - i * 0.02, 'playful');
    person(x, y, s * (i === 0 ? 1.25 : 1), i === 0 ? mixColor(C.paper, C.orange, youGlow) : C.paper);
  });
  if (youGlow > 0.01) {
    const [x, y] = RING[0];
    text('你', x, y - 78, { size: 44, color: C.orange, alpha: youGlow });
  }
}

function youScene(t, lt) {
  st.bg(C.ink);
  const ty = at('you'), tl = at('you-low');
  // 22 lines from "you"
  for (let j = 1; j < 23; j++) {
    const k = easeOutCubic(clamp((t - ty - 0.3 - j * 0.05) / 0.35));
    if (k > 0) line(0, j, C.orange, 0.85, 4, k);
  }
  ring(t, lt);
  const c = spring(t - ty - 0.6, 'snappy');
  if (c > 0.01) text(`${Math.round(22 * clamp(c))} 次机会`, DW / 2, CY + 20, { size: 64, color: C.paper, alpha: clamp(c) });
  const l = spring(t - tl - 0.2, 'snappy');
  if (l > 0.01) {
    const v = (1 - Math.pow(364 / 365, 22)) * 100 * clamp(l);
    text(`≈ ${v.toFixed(1)}%`, DW / 2, CY + 110, { size: 54, font: MONO, weight: 700, color: C.grey, alpha: clamp(l) });
  }
  header(t);
}

function pairsScene(t, lt) {
  st.bg(C.ink);
  const tp = at('pairs'), tc = at('chance');
  const youFade = 1 - clamp(spring(lt, 'default'));
  // your 22 lines fade back while the full web draws in
  for (let j = 1; j < 23; j++) line(0, j, C.orange, 0.85 * youFade, 4);
  const span = cue('pairs').end - tp; // draw all 253 while the line is spoken
  const drawn = clamp((t - tp - 0.1) / span) * PAIRS.length;
  PAIR_ORDER.forEach((p, k) => {
    const kk = clamp(drawn - k);
    if (kk <= 0) return;
    // after "每一对都可能撞上", random pairs flash
    const flash = t > tc ? Math.pow(Math.max(0, Math.sin((t - tc) * 9 + k * 1.7)), 30) : 0;
    line(p[0], p[1], mixColor(C.paper, C.orange, flash), 0.22 + 0.7 * flash, 1.6 + 3 * flash, easeOutCubic(kk));
  });
  ring(t, lt + 10, { youGlow: youFade });
  const n = Math.round(clamp((t - tp - 0.1) / span) * 253);
  if (t > tp) {
    ctx.save();
    roundRect(DW / 2 - 170, CY - 50, 340, 140, 30);
    ctx.fillStyle = rgb(C.ink, 0.85);
    ctx.fill();
    ctx.restore();
    text(`${n}`, DW / 2 - 20, CY + 22, { size: 104, font: MONO, weight: 700, color: C.orange, align: 'right' });
    text('对', DW / 2 + 10, CY + 30, { size: 56, color: C.paper, align: 'left' });
  }
  header(t);
}

// ---------- 5. ten thousand classes ----------
const COLS = 20, ROWS = 20, CELLS = COLS * ROWS; // each cell = one simulated class
function simScene(t, lt) {
  st.bg(C.ink);
  const ts = at('sim');
  const end = cue('sim-result').end + 0.2;
  const k = easeInOutCubic(clamp((t - ts - 0.4) / (end - ts - 0.4)));
  const shown = k * CELLS;
  const cell = 31, gap = 5, gw = COLS * (cell + gap) - gap;
  const x0 = DW / 2 - gw / 2, y0 = CY - 330;
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / COLS), c = i % COLS;
    const on = clamp(shown - i);
    const hit = simHit[i] === 1;
    const col = on > 0 ? mixColor(C.ink2, hit ? C.orange : C.paper, on) : C.ink2;
    roundRect(x0 + c * (cell + gap), y0 + r * (cell + gap), cell, cell, 8);
    ctx.fillStyle = rgb(col, on > 0 ? (hit ? 1 : 0.3) : 1);
    ctx.fill();
  }
  const done = Math.round(k * SIMS);
  const rate = done ? (simCum[done] / done) * 100 : 0;
  const intro = spring(lt - 0.1, 'snappy');
  text(`已模拟 ${done.toLocaleString('en-US')} 个班`, DW / 2, y0 - 120, { size: 44, color: C.paper, alpha: clamp(intro) * 0.8 });
  text(`${rate.toFixed(1)}%`, DW / 2, y0 - 50, { size: 76, font: MONO, weight: 700, color: C.orange, alpha: clamp(intro) });
  // legend
  const ly = y0 + ROWS * (cell + gap) + 36;
  roundRect(DW / 2 - 300, ly - 14, 28, 28, 6); ctx.fillStyle = rgb(C.orange); ctx.fill();
  text('有人撞生日', DW / 2 - 258, ly, { size: 32, color: C.paper, alpha: 0.75, align: 'left' });
  roundRect(DW / 2 + 60, ly - 14, 28, 28, 6); ctx.fillStyle = rgb(C.paper, 0.3); ctx.fill();
  text('没人撞', DW / 2 + 102, ly, { size: 32, color: C.paper, alpha: 0.75, align: 'left' });
  header(t);
}

// ---------- 6. the curve ----------
const PX0 = 150, PX1 = 950, PY0 = CY + 330, PY1 = CY - 330, NMAX = 80;
const px = (n) => lerp(PX0, PX1, n / NMAX);
const py = (p) => lerp(PY0, PY1, p);
function curveScene(t, lt) {
  st.bg(C.ink);
  const tf = at('fifty'), tv = at('seventy');
  // axes
  ctx.strokeStyle = rgb(C.paper, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PX0, PY1 - 20); ctx.lineTo(PX0, PY0); ctx.lineTo(PX1 + 20, PY0); ctx.stroke();
  [0.5, 1].forEach((p) => {
    ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.moveTo(PX0, py(p)); ctx.lineTo(PX1, py(p)); ctx.stroke();
    ctx.setLineDash([]);
    text(`${p * 100}%`, PX0 - 16, py(p), { size: 28, font: MONO, color: C.paper, alpha: 0.6, align: 'right' });
  });
  [0, 20, 40, 60, 80].forEach((n) => text(`${n}`, px(n), PY0 + 36, { size: 28, font: MONO, color: C.paper, alpha: 0.6 }));
  text('人数', PX1, PY0 + 80, { size: 30, color: C.paper, alpha: 0.6, align: 'right' });
  // curve draws up to 50 during "fifty", then on to 80
  const reach = lt < 0.05 ? 0 : Math.min(NMAX, lerp(0, 50, easeOutCubic(clamp((t - tf) / 1.2))) + lerp(0, 30, easeOutCubic(clamp((t - tv) / 1.0))));
  ctx.strokeStyle = rgb(C.orange);
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let n = 0; n <= reach; n += 0.5) {
    const y = py(pShared(Math.floor(n)) + (pShared(Math.floor(n) + 1) - pShared(Math.floor(n))) * (n % 1));
    n === 0 ? ctx.moveTo(px(n), y) : ctx.lineTo(px(n), y);
  }
  ctx.stroke();
  const mark = (n, label, t0, dx = 0, dy = -70) => {
    const m = spring(t - t0, 'playful');
    if (m <= 0.01 || reach < n) return;
    const x = px(n), y = py(pShared(n));
    ctx.fillStyle = rgb(C.paper);
    ctx.beginPath(); ctx.arc(x, y, 12 * clamp(m, 0, 1.3), 0, TAU); ctx.fill();
    ctx.strokeStyle = rgb(C.paper, 0.4); ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, PY0); ctx.stroke(); ctx.setLineDash([]);
    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.scale(clamp(m, 0, 1.15), clamp(m, 0, 1.15));
    text(label, 0, 0, { size: 46, font: MONO, weight: 700, color: C.paper });
    ctx.restore();
  };
  mark(23, '23人 50.7%', tf + 0.2, 150, 10);
  mark(50, '50人 97%', tf + 1.0, -30, 100);
  mark(70, '70人 99.9%', tv + 0.6, -10, 190);
  header(t);
}

// ---------- 7. end ----------
function endScene(t, lt) {
  st.bg(C.paper);
  const tf = at('follow');
  springLine('23 个人', DW / 2, CY - 160, at('outro'), t, { size: 120, color: C.ink, preset: 'heavy', rise: 60 });
  springLine('50.7%', DW / 2, CY + 10, at('outro') + 0.25, t, { size: 170, color: C.orange, preset: 'heavy', rise: 60, font: MONO, weight: 700 });
  const r = spring(lt - 0.6, 'default');
  ctx.fillStyle = rgb(C.ink);
  ctx.fillRect(DW / 2 - 260 * clamp(r), CY + 130, 520 * clamp(r), 4);
  text('任意两人 · 253 对机会', DW / 2, CY + 200, { size: 40, color: C.ink, alpha: clamp(r) * 0.7 });
  // follow button with a press
  const b = spring(t - tf - 0.1, 'playful');
  if (b > 0.01) {
    const press = 1 - 0.08 * Math.exp(-Math.pow((t - tf - 0.9) / 0.06, 2));
    const done = t > tf + 0.95;
    ctx.save();
    ctx.translate(DW / 2, CY + 360);
    ctx.scale(clamp(b, 0, 1.2) * press, clamp(b, 0, 1.2) * press);
    roundRect(-200, -60, 400, 120, 60);
    ctx.fillStyle = rgb(done ? C.ink : C.orange);
    ctx.fill();
    text(done ? '✓ 已关注' : '+ 关注', 0, 3, { size: 50, color: C.paper });
    ctx.restore();
  }
  text('反直觉数学 · 01', DW / 2, 250, { size: 34, color: C.ink, alpha: 0.5, weight: 500, spacing: 4 });
}

const DRAW = { class: classScene, answer: answerScene, you: youScene, pairs: pairsScene, sim: simScene, curve: curveScene, end: endScene };

window.VIDEO = { duration: DURATION };
window.SIM = { rate: simCum[SIMS] / SIMS, p23: P23 };
window.seek = (t) => {
  t = clamp(t, 0, DURATION - 1e-6);
  const sec = SECTIONS.find((s) => t >= s.from && t < s.to) || SECTIONS[SECTIONS.length - 1];
  st.reset();
  DRAW[sec.id](t, t - sec.from);
  subtitles(t);
  st.drawGrain(t);
};

await document.fonts.ready;
window.seek(0);
window.ready = true;
