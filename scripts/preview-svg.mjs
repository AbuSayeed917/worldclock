/**
 * Contact sheet for raw SVG atoms, so their artwork and anchoring can be seen
 * before any conversion work is built on assumptions about them.
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.shots');
mkdirSync(OUT, { recursive: true });

const dir = process.argv[2] ?? 'assets/peeps/pose';
const label = process.argv[3] ?? dir.split('/').pop();

const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.svg'));
const cells = files
  .map((f) => {
    const svg = readFileSync(join(ROOT, dir, f), 'utf8').replace(/<\?xml[^?]*\?>/, '');
    return `<figure><div class="art">${svg}</div><figcaption>${f}</figcaption></figure>`;
  })
  .join('');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.setContent(`
  <style>
    body{margin:0;background:#12141c;font:12px ui-monospace,monospace;color:#9aa3b8;
         display:flex;flex-wrap:wrap;gap:14px;padding:16px}
    figure{margin:0;width:210px}
    /* A light panel: Open Peeps line art is black, so it is invisible on dark. */
    .art{height:230px;background:#f4f1ea;border-radius:10px;display:grid;place-items:center;
         overflow:hidden;padding:8px}
    .art svg{max-width:100%;max-height:100%;width:auto;height:auto}
    figcaption{padding-top:6px;text-align:center;font-size:11px}
  </style>${cells}
`);
await page.waitForTimeout(600);
const h = await page.evaluate(() => document.body.scrollHeight);
await page.setViewportSize({ width: 1500, height: Math.min(h + 20, 4000) });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, `atoms-${label}.png`), fullPage: true });
console.log(`${files.length} atoms → .shots/atoms-${label}.png`);
await browser.close();
