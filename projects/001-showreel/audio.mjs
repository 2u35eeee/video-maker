// Soundtrack for 001-showreel, synthesized on the same timeline as the picture.
//   node projects/001-showreel/audio.mjs out.wav
import { createMix, kick, clap, hat, blip, riser, whoosh, impact, bass, pad, duck, master, writeWav } from '../../engine/lib/synth.mjs';
import { BEAT, DURATION, SECTIONS, MORPH_CLICKS, HOOK_LINES, WORD_HITS } from './timeline.js';

const out = process.argv[2] || 'audio.wav';
const drums = createMix(DURATION);
const music = createMix(DURATION);
const fx = createMix(DURATION);

// A minor: Am – F – C – G, one chord per bar (2 s).
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ROOTS = [45, 41, 36, 43];

const kicks = [];
for (let b = 0; b < DURATION / BEAT; b++) {
  const t = b * BEAT;
  const bar = Math.floor(b / 4);
  const inBar = b % 4;
  const sec = SECTIONS.find((s) => t >= s.start && t < s.end).id;
  if (sec === 'end' && t >= 15) continue; // let the end card breathe
  if (sec === 'hook') {
    // sparse intro: kick only on the hook lines, no drums yet
    continue;
  }
  if (sec === 'tunnel' && t >= 13) {
    // build: 16th-note kicks into the drop
    for (let s = 0; s < 4; s++) { kick(drums, t + s * BEAT / 4, 0.5 + 0.12 * s); }
    continue;
  }
  kick(drums, t); kicks.push(t);
  if (inBar === 1 || inBar === 3) clap(drums, t, 0.9);
  hat(drums, t + BEAT / 2, 1, inBar === 3);
  hat(drums, t + BEAT / 4, 0.45);
  hat(drums, t + (3 * BEAT) / 4, 0.45);
  // offbeat bass
  const root = ROOTS[bar % 4];
  bass(music, t + BEAT / 2, BEAT * 0.45, root + (inBar === 3 ? 12 : 0));
}

// pads under everything but the hook
for (let bar = 0; bar < DURATION / 2; bar++) {
  const t = bar * 2;
  if (t < 2) pad(music, t + 0.25, 1.75, CHORDS[0], 0.55);
  else pad(music, t, 2, CHORDS[bar % 4], 1);
}

// hook: hits on each line, lift into the drop
HOOK_LINES.forEach((t, i) => { kick(drums, t, 0.9); blip(fx, t, [660, 880, 1320][i], 0.9); });
riser(fx, 1.0, 2.0, 0.8);

// cuts: impact on every bar line from the drop, whoosh before each
for (const s of SECTIONS.slice(1)) {
  whoosh(fx, s.start, 0.3, 0.6);
  if (s.id === 'particles' || s.id === 'end') impact(fx, s.start, 1);
}
// morph clicks
MORPH_CLICKS.forEach((t, i) => blip(fx, t, [1800, 1500, 2100][i], 1, 0.3));
// word slams
WORD_HITS.forEach((t) => impact(fx, t, 0.35));
// tunnel riser into the end card
riser(fx, 12, 14, 1.1);
// end card: final chord stab
pad(music, 14, 2, [57, 60, 64, 69], 1.3);

duck(music, kicks, 0.55);
writeWav(out, master([drums, music, fx], { reverb: 0.22, fadeOut: 0.6 }));
