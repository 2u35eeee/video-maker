// Render still frames + a contact sheet, for reviewing a cut without encoding video.
//   node engine/stills.mjs projects/001-showreel [--every 0.5] [--at 1.2,3.4] [--format 9x16] [--cols 8]
// Output: out/<name>/stills/t=XX.XX.png and out/<name>/contact.png
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, openProject, parseArgs, ROOT } from './browser.mjs';

const args = parseArgs(process.argv.slice(2));
const projectDir = path.resolve(args._[0] || '.');
const name = path.basename(projectDir);
const format = args.format || '9x16';
const dir = path.join(ROOT, 'out', name, 'stills');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const { server, origin } = await serve();
const browser = await launch();
const { page, video } = await openProject(browser, origin, projectDir, format);

let times;
if (args.at) times = String(args.at).split(',').map(Number);
else {
  const every = Number(args.every || 0.5);
  times = [];
  for (let t = every / 2; t < video.duration; t += every) times.push(+t.toFixed(3));
}

for (const [i, t] of times.entries()) {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, '0')}_t=${t.toFixed(2)}.png`) });
}
await browser.close();
server.close();

const cols = Number(args.cols || Math.min(8, times.length));
const rows = Math.ceil(times.length / cols);
const sheet = path.join(ROOT, 'out', name, 'contact.png');
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-pattern_type', 'glob', '-i', path.join(dir, '*.png'),
  '-vf', `format=rgb24,scale=270:-1,tile=${cols}x${rows}:padding=6:color=0x222222`, '-frames:v', '1', sheet], { stdio: 'inherit' });
console.log(`${times.length} stills → ${path.relative(ROOT, dir)}\ncontact → ${path.relative(ROOT, sheet)}`);
