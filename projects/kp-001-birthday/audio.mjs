// Narration + a soft music bed that ducks under the voice + cue-locked sound effects.
//   node projects/kp-001-birthday/audio.mjs out.wav
import path from 'node:path';
import { createMix, kick, hat, blip, whoosh, impact, bass, pad, readWav, automate, gain, master, writeWav } from '../../engine/lib/synth.mjs';
import { VO, DURATION, cue } from './vo.js';

const out = process.argv[2] || 'audio.wav';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const voice = gain(readWav(path.join(ROOT, 'out', path.basename(path.dirname(new URL(import.meta.url).pathname)), 'vo.wav'), DURATION), 1.0);
const music = createMix(DURATION);
const fx = createMix(DURATION);

// Music: 96 BPM, light kick + hats, Am–F–C–G pads and an offbeat bass.
const BEAT = 60 / 96;
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ROOTS = [45, 41, 36, 43];
for (let b = 0; b * BEAT < DURATION - 1.5; b++) {
  const t = b * BEAT, bar = Math.floor(b / 4), inBar = b % 4;
  if (b % 4 === 0) pad(music, t, BEAT * 4, CHORDS[bar % 4], 0.9);
  if (t < 0.8) continue;
  if (inBar === 0 || inBar === 2) kick(music, t, 0.45);
  hat(music, t + BEAT / 2, 0.5);
  bass(music, t + BEAT / 2, BEAT * 0.4, ROOTS[bar % 4], 0.55);
}
// Duck the music under speech (smooth 150 ms ramps).
const speaking = (t) => VO.some((l) => t > l.start - 0.15 && t < l.end + 0.15);
const smooth = (t) => {
  let s = 0;
  for (let k = -3; k <= 3; k++) s += speaking(t + k * 0.05) ? 1 : 0;
  return s / 7;
};
automate(music, (t) => 0.55 - 0.33 * smooth(t));

// Sound effects locked to narration cues.
const at = (id) => cue(id).start;
for (let i = 0; i < 23; i++) blip(fx, i * 0.035 + 0.05, 700 + i * 30, 0.35, (i % 5 - 2) * 0.2);
blip(fx, at('question') + 0.25, 1400, 0.8);
blip(fx, at('question') + 0.3, 1870, 0.6);
blip(fx, at('guess') + 0.1, 520, 0.6);
whoosh(fx, at('answer') - 0.12, 0.3, 0.6);
impact(fx, at('number'), 0.7);
whoosh(fx, at('why') - 0.12, 0.3, 0.5);
for (let j = 1; j < 23; j++) blip(fx, at('you') + 0.3 + j * 0.05, 900 + j * 25, 0.18);
whoosh(fx, at('any') - 0.12, 0.3, 0.5);
const pairsSpan = cue('pairs').end - at('pairs');
for (let k = 0; k < 40; k++) blip(fx, at('pairs') + 0.1 + (k / 40) * pairsSpan, 600 + k * 22, 0.12, ((k % 7) - 3) * 0.15);
impact(fx, at('chance'), 0.35);
whoosh(fx, at('sim') - 0.12, 0.3, 0.5);
whoosh(fx, at('fifty') - 0.12, 0.3, 0.5);
blip(fx, at('fifty') + 1.0, 1320, 0.6);
blip(fx, at('seventy') + 0.6, 1760, 0.6);
whoosh(fx, at('outro') - 0.12, 0.35, 0.6);
impact(fx, at('outro'), 0.45);
blip(fx, at('follow') + 0.9, 2100, 0.9);
blip(fx, at('follow') + 0.95, 2800, 0.6);

writeWav(out, master([voice, gain(music, 0.6), gain(fx, 0.55)], { reverb: 0.08, fadeOut: 0.8 }));
