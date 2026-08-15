/**
 * The terminator strip — the page's signature instrument.
 *
 * An equirectangular world band with the live day/night boundary drawn across
 * it. Because the boundary is a great circle, projecting it onto this map traces
 * a wave whose amplitude is the sun's declination, so the shape itself tells you
 * the season while its position tells you the hour.
 *
 * Dragging the map scrubs time. Every pinned clock on the page follows, which is
 * what turns a pretty picture into a meeting planner: drag until the cities you
 * care about are all on the lit side.
 */

import { WORLD_PATH } from '../data/worldpath';
import { terminatorLatitude, isLitAt, solarSnapshot } from '../core/solar';
import { zonedParts, pad2 } from '../core/time';
import type { City } from '../data/cities';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Latitude window. Cropping the empty polar caps gives a band, not a square. */
const VIEW_TOP = 12; // y for +78° latitude
const VIEW_HEIGHT = 148; // down to −58°

/** How far the boundary is sampled. Two degrees is under a pixel at full width. */
const SAMPLE_STEP = 2;

export interface Terminator {
  el: HTMLElement;
  setCities(cities: City[]): void;
  update(instant: Date): void;
}

export interface TerminatorOptions {
  /** Called with a delta in minutes as the user drags the map. */
  onScrub(deltaMinutes: number): void;
  /** Called when the user releases, so the host can settle state. */
  onScrubEnd(): void;
  onSelect?(city: City): void;
}

