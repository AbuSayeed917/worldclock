/**
 * Screenshot harness for design review.
 *
 * Also collects console errors and failed network requests, because a page that
 * *looks* fine in a screenshot can still be quietly failing to load an asset.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = process.env.SHOT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '.shots');
mkdirSync(OUT, { recursive: true });

const URL_BASE = process.env.BASE ?? 'http://localhost:5173/worldclock/';
const TZ = process.argv[2] || 'Europe/London';
const TAG = process.argv[3] || 'default';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  timezoneId: TZ,
  locale: 'en-GB',
});
const page = await context.newPage();

const errors = [];
const failed = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 });

// Let fonts settle and the Lottie players mount.
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);

await page.screenshot({ path: `${OUT}/${TAG}-hero.png` });

/**
 * Scroll each section into view and shoot the viewport.
 *
 * A fullPage screenshot cannot capture scroll-driven reveals: elements that
 * never entered the viewport stay at their `from` keyframe, which for .reveal is
 * opacity 0. Only a real scroll proves the animation resolves.
 */
const sections = [
  ['strip', '.strip'],
  ['cards', '#cities'],
  ['rail', '.rail'],
  ['converter', '.converter'],
];

for (const [name, selector] of sections) {
  const handle = await page.$(selector);
  if (!handle) continue;
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

// Report what actually rendered, so a blank area in the screenshot is diagnosable.
const report = await page.evaluate(() => {
  const stages = [...document.querySelectorAll('.stage')].map((s) => ({
    cls: s.className,
    svgs: s.querySelectorAll('svg').length,
  }));
  return {
    heroTime: document.querySelector('[data-role="hero-hm"]')?.textContent,
    heroPlace: document.querySelector('[data-role="hero-place"]')?.textContent,
    heroPhase: document.querySelector('[data-role="hero-phase"]')?.textContent,
    sunrise: document.querySelector('[data-role="hero-sunrise"]')?.textContent,
    sunset: document.querySelector('[data-role="hero-sunset"]')?.textContent,
    cards: document.querySelectorAll('.card').length,
    cardOpacity: document.querySelector('.card') ? getComputedStyle(document.querySelector('.card')).opacity : null,
    railStageSvg: document.querySelector('.rail-stage svg') ? getComputedStyle(document.querySelector('.rail-stage svg')).getPropertyValue('width') : null,
    railCards: document.querySelectorAll('.rail-card').length,
    convRows: document.querySelectorAll('.converter-row').length,
    nightPathLen: document.querySelector('.strip-night-fill')?.getAttribute('d')?.length ?? 0,
    pins: document.querySelectorAll('.pin').length,
    landPathLen: document.querySelector('.strip-land')?.getAttribute('d')?.length ?? 0,
    stages,
    skyTop: getComputedStyle(document.documentElement).getPropertyValue('--sky-top').trim(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    docHeight: document.documentElement.scrollHeight,
  };
});

console.log(`\n=== ${TAG} (${TZ}) ===`);
console.log(JSON.stringify(report, null, 2));
console.log('\nconsole errors :', errors.length ? errors.slice(0, 8) : 'none');
console.log('failed requests:', failed.length ? failed.slice(0, 8) : 'none');

await browser.close();
