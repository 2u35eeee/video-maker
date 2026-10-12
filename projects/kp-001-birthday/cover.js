// Static covers. Laid out separately per aspect: ?w=1080&h=1440 (3:4) or ?w=1440&h=1080 (4:3).
import { rgb, rand } from '/engine/lib/motion.js';
import { createStage, PALETTE as C, MONO, TAU } from '/engine/lib/draw.js';

const st = createStage();
const { ctx, W, H, text, roundRect } = st;
const portrait = H > W;

function person(x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.arc(0, -22, 17, 0, TAU);
  ctx.fill();
  roundRect(-24, 2, 48, 40, 20);
  ctx.fill();
  ctx.restore();
}

// Ring of 23 with the full 253-pair web faint and "your" 22 lines in orange.
function ring(cx, cy, R, s) {
  const pts = Array.from({ length: 23 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 23) * TAU;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });
  ctx.lineWidth = 1.6 * s;
  for (let i = 1; i < 23; i++) for (let j = i + 1; j < 23; j++) {
    ctx.strokeStyle = rgb(C.paper, 0.13 + 0.08 * rand(i * 31 + j));
    ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[j]); ctx.stroke();
  }
  ctx.lineWidth = 4.5 * s;
  ctx.strokeStyle = rgb(C.orange, 0.9);
  for (let j = 1; j < 23; j++) { ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[j]); ctx.stroke(); }
  pts.forEach(([x, y], i) => person(x, y, (i === 0 ? 1.5 : 1.15) * s, i === 0 ? C.orange : C.paper));
  text('你', pts[0][0], pts[0][1] - 88 * s, { size: 54 * s, color: C.orange, weight: 700 });
}

function tag(x, y, align) {
  text('反直觉数学 01 · 生日悖论', x, y, { size: 34, color: C.paper, alpha: 0.6, weight: 500, spacing: 3, align });
}

function draw() {
  st.bg(C.ink);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // covers draw in raw pixels
  if (portrait) {
    tag(W / 2, 80, 'center');
    text('23 个人里', W / 2, 210, { size: 130, color: C.paper, weight: 700 });
    text('有人同一天生日？', W / 2, 360, { size: 92, color: C.paper, weight: 700 });
    text('50.7%', W / 2, 600, { size: 250, font: MONO, color: C.orange, weight: 800 });
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 720, W, H - 720); ctx.clip();
    ring(W / 2, 1210, 330, 1);
    ctx.restore();
  } else {
    const L = 90;
    tag(L, 110, 'left');
    text('23 个人里', L, 300, { size: 118, color: C.paper, weight: 700, align: 'left' });
    text('有人同一天生日？', L, 440, { size: 84, color: C.paper, weight: 700, align: 'left' });
    text('50.7%', L - 8, 670, { size: 210, font: MONO, color: C.orange, weight: 800, align: 'left' });
    text('比你想的高得多', L, 880, { size: 56, color: C.paper, alpha: 0.7, weight: 600, align: 'left' });
    ring(1110, 590, 280, 0.9);
  }
  st.drawGrain(0, 0.06);
}

window.VIDEO = { duration: 0 };
window.seek = draw;
await document.fonts.ready;
draw();
window.ready = true;
