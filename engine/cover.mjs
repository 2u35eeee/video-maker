// Render a project's static covers (cover.html) at Douyin's cover sizes.
//   node engine/cover.mjs projects/kp-001-birthday
// Output: out/<name>/cover-3x4.png (1080x1440) and cover-4x3.png (1440x1080)
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, ROOT } from './browser.mjs';

const projectDir = path.resolve(process.argv[2] || '.');
const name = path.basename(projectDir);
const outDir = path.join(ROOT, 'out', name);
fs.mkdirSync(outDir, { recursive: true });

const SIZES = { '3x4': [1080, 1440], '4x3': [1440, 1080] };
const { server, origin } = await serve();
const browser = await launch();
for (const [label, [width, height]] of Object.entries(SIZES)) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/${path.relative(ROOT, projectDir)}/cover.html?w=${width}&h=${height}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const file = path.join(outDir, `cover-${label}.png`);
  await page.screenshot({ path: file });
  console.log(`${label}  ${width}x${height}  ${path.relative(ROOT, file)}`);
  await page.close();
}
await browser.close();
server.close();
