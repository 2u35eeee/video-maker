// Shared by the picture (scene.js) and the soundtrack (audio.mjs).
// 120 BPM → one beat = 0.5 s, one bar = 2 s. Every cut lands on a bar line.
export const BPM = 120;
export const BEAT = 60 / BPM;
export const DURATION = 16;

export const SECTIONS = [
  { id: 'hook', start: 0, end: 2 },       // "这条视频 / 没有一帧 / 是剪出来的"
  { id: 'particles', start: 2, end: 4 },  // 1600 dots → "seek(t)"
  { id: 'morph', start: 4, end: 6 },      // one shape: dot → button → loader → chart
  { id: 'words', start: 6, end: 8 },      // 弹簧 / 节拍 / 镜头 / 声音
  { id: 'iso', start: 8, end: 10 },       // isometric block field
  { id: 'waves', start: 10, end: 12 },    // stacked waveform ridges
  { id: 'tunnel', start: 12, end: 14 },   // fly-through, riser, white flash
  { id: 'end', start: 14, end: 16 },      // 全程代码生成
];

// Cursor clicks in the morph section (the shape changes right after each).
export const MORPH_CLICKS = [4.35, 4.85, 5.35];
// Hook lines and word slams land on beats.
export const HOOK_LINES = [0.0, 0.5, 1.0];
export const WORD_HITS = [6.0, 6.5, 7.0, 7.5];
