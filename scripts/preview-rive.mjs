/**
 * Renders .riv files to a PNG contact sheet, the Rive equivalent of
 * preview-lottie.mjs.
 *
 * Rive's web runtime fetches its WebAssembly at load time, so the files have to
 * be served over HTTP rather than opened from disk — a file:// page cannot
 * instantiate the module. A throwaway static server is simpler than wiring up
 * request interception.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.shots');
mkdirSync(OUT, { recursive: true });

const DIR = process.argv[2] ?? '.shots/riv';
const files = readdirSync(join(ROOT, DIR)).filter((f) => f.endsWith('.riv'));
if (!files.length) {
  console.error(`no .riv files in ${DIR}`);
  process.exit(1);
}

const TYPES = {
  '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.riv': 'application/octet-stream', '.html': 'text/html',
};

const server = createServer((req, res) => {
  const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(path)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const CELL = 300;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: CELL * Math.min(files.length, 4), height: CELL * Math.ceil(files.length / 4) + 40 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://localhost:${port}/scripts/_rive_host.html`).catch(() => {});

// The host page is generated inline rather than kept on disk.
await page.setContent(`
  <style>
    body{margin:0;background:#12141c;display:flex;flex-wrap:wrap;
         font:11px ui-monospace,monospace;color:#9aa3b8}
    figure{margin:0;width:${CELL}px}
    canvas{width:${CELL}px;height:${CELL - 26}px;display:block;
           background:linear-gradient(180deg,#1b1f42,#2a2350)}
    figcaption{text-align:center;padding:4px}
  </style><div id="row" style="display:contents"></div>
`);
await page.addScriptTag({ url: `http://localhost:${port}/node_modules/@rive-app/canvas/rive.js` });

const report = await page.evaluate(
  async ({ files, dir, port, cell }) => {
    const rive = window.rive;
    rive.RuntimeLoader.setWasmUrl(`http://localhost:${port}/node_modules/@rive-app/canvas/rive.wasm`);
    const row = document.getElementById('row');
    const out = [];

    for (const f of files) {
      const fig = document.createElement('figure');
      const canvas = document.createElement('canvas');
      canvas.width = cell * 2;
      canvas.height = (cell - 26) * 2;
      const cap = document.createElement('figcaption');
      cap.textContent = f;
      fig.append(canvas, cap);
      row.append(fig);

      const info = await new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        setTimeout(() => finish({ file: f, ok: false, reason: 'timeout' }), 12000);
        try {
          const r = new rive.Rive({
            canvas,
            src: `http://localhost:${port}/${dir}/${f}`,
            autoplay: true,
            onLoad: () => {
              r.resizeDrawingSurfaceToCanvas();
              finish({
                file: f,
                ok: true,
                artboards: r.contents?.artboards?.map((a) => a.name) ?? [],
                animations: r.contents?.artboards?.[0]?.animations ?? [],
                stateMachines: r.contents?.artboards?.[0]?.stateMachines?.map((s) => s.name ?? s) ?? [],
              });
            },
            onLoadError: (e) => finish({ file: f, ok: false, reason: String(e).slice(0, 60) }),
          });
        } catch (e) {
          finish({ file: f, ok: false, reason: String(e.message).slice(0, 60) });
        }
      });
      out.push(info);
    }
    await new Promise((r) => setTimeout(r, 1500));
    return out;
  },
  { files, dir: DIR, port, cell: CELL },
);

await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, 'rive-preview.png'), fullPage: true });

console.log(`\nrendered ${files.length} .riv files\n`);
for (const r of report) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.file.padEnd(24)} ${r.ok
    ? `artboards: ${r.artboards.join(',')} | anims: ${(r.animations||[]).join(',').slice(0,40)} | SM: ${(r.stateMachines||[]).join(',').slice(0,30)}`
    : r.reason}`);
}
if (errors.length) console.log('\npage errors:', errors.slice(0, 4));
console.log(`\ncontact sheet → .shots/rive-preview.png`);

await browser.close();
server.close();
