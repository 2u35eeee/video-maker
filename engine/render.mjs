// Render a project to MP4.
//   node engine/render.mjs projects/001-showreel [--format 9x16] [--fps 60] [--from 0] [--to 16]
// The page must expose window.VIDEO = { duration }, window.seek(t) and window.ready = true.
// If the project has audio.mjs, it is run first and its WAV is muxed in.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, openProject, parseArgs, ROOT } from './browser.mjs';

const args = parseArgs(process.argv.slice(2));
const projectDir = path.resolve(args._[0] || '.');
const name = path.basename(projectDir);
const format = args.format || '9x16';
const fps = Number(args.fps || 60);
const outDir = path.join(ROOT, 'out', name);
fs.mkdirSync(outDir, { recursive: true });

const run = (cmd, argv, opts = {}) =>
  new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
    return p;
  });

// 1. Audio
let wav = null;
const audioScript = path.join(projectDir, 'audio.mjs');
if (fs.existsSync(audioScript) && !args['no-audio']) {
  wav = path.join(outDir, 'audio.wav');
  const t0 = Date.now();
  await run(process.execPath, [audioScript, wav]);
  console.log(`audio  ${path.relative(ROOT, wav)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// 2. Frames → ffmpeg
const { server, origin } = await serve();
const browser = await launch();
const { page, video, width, height } = await openProject(browser, origin, projectDir, format);
const from = Number(args.from ?? 0);
const to = Number(args.to ?? video.duration);
const frames = Math.round((to - from) * fps);
const suffix = args.from || args.to ? `-${from}-${to}` : '';
const mp4 = path.join(outDir, `${name}-${format}${suffix}.mp4`);

const ff = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
if (wav) ff.push('-ss', String(from), '-t', String(to - from), '-i', wav);
ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps));
if (wav) ff.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
ff.push('-movflags', '+faststart', mp4);
const enc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
const encDone = new Promise((res, rej) => enc.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed')))));

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const t = from + i / fps;
  await page.evaluate((t) => window.seek(t), t);
  const buf = await page.screenshot({ type: 'png', animations: 'disabled' });
  if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
  if (i % fps === 0 || i === frames - 1) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\rframe ${i + 1}/${frames}  ${el.toFixed(0)}s  eta ${((el / (i + 1)) * (frames - i - 1)).toFixed(0)}s   `);
  }
}
enc.stdin.end();
await encDone;
await browser.close();
server.close();
console.log(`\nvideo  ${path.relative(ROOT, mp4)}  ${width}x${height} ${fps}fps  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
