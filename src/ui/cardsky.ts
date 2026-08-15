/**
 * The scene behind each city card.
 *
 * This is deliberately not a Lottie. A card scene has to answer to live data —
 * where that city's sun actually is right now — and a canned animation cannot.
 * Twenty cards each running a Lottie player would also cost twenty render loops.
 * So the scene is one small SVG whose few moving parts are driven by CSS, and
 * whose sun, moon, stars and colours are positioned from the solar model.
 *
 * Each city gets its own skyline, generated deterministically from its id, so
 * Tokyo and Reykjavík are not the same silhouette.
 */

import type { City } from '../data/cities';
import type { SolarSnapshot } from '../core/solar';
import { skyPhase } from '../core/solar';
import { skyPalette } from '../core/sky';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Scene coordinate space. Wide and short, like a window. */
const W = 200;
const H = 96;
const HORIZON = 74;

export interface CardSky {
  el: SVGSVGElement;
  update(sun: SolarSnapshot, instant: Date): void;
}

export function createCardSky(city: City): CardSky {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('class', 'sky');
  svg.setAttribute('aria-hidden', 'true');

  const rand = seededRandom(hashString(city.id));

  // --- sky wash -----------------------------------------------------------
  const sky = node('rect', { x: 0, y: 0, width: W, height: H, class: 'sky-wash' });

  // --- stars --------------------------------------------------------------
  const starGroup = node('g', { class: 'sky-stars' });
  for (let i = 0; i < 26; i++) {
    const star = node('circle', {
      cx: +(rand() * W).toFixed(1),
      cy: +(rand() * HORIZON * 0.82).toFixed(1),
      r: +(0.35 + rand() * 0.75).toFixed(2),
      class: 'sky-star',
    });
    // Staggered twinkle, done in CSS so no JavaScript runs per frame.
    star.style.setProperty('--delay', `${(rand() * 6).toFixed(2)}s`);
    starGroup.append(star);
  }

  // --- the body: sun by day, moon by night --------------------------------
  const bodyGroup = node('g', { class: 'sky-body' });
  const glow = node('circle', { r: 13, class: 'sky-glow' });
  const disc = node('circle', { r: 5.2, class: 'sky-disc' });
  // A shadow disc turns the sun into a crescent moon without swapping shapes.
  const shade = node('circle', { r: 4.4, class: 'sky-shade' });
  bodyGroup.append(glow, disc, shade);

  // --- clouds -------------------------------------------------------------
  const cloudGroup = node('g', { class: 'sky-clouds' });
  for (let i = 0; i < 3; i++) {
    const c = node('g', { class: 'sky-cloud' });
    const cx = rand() * W;
    const cy = 12 + rand() * 30;
    const s = 0.55 + rand() * 0.6;
    c.append(
      node('ellipse', { cx: cx - 7 * s, cy, rx: 7 * s, ry: 4.4 * s }),
      node('ellipse', { cx, cy: cy - 2.4 * s, rx: 9.5 * s, ry: 6 * s }),
      node('ellipse', { cx: cx + 8 * s, cy, rx: 6.5 * s, ry: 4.2 * s }),
      node('rect', { x: cx - 13 * s, y: cy, width: 26 * s, height: 4.6 * s, rx: 2.3 * s }),
    );
    c.style.setProperty('--drift', `${(26 + rand() * 34).toFixed(0)}s`);
    c.style.setProperty('--delay', `${(-rand() * 30).toFixed(1)}s`);
    cloudGroup.append(c);
  }

  // --- skyline, unique per city ------------------------------------------
  const skyline = node('path', { d: buildSkyline(rand), class: 'sky-skyline' });
  const windows = node('g', { class: 'sky-windows' });
  buildWindows(rand).forEach((w) => windows.append(w));

  const ground = node('rect', {
    x: 0, y: HORIZON, width: W, height: H - HORIZON, class: 'sky-ground',
  });

  svg.append(sky, starGroup, bodyGroup, cloudGroup, skyline, windows, ground);

  function update(sun: SolarSnapshot, instant: Date): void {
    const palette = skyPalette(sun.elevation);
    const phase = skyPhase(sun.elevation);

    svg.style.setProperty('--card-top', palette.top);
    svg.style.setProperty('--card-mid', palette.mid);
    svg.style.setProperty('--card-low', palette.low);
    svg.style.setProperty('--card-glow', palette.glow);
    svg.style.setProperty('--card-star', palette.starOpacity.toFixed(3));
    svg.dataset.phase = phase;
    svg.setAttribute('data-phase', phase);

    // Position the sun or moon along an arc that mirrors the real day.
    //
    // By day the fraction comes from how far through daylight the city is. By
    // night it comes from how far through the dark, so the moon tracks across
    // instead of sitting still — the detail that makes the scene feel live.
    let fraction: number;
    let isDay = sun.isDay;

    if (sun.sunrise && sun.sunset) {
      const rise = sun.sunrise.getTime();
      const set = sun.sunset.getTime();
      const now = instant.getTime();
      if (isDay && set > rise) {
        fraction = (now - rise) / (set - rise);
      } else {
        // Night wraps around midnight; measure against the night's own length.
        const nightLength = 86_400_000 - (set - rise);
        const since = now > set ? now - set : now - (set - 86_400_000);
        fraction = nightLength > 0 ? since / nightLength : 0.5;
      }
    } else {
      // Polar day or polar night: park the body mid-arc and let the sky say it.
      fraction = 0.5;
      isDay = sun.isDay;
    }

    fraction = Math.min(1, Math.max(0, fraction));

    // A shallow arc reads better than a true semicircle in a short scene.
    const x = 14 + fraction * (W - 28);
    const y = HORIZON - 6 - Math.sin(fraction * Math.PI) * 42;

    bodyGroup.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    svg.classList.toggle('is-day', isDay);
    svg.classList.toggle('is-night', !isDay);
  }

  return { el: svg, update };
}

/** A deterministic skyline silhouette as a single filled path. */
function buildSkyline(rand: () => number): string {
  const parts: string[] = [`M0 ${H}`, `L0 ${HORIZON}`];
  let x = 0;
  while (x < W) {
    const w = 8 + rand() * 18;
    const h = 6 + rand() * 26;
    const top = HORIZON - h;
    parts.push(`L${x.toFixed(1)} ${top.toFixed(1)}`);
    parts.push(`L${(x + w).toFixed(1)} ${top.toFixed(1)}`);
    x += w;
    // The occasional spire keeps the roofline from reading as a bar chart.
    if (rand() > 0.86) {
      parts.push(`L${(x - w / 2).toFixed(1)} ${(top - 8 - rand() * 10).toFixed(1)}`);
      parts.push(`L${x.toFixed(1)} ${top.toFixed(1)}`);
    }
  }
  parts.push(`L${W} ${HORIZON}`, `L${W} ${H}`, 'Z');
  return parts.join('');
}

/** Lit windows scattered over the skyline; only visible after dark via CSS. */
function buildWindows(rand: () => number): SVGRectElement[] {
  const out: SVGRectElement[] = [];
  for (let i = 0; i < 42; i++) {
    const w = node('rect', {
      x: +(rand() * W).toFixed(1),
      y: +(HORIZON - 2 - rand() * 22).toFixed(1),
      width: 0.9,
      height: 1.3,
      class: 'sky-window',
    });
    w.style.setProperty('--delay', `${(rand() * 8).toFixed(2)}s`);
    out.push(w);
  }
  return out;
}

/** Stable 32-bit hash so a city's scene is the same on every visit. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
