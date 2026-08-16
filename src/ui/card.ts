/**
 * One city card.
 *
 * The card owns its own sky. Because the palette comes from that city's solar
 * elevation rather than the viewer's, a 3am Tokyo card sits dark next to a
 * mid-afternoon Los Angeles card — the grid reads as a row of windows onto
 * different parts of the planet, which is the whole point of a world clock.
 */

import type { City } from '../data/cities';
import { createDial } from './analog';
import { createCardSky } from './cardsky';
import { createStage, type Stage } from './lottie-stage';
import { conditionFor, sourceFor, labelFor, type SkyCondition } from './weather';
import { solarSnapshot, skyPhase, PHASE_LABEL } from '../core/solar';
import {
  zonedParts,
  offsetMinutes,
  formatOffset,
  zoneAbbreviation,
  dayOffset,
  pad2,
} from '../core/time';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Card {
  el: HTMLElement;
  city: City;
  update(instant: Date, homeZone: string): void;
}

export function createCard(city: City, onRemove: (city: City) => void): Card {
  const el = document.createElement('article');
  el.className = 'card reveal';

  el.innerHTML = `
    <div class="card-sky" data-role="sky"></div>
    <div class="card-weather" data-role="weather"></div>
    <div class="card-body">
      <div class="card-head">
        <div>
          <h3 class="card-name">${escapeHtml(city.name)}</h3>
          <p class="card-country">${escapeHtml(city.country)}</p>
        </div>
        <button class="card-remove" type="button" aria-label="Remove ${escapeHtml(city.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4"
                  stroke-linecap="round" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="card-main">
        <p class="card-time">
          <span data-role="hm">--:--</span><small data-role="ss">--</small>
        </p>
        <div class="card-dial" data-role="dial"></div>
      </div>

      <div class="card-arc" data-role="arc"></div>

      <div class="card-meta">
        <span data-role="zone">—</span>
        <span class="card-daymark" data-role="daymark"></span>
        <span class="card-sun">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="13" r="4" fill="currentColor"/>
            <path d="M12 3v3M4 13H1m22 0h-3M5.6 6.6 3.5 4.5m17 2.1 2.1-2.1M2 20h20"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
          <span data-role="suntimes">—</span>
        </span>
      </div>
    </div>
  `;

  const q = <T extends Element = HTMLElement>(role: string): T =>
    el.querySelector<T>(`[data-role="${role}"]`)!;

  const hm = q('hm');
  const ss = q('ss');
  const zoneEl = q('zone');
  const daymark = q('daymark');
  const suntimes = q('suntimes');
  const skyHost = q('sky');
  const cardSky = createCardSky(city);
  skyHost.append(cardSky.el);

  // Professional stock Lottie, mounted lazily. Which one is showing is decided
  // by the solar model, so the moon only appears when it is actually dark here.
  let condition: SkyCondition | null = null;
  let weather: Stage | null = null;
  const weatherHost = q('weather');

  const dial = createDial({ size: 100, detailed: false });
  q('dial').append(dial.el);

  const arc = createSunArc();
  q('arc').append(arc.el);

  el.querySelector<HTMLButtonElement>('.card-remove')!.addEventListener('click', () =>
    onRemove(city),
  );

  function update(instant: Date, homeZone: string): void {
    const parts = zonedParts(instant, city.zone);
    hm.textContent = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
    ss.textContent = pad2(parts.second);

    dial.update(instant, city.zone);

    const sun = solarSnapshot(instant, city.lat, city.lon);
    cardSky.update(sun, instant);

    const wanted = conditionFor(city, sun.isDay);
    if (wanted !== condition) {
      condition = wanted;
      if (weather) {
        weather.setSource(sourceFor(wanted), labelFor(wanted));
      } else {
        weather = createStage({ src: sourceFor(wanted), label: labelFor(wanted) });
        weatherHost.append(weather.el);
      }
      weatherHost.title = labelFor(wanted);
    }

    const offset = offsetMinutes(instant, city.zone);
    const abbreviation = zoneAbbreviation(instant, city.zone);
    zoneEl.textContent = `${abbreviation} · ${formatOffset(offset)}`;

    const delta = dayOffset(instant, city.zone, homeZone);
    daymark.textContent = delta === 0 ? '' : delta > 0 ? 'Tomorrow' : 'Yesterday';

    if (sun.sunrise && sun.sunset) {
      const rise = zonedParts(sun.sunrise, city.zone);
      const set = zonedParts(sun.sunset, city.zone);
      suntimes.textContent = `${pad2(rise.hour)}:${pad2(rise.minute)} – ${pad2(set.hour)}:${pad2(set.minute)}`;
      arc.update(sun.sunrise, sun.sunset, instant);
    } else {
      // Inside a polar circle there is no sunrise to show, so name the state.
      suntimes.textContent = sun.isDay ? 'Midnight sun' : 'Polar night';
      arc.setFlat(sun.isDay);
    }

    el.dataset.phase = skyPhase(sun.elevation);
    el.title = `${city.name} — ${PHASE_LABEL[skyPhase(sun.elevation)]}`;
  }

  return { el, city, update };
}

/**
 * The daylight arc: a dotted track from sunrise to sunset with a filled portion
 * showing how much of the day has already gone, and a marker at the sun's
 * current position along it.
 */
interface SunArc {
  el: SVGSVGElement;
  update(sunrise: Date, sunset: Date, now: Date): void;
  setFlat(isDay: boolean): void;
}

function createSunArc(): SunArc {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 34');
  svg.setAttribute('aria-hidden', 'true');

  const ARC = 'M4 30 A 46 30 0 0 1 96 30';

  const horizon = node('line', { x1: 0, y1: 30, x2: 100, y2: 30, class: 'arc-horizon' });
  const track = node('path', { d: ARC, class: 'arc-track' });
  const progress = node('path', { d: ARC, class: 'arc-progress' });
  const marker = node('circle', { r: 3.4, class: 'arc-marker', cx: 4, cy: 30 });

  svg.append(horizon, track, progress, marker);

  // Measuring the path once lets stroke-dashoffset express "fraction of daylight
  // elapsed" directly, with no trigonometry at render time.
  let length = 0;
  const measure = (): number => {
    if (!length) length = progress.getTotalLength() || 1;
    return length;
  };

  function setFraction(fraction: number): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    const total = measure();
    progress.style.strokeDasharray = `${total}`;
    progress.style.strokeDashoffset = `${total * (1 - clamped)}`;

    const point = progress.getPointAtLength(total * clamped);
    marker.setAttribute('cx', String(point.x));
    marker.setAttribute('cy', String(point.y));
    marker.style.opacity = '1';
  }

  function update(sunrise: Date, sunset: Date, now: Date): void {
    const span = sunset.getTime() - sunrise.getTime();
    if (span <= 0) return setFlat(false);
    setFraction((now.getTime() - sunrise.getTime()) / span);
  }

  function setFlat(isDay: boolean): void {
    const total = measure();
    progress.style.strokeDasharray = `${total}`;
    progress.style.strokeDashoffset = isDay ? '0' : `${total}`;
    marker.style.opacity = isDay ? '1' : '0';
    if (isDay) {
      const point = progress.getPointAtLength(total * 0.5);
      marker.setAttribute('cx', String(point.x));
      marker.setAttribute('cy', String(point.y));
    }
  }

  return { el: svg, update, setFlat };
}

function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
