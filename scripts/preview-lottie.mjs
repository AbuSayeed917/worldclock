/**
 * Renders Lottie files to a PNG contact sheet so they can actually be looked at.
 *
 * This is the piece that makes evaluating a downloaded animation safe: it loads
 * each file in a real browser with the real player, samples frames across the
 * loop, and reports whether anything was drawn. A file that loads without error
 * and paints nothing — the commonest silent failure in this format — shows up
 * here as an empty strip and a zero bounding box.
 *
 *   node scripts/preview-lottie.mjs public/lottie/*.json
 *   node scripts/preview-lottie.mjs --url https://example.com/anim.json
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.PREVIEW_DIR ?? join(ROOT, '.shots/lottie');
mkdirSync(OUT, { recursive: true });

const FRAMES = 5; // samples across one loop
const CELL = 320;

const args = process.argv.slice(2);
const urls = [];
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') urls.push(args[++i]);
  else files.push(args[i]);
}

if (!files.length && !urls.length) {
  console.error('usage: node scripts/preview-lottie.mjs <file.json...> [--url <url>]');
  process.exit(1);
}

/** Load each candidate as raw JSON, whether local or remote. */
const items = [];
for (const f of files) {
  if (!existsSync(f)) {
    console.error(`missing: ${f}`);
    continue;
  }
  items.push({ name: basename(f), data: JSON.parse(readFileSync(f, 'utf8')) });
}
for (const u of urls) {
  const res = await fetch(u);
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${u}`);
    continue;
  }
  items.push({ name: u.split('/').pop() ?? u, data: await res.json(), source: u });
}

const player = readFileSync(
  join(ROOT, 'node_modules/lottie-web/build/player/lottie.min.js'),
  'utf8',
);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: CELL * FRAMES, height: CELL },
  deviceScaleFactor: 1,
});

// A checkerboard makes transparent regions obvious, so a "blank" render is not
// mistaken for a white background.
await page.setContent(`
  <style>
    html,body{margin:0;background:#151823}
    #row{display:flex}
    .cell{width:${CELL}px;height:${CELL}px;
      background-image:
        linear-gradient(45deg,#232838 25%,transparent 25%),
        linear-gradient(-45deg,#232838 25%,transparent 25%),
        linear-gradient(45deg,transparent 75%,#232838 75%),
        linear-gradient(-45deg,transparent 75%,#232838 75%);
      background-size:16px 16px;
      background-position:0 0,0 8px,8px -8px,-8px 0;}
    .cell svg{width:100%;height:100%}
  </style>
  <div id="row"></div>
`);
await page.addScriptTag({ content: player });

console.log(`\nrendering ${items.length} animation(s) → ${OUT}\n`);

const report = [];

for (const item of items) {
  const info = await page.evaluate(
    async ({ data, frames }) => {
      const row = document.getElementById('row');
      row.replaceChildren();

      const total = (data.op ?? 0) - (data.ip ?? 0);
      const anims = [];

      for (let i = 0; i < frames; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        row.append(cell);

        const anim = window.lottie.loadAnimation({
          container: cell,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: JSON.parse(JSON.stringify(data)),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        // Spread the samples across the loop, avoiding the very last frame
        // which on a looping animation duplicates the first.
        anim.goToAndStop((data.ip ?? 0) + (total * i) / frames, true);
        anims.push(anim);
      }

      await new Promise((r) => setTimeout(r, 400));

      // Measure what was actually painted. A zero-area union across every
      // sampled frame means the animation rendered nothing at all.
      let drawn = 0;
      let maxArea = 0;
      for (const cell of row.children) {
        const svg = cell.querySelector('svg');
        if (!svg) continue;
        let area = 0;
        for (const node of svg.querySelectorAll('path,rect,ellipse,circle,g,image')) {
          const b = node.getBoundingClientRect();
          area = Math.max(area, b.width * b.height);
        }
        if (area > 4) drawn++;
        maxArea = Math.max(maxArea, area);
      }

      return {
        drawn,
        maxArea: Math.round(maxArea),
        w: data.w,
        h: data.h,
        fr: data.fr,
        durationSeconds: +(total / (data.fr || 60)).toFixed(2),
        layers: (data.layers ?? []).length,
        layersMissingOp: (data.layers ?? []).filter((l) => typeof l.op !== 'number').length,
        externalImages: (data.assets ?? []).filter((a) => a.p && !a.e).length,
        embeddedImages: (data.assets ?? []).filter((a) => a.p && a.e).length,
        layerNames: (data.layers ?? []).map((l) => l.nm).filter(Boolean).slice(0, 12),
      };
    },
    { data: item.data, frames: FRAMES },
  );

  const file = join(OUT, `${item.name.replace(/\.json$/, '')}.png`);
  await page.locator('#row').screenshot({ path: file });

  const verdict =
    info.externalImages > 0
      ? 'REJECT — external image refs'
      : info.layersMissingOp > 0
        ? 'REJECT — layers missing out-point'
        : info.drawn === 0
          ? 'REJECT — renders nothing'
          : 'ok';

  report.push({ name: item.name, verdict, ...info, source: item.source });

  console.log(
    `${verdict === 'ok' ? '✓' : '✗'} ${item.name.padEnd(26)} ` +
      `${String(info.w) + 'x' + info.h}`.padEnd(11) +
      `${info.durationSeconds}s`.padEnd(7) +
      `${info.layers} layers`.padEnd(11) +
      `drew ${info.drawn}/${FRAMES}  ${verdict === 'ok' ? '' : verdict}`,
  );
  if (info.layerNames.length) console.log(`    ${info.layerNames.join(' · ')}`);
}

await browser.close();

const bad = report.filter((r) => r.verdict !== 'ok');
console.log(`\ncontact sheets in ${OUT}`);
if (bad.length) {
  console.log(`${bad.length} rejected`);
  process.exitCode = 1;
}
