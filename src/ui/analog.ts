/**
 * The analog dial.
 *
 * Hands are driven by direct transform writes on each animation frame rather
 * than CSS keyframes. A keyframed rotation would drift out of sync with real
 * time the moment the tab is throttled or the user scrubs the strip; recomputing
 * the angle from the actual instant every frame keeps the dial honest.
 */

import { zonedParts } from '../core/time';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Dial {
  el: SVGSVGElement;
  update(instant: Date, zone: string): void;
}

export interface DialOptions {
  /** Dial diameter in the SVG's own units. Everything scales from this. */
  size?: number;
  /** Draw the full 60-tick railway track rather than 12 hour marks. */
  detailed?: boolean;
}

export function createDial({ size = 100, detailed = true }: DialOptions = {}): Dial {
  const r = size / 2;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'dial');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  // Face
  const face = el('circle', { cx: r, cy: r, r: r - 1, class: 'dial-face' });
  svg.append(face);

  const ticks = el('g', { class: 'dial-ticks' });
  const tickCount = detailed ? 60 : 12;
  for (let i = 0; i < tickCount; i++) {
    const isHour = detailed ? i % 5 === 0 : true;
    const isCardinal = i % (tickCount / 4) === 0;
    const angle = (i / tickCount) * 360;
    const length = isCardinal ? r * 0.17 : isHour ? r * 0.12 : r * 0.06;
    const width = isCardinal ? r * 0.055 : isHour ? r * 0.042 : r * 0.018;
    const outer = r - r * 0.08;

    ticks.append(
      el('rect', {
        x: r - width / 2,
        y: r - outer,
        width,
        height: length,
        rx: width / 2,
        class: isHour ? 'tick tick-hour' : 'tick tick-minute',
        transform: `rotate(${angle} ${r} ${r})`,
      }),
    );
  }
  svg.append(ticks);

  // Hands. Each is a group rotated about the centre so the transform stays a
  // single cheap property write per frame.
  const hourHand = el('g', { class: 'hand hand-hour' });
  hourHand.append(
    el('rect', {
      x: r - r * 0.045,
      y: r - r * 0.52,
      width: r * 0.09,
      height: r * 0.62,
      rx: r * 0.045,
    }),
  );

  const minuteHand = el('g', { class: 'hand hand-minute' });
  minuteHand.append(
    el('rect', {
      x: r - r * 0.032,
      y: r - r * 0.78,
      width: r * 0.064,
      height: r * 0.88,
      rx: r * 0.032,
    }),
  );

  // Swiss railway convention: a counterweight past the pivot balances the sweep.
  const secondHand = el('g', { class: 'hand hand-second' });
  secondHand.append(
    el('rect', {
      x: r - r * 0.014,
      y: r - r * 0.84,
      width: r * 0.028,
      height: r * 1.06,
      rx: r * 0.014,
    }),
    el('circle', { cx: r, cy: r + r * 0.2, r: r * 0.07 }),
  );

  svg.append(hourHand, minuteHand, secondHand);
  svg.append(el('circle', { cx: r, cy: r, r: r * 0.05, class: 'dial-pivot' }));

  function update(instant: Date, zone: string): void {
    const p = zonedParts(instant, zone);
    // Sub-second precision comes from the raw instant: zonedParts floors to the
    // second, so without this the sweep would stutter once per second.
    const ms = instant.getMilliseconds();
    const seconds = p.second + ms / 1000;
    const minutes = p.minute + seconds / 60;
    const hours = (p.hour % 12) + minutes / 60;

    hourHand.setAttribute('transform', `rotate(${hours * 30} ${r} ${r})`);
    minuteHand.setAttribute('transform', `rotate(${minutes * 6} ${r} ${r})`);
    secondHand.setAttribute('transform', `rotate(${seconds * 6} ${r} ${r})`);
  }

  return { el: svg, update };
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}
