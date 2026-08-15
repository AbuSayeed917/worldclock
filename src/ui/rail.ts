/**
 * The Today rail — full-bleed editorial cards in the App Store mould.
 *
 * Each card is anchored to a real city that is genuinely in that part of its day
 * right now, so the copy is never decorative: if the card says "someone in Tokyo
 * is finishing dinner", the clock on it agrees.
 */

import { CITIES, type City } from '../data/cities';
import { createStage, type Stage } from './lottie-stage';
import { solarSnapshot } from '../core/solar';
import { zonedParts, pad2 } from '../core/time';

interface RailEntry {
  eyebrow: string;
  title: string;
  copy: string;
  animation: string;
  label: string;
  /** Local hour the card is looking for; a city near it gets picked at render. */
  targetHour: number;
  gradient: [string, string];
}

const ENTRIES: RailEntry[] = [
  {
    eyebrow: 'First light',
    title: 'Someone is just getting up',
    copy: 'Sunrise is rolling west at about 1,600 kilometres an hour. It has just reached here.',
    animation: 'lottie/dawn.json',
    label: 'A person stretching as the sun rises',
    targetHour: 6,
    gradient: ['oklch(0.52 0.14 42)', 'oklch(0.34 0.11 300)'],
  },
  {
    eyebrow: 'Middle of the day',
    title: 'The sun is directly overhead',
    copy: 'Somewhere along this line the sun sits at its highest point of the day, casting no shadow at all.',
    animation: 'lottie/midday.json',
    label: 'People walking on a bright afternoon',
    targetHour: 13,
    gradient: ['oklch(0.6 0.14 232)', 'oklch(0.44 0.12 200)'],
  },
  {
    eyebrow: 'Last light',
    title: 'The day is handing over',
    copy: 'Sunset is a line moving west at the same speed sunrise is. This is where it has got to.',
    animation: 'lottie/dusk.json',
    label: 'People heading home as the sun sets',
    targetHour: 19,
    gradient: ['oklch(0.46 0.15 32)', 'oklch(0.3 0.12 315)'],
  },
  {
    eyebrow: 'Long after dark',
    title: 'Still working, on the other side',
    copy: 'A third of the planet is asleep while the rest carries on. The map above shows exactly which third.',
    animation: 'lottie/night.json',
    label: 'A person working at a desk at night',
    targetHour: 23,
    gradient: ['oklch(0.3 0.1 285)', 'oklch(0.19 0.07 265)'],
  },
];

export interface Rail {
  update(instant: Date): void;
  destroy(): void;
}

export function createRail(root: HTMLElement): Rail {
  const stages: Stage[] = [];
  const cards: Array<{ entry: RailEntry; city: City; timeEl: HTMLElement }> = [];

  const now = new Date();

  for (const entry of ENTRIES) {
    const city = cityNearestLocalHour(entry.targetHour, now);

    const card = document.createElement('article');
    card.className = 'rail-card';
    card.style.setProperty('--card-a', entry.gradient[0]);
    card.style.setProperty('--card-b', entry.gradient[1]);

    card.innerHTML = `
      <div>
        <p class="rail-eyebrow">${escapeHtml(entry.eyebrow)}</p>
        <h3 class="rail-title">${escapeHtml(entry.title)}</h3>
        <p class="rail-copy">${escapeHtml(entry.copy)}</p>
      </div>
      <p class="rail-foot">
        <span>${escapeHtml(city.name)}</span>
        <span data-role="time">--:--</span>
      </p>
    `;

    const stage = createStage({
      src: entry.animation,
      label: entry.label,
      // Fit inside the card, anchored to the ground line.
      fit: 'xMidYMax meet',
    });
    stage.el.classList.add('rail-stage');
    card.prepend(stage.el);
    stages.push(stage);

    cards.push({
      entry,
      city,
      timeEl: card.querySelector<HTMLElement>('[data-role="time"]')!,
    });

    root.append(card);
  }

  return {
    update(instant: Date): void {
      for (const { city, timeEl } of cards) {
        const p = zonedParts(instant, city.zone);
        timeEl.textContent = `${pad2(p.hour)}:${pad2(p.minute)}`;
      }
    },
    destroy(): void {
      for (const stage of stages) stage.destroy();
    },
  };
}

/**
 * Pick the city whose current local hour is closest to `targetHour`.
 *
 * Hours wrap, so the distance is measured the short way round the clock face —
 * 23:00 and 01:00 are two hours apart, not twenty-two.
 */
function cityNearestLocalHour(targetHour: number, instant: Date): City {
  let best = CITIES[0];
  let bestDistance = Infinity;

  for (const city of CITIES) {
    const parts = zonedParts(instant, city.zone);
    const local = parts.hour + parts.minute / 60;
    const raw = Math.abs(local - targetHour);
    const distance = Math.min(raw, 24 - raw);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = city;
    }
  }

  return best;
}

/** Exposed for the hero: whichever pinned city is deepest into its night. */
export function darkestCity(cities: City[], instant: Date): City | null {
  let best: City | null = null;
  let lowest = Infinity;
  for (const city of cities) {
    const { elevation } = solarSnapshot(instant, city.lat, city.lon);
    if (elevation < lowest) {
      lowest = elevation;
      best = city;
    }
  }
  return best;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
