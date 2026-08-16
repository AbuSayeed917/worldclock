/**
 * Renders harvested animations on the site's real background.
 *
 * A contact sheet on white or a checkerboard flatters everything. The only
 * question that matters is whether a candidate reads on the surface it would
 * actually sit on, so this sheet paints the site's own night and day card
 * colours behind each one.
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, '.shots/harvest');
const OUT = join(ROOT, '.shots');
mkdirSync(OUT, { recursive: true });

const picks = process.argv.slice(2);
const files = picks.length
  ? picks
  : readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).slice(0, 12);

const player = readFileSync(
  join(ROOT, 'node_modules/lottie-web/build/player/lottie.min.js'),
  'utf8',
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });

await page.setContent(`
  <style>
    body{margin:0;background:#0d1020;font:11px ui-monospace,monospace;color:#9aa3b8;
         display:flex;flex-wrap:wrap;gap:12px;padding:14px}
    figure{margin:0;width:328px}
    .pair{display:flex;border-radius:12px;overflow:hidden}
    /* Left half: the night card surface. Right half: the day card surface. */
    .half{width:164px;height:164px;display:grid;place-items:center}
    .night{background:linear-gradient(180deg,#1b1f42,#2a2350)}
    .day{background:linear-gradient(180deg,#5fc4ef,#a9dcf2)}
    .half svg{width:100%;height:100%}
    figcaption{padding-top:5px;text-align:center;font-size:10px;word-break:break-all}
  </style>
  <div id="row" style="display:contents"></div>
`);
await page.addScriptTag({ content: player });

for (const file of files) {
  const name = file.includes('/') ? file : join(DIR, file);
  let data;
  try {
    data = JSON.parse(readFileSync(name, 'utf8'));
  } catch {
    console.error(`skip ${file}`);
    continue;
  }
  await page.evaluate(
    ({ data, label }) => {
      const fig = document.createElement('figure');
      const pair = document.createElement('div');
      pair.className = 'pair';
      for (const cls of ['night', 'day']) {
        const half = document.createElement('div');
        half.className = `half ${cls}`;
        pair.append(half);
        window.lottie.loadAnimation({
          container: half,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: JSON.parse(JSON.stringify(data)),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
      }
      const cap = document.createElement('figcaption');
      cap.textContent = label;
      fig.append(pair, cap);
      document.getElementById('row').append(fig);
    },
    { data, label: file.split('/').pop() },
  );
}

await page.waitForTimeout(2500);
const h = await page.evaluate(() => document.body.scrollHeight);
await page.setViewportSize({ width: 1400, height: Math.min(h + 20, 4000) });
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'audition.png'), fullPage: true });
console.log(`${files.length} candidates → .shots/audition.png`);
await browser.close();