export function createTerminator(options: TerminatorOptions): Terminator {
  const root = document.createElement('figure');
  root.className = 'strip';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 ${VIEW_TOP} 360 ${VIEW_HEIGHT}`);
  svg.setAttribute('class', 'strip-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    'World map showing which regions are in daylight and which are in darkness',
  );

  svg.append(buildDefs());

  const ocean = svgEl('rect', {
    x: 0,
    y: -20,
    width: 360,
    height: 220,
    class: 'strip-ocean',
  });

  const graticule = buildGraticule();

  const land = svgEl('path', { d: WORLD_PATH, class: 'strip-land' });

  const nightFill = svgEl('path', { class: 'strip-night-fill' });
  const nightEdge = svgEl('path', { class: 'strip-night-edge' });

  const sunMark = svgEl('g', { class: 'strip-sun' });
  sunMark.append(
    svgEl('circle', { r: 9, class: 'strip-sun-glow' }),
    svgEl('circle', { r: 2.6, class: 'strip-sun-core' }),
  );

  // The antisolar point: local midnight, directly opposite the sun. Given a
  // halo of its own so it reads as a counterpart to the sun rather than a speck.
  const moonMark = svgEl('g', { class: 'strip-moon' });
  moonMark.append(
    svgEl('circle', { r: 7, class: 'strip-moon-glow' }),
    svgEl('circle', { r: 2.4, class: 'strip-moon-core' }),
  );

  const pins = svgEl('g', { class: 'strip-pins' });

  svg.append(ocean, graticule, land, nightFill, nightEdge, sunMark, moonMark, pins);

  const caption = document.createElement('figcaption');
  caption.className = 'strip-caption';
  caption.innerHTML = `
    <span class="strip-hint">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="strip-hint-icon">
        <path d="M8 5 4 12l4 7M16 5l4 7-4 7" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Drag the map to travel through the day
    </span>
    <span class="strip-readout" data-role="readout"></span>
  `;

  root.append(svg, caption);

  const readout = caption.querySelector<HTMLElement>('[data-role="readout"]')!;

  let cities: City[] = [];
  let pinNodes = new Map<string, { group: SVGGElement; city: City }>();

  function setCities(next: City[]): void {
    cities = next;
    pins.replaceChildren();
    pinNodes = new Map();

    for (const city of cities) {
      const group = svgEl('g', {
        class: 'pin',
        transform: `translate(${lonToX(city.lon)} ${latToY(city.lat)})`,
      });
      group.append(
        svgEl('circle', { r: 5.5, class: 'pin-halo' }),
        svgEl('circle', { r: 2.1, class: 'pin-dot' }),
      );

      const label = svgEl('text', { class: 'pin-label', y: -6.5 });
      label.textContent = city.name;
      group.append(label);

      if (options.onSelect) {
        group.classList.add('pin-interactive');
        group.addEventListener('click', () => options.onSelect?.(city));
      }

      pins.append(group);
      pinNodes.set(city.id, { group, city });
    }
  }

  function update(instant: Date): void {
    const { declination, subsolarLongitude } = solarSnapshot(instant, 0, 0);

    // Trace the boundary west to east, then close the ring over whichever pole
    // is currently in polar night. Getting this backwards inverts day and night,
    // which is why the pole is chosen from the declination's sign rather than
    // assumed.
    const southIsDark = declination > 0;
    const closeY = southIsDark ? 200 : -20;

    const points: string[] = [];
    for (let lon = -180; lon <= 180; lon += SAMPLE_STEP) {
      const lat = terminatorLatitude(lon, declination, subsolarLongitude);
      points.push(`${lonToX(lon).toFixed(2)} ${latToY(lat).toFixed(2)}`);
    }

    const curve = `M${points.join('L')}`;
    nightEdge.setAttribute('d', curve);
    nightFill.setAttribute('d', `${curve}L360 ${closeY}L0 ${closeY}Z`);

    sunMark.setAttribute(
      'transform',
      `translate(${lonToX(subsolarLongitude)} ${latToY(declination)})`,
    );
    // The moon marker stands in for the antisolar point — midnight's meridian.
    moonMark.setAttribute(
      'transform',
      `translate(${lonToX(wrapLongitude(subsolarLongitude + 180))} ${latToY(-declination)})`,
    );

    for (const { group, city } of pinNodes.values()) {
      const lit = isLitAt(city.lat, city.lon, declination, subsolarLongitude);
      group.classList.toggle('pin-lit', lit);
      group.classList.toggle('pin-dark', !lit);
      const p = zonedParts(instant, city.zone);
      const label = group.querySelector('.pin-label');
      if (label) label.textContent = `${city.name} ${pad2(p.hour)}:${pad2(p.minute)}`;
    }

    const utc = zonedParts(instant, 'UTC');
    readout.textContent = `${pad2(utc.hour)}:${pad2(utc.minute)} UTC`;
  }

  attachScrub(svg, options);

  return { el: root, setCities, update };
}

/**
 * Pointer-driven horizontal scrubbing.
 *
 * The full width of the map spans 24 hours, matching the fact that one full
 * rotation of the earth is exactly what the map shows. Pointer capture keeps the
 * drag alive when the cursor leaves the element mid-gesture.
 */
function attachScrub(svg: SVGSVGElement, options: TerminatorOptions): void {
  let dragging = false;
  let lastX = 0;

  svg.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('is-dragging');
  });

  svg.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const width = svg.clientWidth || 1;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    // Dragging right moves the map east, which winds the clock forward.
    options.onScrub((dx / width) * 24 * 60);
  });

  const stop = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    svg.classList.remove('is-dragging');
    options.onScrubEnd();
  };

  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);
}

function buildDefs(): SVGDefsElement {
  const defs = document.createElementNS(SVG_NS, 'defs');

  // A soft gradient across the night mask keeps the boundary from reading as a
  // hard cut — twilight is a band on the real planet, not a line.
  const grad = svgEl('linearGradient', {
    id: 'nightGradient',
    x1: '0',
    y1: '0',
    x2: '0',
    y2: '1',
  });
  grad.append(
    svgEl('stop', { offset: '0', 'stop-color': 'var(--night-edge-tint)', 'stop-opacity': '0.35' }),
    svgEl('stop', { offset: '0.12', 'stop-color': 'var(--night-tint)', 'stop-opacity': '0.82' }),
    svgEl('stop', { offset: '1', 'stop-color': 'var(--night-tint)', 'stop-opacity': '0.92' }),
  );

  const blur = svgEl('filter', {
    id: 'terminatorBlur',
    x: '-10%',
    y: '-40%',
    width: '120%',
    height: '180%',
  });
  blur.append(svgEl('feGaussianBlur', { stdDeviation: '1.6' }));

  defs.append(grad, blur);
  return defs;
}

/** Meridians and parallels — the quiet grid that makes it read as an instrument. */
function buildGraticule(): SVGGElement {
  const group = svgEl('g', { class: 'strip-graticule' });
  for (let lon = -150; lon <= 150; lon += 30) {
    const x = lonToX(lon);
    group.append(svgEl('line', { x1: x, y1: -20, x2: x, y2: 200 }));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = latToY(lat);
    group.append(svgEl('line', { x1: 0, y1: y, x2: 360, y2: y }));
  }
  // The equator earns a heavier weight; it is the one line with a real referent.
  group.append(
    svgEl('line', { x1: 0, y1: latToY(0), x2: 360, y2: latToY(0), class: 'equator' }),
  );
  return group;
}

function lonToX(lon: number): number {
  return lon + 180;
}

function latToY(lat: number): number {
  return 90 - lat;
}

function wrapLongitude(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}
