import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Launch Playwright's Chromium; if its pinned build isn't downloaded, fall back
// to any cached headless shell (or CHROME_PATH) instead of downloading another.
export async function launch() {
  const opts = { args: ['--force-color-profile=srgb', '--hide-scrollbars'] };
  if (process.env.CHROME_PATH) return chromium.launch({ ...opts, executablePath: process.env.CHROME_PATH });
  if (fs.existsSync(chromium.executablePath())) return chromium.launch(opts);
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse() : [];
  for (const d of dirs) {
    for (const sub of fs.readdirSync(path.join(cache, d))) {
      const exe = path.join(cache, d, sub, 'chrome-headless-shell');
      if (fs.existsSync(exe)) return chromium.launch({ ...opts, executablePath: exe });
    }
  }
  throw new Error('No Chromium found. Run `npx playwright install chromium` or set CHROME_PATH.');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };

// Static server rooted at the repo so pages can import /engine/lib/*.js.
export function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

export const FORMATS = { '9x16': [1080, 1920], '1x1': [1080, 1080], '16x9': [1920, 1080] };

// Open a project page sized to the format, wait for window.ready.
export async function openProject(browser, origin, projectDir, format = '9x16') {
  const [width, height] = FORMATS[format];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
  const rel = path.relative(ROOT, path.resolve(projectDir));
  await page.goto(`${origin}/${rel}/index.html?w=${width}&h=${height}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const video = await page.evaluate(() => window.VIDEO);
  return { page, video, width, height };
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}
