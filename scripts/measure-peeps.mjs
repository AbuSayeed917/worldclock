/**
 * Measures the true ink bounding box of each Open Peeps atom.
 *
 * The viewBox is generous padding from Sketch and says nothing about where the
 * artwork actually sits, so anchoring a head to a collar using viewBox numbers
 * puts the head in the wrong place. getBBox() on the real paths gives the ink
 * extents, which is what the composer needs.
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<div id="host"></div>');

const out = {};

for (const kind of ['pose', 'head', 'face']) {
  out[kind] = {};
  const dir = join(ROOT, 'assets/peeps', kind);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
    const svg = readFileSync(join(dir, file), 'utf8').replace(/<\?xml[^?]*\?>/, '');
    const measured = await page.evaluate((markup) => {
      const host = document.getElementById('host');
      host.innerHTML = markup;
      const el = host.querySelector('svg');
      const vb = el.getAttribute('viewBox').split(/[\s,]+/).map(Number);
      const root = el.querySelector('g') ?? el;
      const b = root.getBBox();

      // Sample the ink's horizontal extent in a thin band at a given height,
      // which is how the collar opening and the neck width get located.
      const bandWidth = (yFraction) => {
        const y = b.y + b.height * yFraction;
        let min = Infinity;
        let max = -Infinity;
        for (const node of el.querySelectorAll('path')) {
          const len = node.getTotalLength();
          const steps = Math.min(1400, Math.max(200, Math.round(len / 6)));
          for (let i = 0; i <= steps; i++) {
            const p = node.getPointAtLength((len * i) / steps);
            if (Math.abs(p.y - y) < b.height * 0.012) {
              min = Math.min(min, p.x);
              max = Math.max(max, p.x);
            }
          }
        }
        return Number.isFinite(min) ? { min: +min.toFixed(1), max: +max.toFixed(1) } : null;
      };

      return {
        viewBox: vb,
        bbox: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) },
        topBand: bandWidth(0.02),
        bottomBand: bandWidth(0.98),
      };
    }, svg);

    out[kind][file.replace(/\.svg$/, '')] = measured;
  }
}

await browser.close();

writeFileSync(join(ROOT, 'assets/peeps/metrics.json'), JSON.stringify(out, null, 2));

for (const [kind, entries] of Object.entries(out)) {
  console.log(`\n=== ${kind} ===`);
  for (const [name, m] of Object.entries(entries)) {
    console.log(
      `${name.padEnd(22)} vb ${String(m.viewBox[2]).padStart(5)}x${String(m.viewBox[3]).padEnd(5)}` +
        ` ink ${String(m.bbox.x).padStart(7)},${String(m.bbox.y).padStart(7)} ` +
        `${String(m.bbox.w).padStart(7)}x${String(m.bbox.h).padEnd(7)}` +
        ` top[${m.topBand ? m.topBand.min + '..' + m.topBand.max : '-'}]`,
    );
  }
}
