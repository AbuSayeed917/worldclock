/**
 * The Today rail — editorial cards about how world time actually works.
 *
 * The artwork is professional Lottie vendored from LottieFiles (see
 * public/lottie/vendor/CREDITS.md). The copy is written to what each animation
 * actually shows, rather than art being dropped behind text that ignores it.
 *
 * Each card is anchored to a real city, so the clock on it is never decorative:
 * the rotation card genuinely shows a city with the sun overhead, and the alarm
 * card shows one that is genuinely at breakfast.
 */

import { CITIES, cityById, type City } from '../data/cities';
import { createStage, type Stage } from './lottie-stage';
import { solarSnapshot } from '../core/solar';
import { zonedParts, pad2 } from '../core/time';

/** How a card decides which city to display alongside its artwork. */
type Anchor =
  | { kind: 'hour'; hour: number }
  | { kind: 'city'; id: string }
  | { kind: 'subsolar' };

interface RailEntry {
  eyebrow: string;
  title: string;
  copy: string;
  animation: string;
  label: string;
  anchor: Anchor;
  gradient: [string, string];
  /** Caption under the live clock, naming why this city is the one shown. */
  note: string;
  /**
   * Visual scale correction. Each vendored file has its own padding inside its
   * viewBox, so the same box renders them at wildly different apparent sizes.
   */
  artScale: number;
}

const ENTRIES: RailEntry[] = [
  {
    eyebrow: 'One rotation',
    title: 'One planet, twenty-four hours',
    copy: 'Every time zone is a slice of the same turn. The Earth rotates fifteen degrees an hour, and the clocks were built to follow it.',
    animation: 'lottie/vendor/rail-earth.json',
    label: 'The Earth turning',
    anchor: { kind: 'subsolar' },
    gradient: ['oklch(0.44 0.13 210)', 'oklch(0.3 0.11 255)'],
    note: 'sun overhead',
    artScale: 1.5,
  },
  {
    eyebrow: 'One reference',
    title: 'Every clock is the same clock',
    copy: 'There is really only one time. A zone is an offset from it, agreed by treaty rather than decided by physics.',
    animation: 'lottie/vendor/rail-clock.json',
    label: 'A clock with turning hands',
    anchor: { kind: 'city', id: 'london' },
    gradient: ['oklch(0.36 0.12 292)', 'oklch(0.24 0.09 268)'],
    note: 'on the prime meridian',
    artScale: 0.82,
  },
  {
    eyebrow: 'Where it comes from',
    title: 'The time arrives from orbit',
    copy: 'UTC is kept by atomic clocks and broadcast from orbit. Your phone checks in constantly and never mentions it.',
    animation: 'lottie/vendor/rail-satellite.json',
    label: 'A satellite in orbit',
    anchor: { kind: 'city', id: 'tokyo' },
    gradient: ['oklch(0.32 0.11 276)', 'oklch(0.2 0.08 262)'],
    note: 'same signal, different offset',
    artScale: 1.35,
  },
  {
    eyebrow: 'Right now',
    title: 'Somewhere an alarm is going off',
    copy: 'Seven in the morning never stops happening. It is simply moving west, at about sixteen hundred kilometres an hour.',
    animation: 'lottie/vendor/rail-alarm.json',
    label: 'An alarm clock ringing',
    anchor: { kind: 'hour', hour: 7 },
    gradient: ['oklch(0.48 0.14 44)', 'oklch(0.33 0.12 350)'],
    note: 'waking up now',
    artScale: 1.1,
  },
];

export interface Rail {
  update(instant: Date): void;
  destroy(): void;
}

export function createRail(root: HTMLElement): Rail {
  const stages: Stage[] = [];
  const cards: Array<{ entry: RailEntry; timeEl: HTMLElement; cityEl: HTMLElement }> = [];

  for (const entry of ENTRIES) {
    const card = document.createElement('article');
    card.className = 'rail-card';
    card.style.setProperty('--card-a', entry.gradient[0]);
    card.style.setProperty('--card-b', entry.gradient[1]);
    card.style.setProperty('--art-scale', String(entry.artScale));

    card.innerHTML = `
      <div>
        <p class="rail-eyebrow">${escapeHtml(entry.eyebrow)}</p>
        <h3 class="rail-title">${escapeHtml(entry.title)}</h3>
        <p class="rail-copy">${escapeHtml(entry.copy)}</p>
      </div>
      <p class="rail-foot">
        <span data-role="city">—</span>
        <span data-role="time">--:--</span>
        <span class="rail-note">${escapeHtml(entry.note)}</span>
      </p>
    `;

    const stage = createStage({
      src: entry.animation,
      label: entry.label,
      // These are square icon-style pieces, so they are fitted whole rather
      // than cropped from the ground up like the illustrated scenes were.
      fit: 'xMidYMid meet',
    });
    stage.el.classList.add('rail-stage');
    card.prepend(stage.el);
    stages.push(stage);

    cards.push({
      entry,
      timeEl: card.querySelector<HTMLElement>('[data-role="time"]')!,
      cityEl: card.querySelector<HTMLElement>('[data-role="city"]')!,
    });

    root.append(card);
  }

  return {
    update(instant: Date): void {
      for (const { entry, timeEl, cityEl } of cards) {
        const city = resolveAnchor(entry.anchor, instant);
        const p = zonedParts(instant, city.zone);
        cityEl.textContent = city.name;
        timeEl.textContent = `${pad2(p.hour)}:${pad2(p.minute)}`;
      }
    },
    destroy(): void {
      for (const stage of stages) stage.destroy();
    },
  };
}

function resolveAnchor(anchor: Anchor, instant: Date): City {
  switch (anchor.kind) {
    case 'city':
      return cityById(anchor.id) ?? CITIES[0];
    case 'hour':
      return cityNearestLocalHour(anchor.hour, instant);
    case 'subsolar':
      return citySunHighest(instant);
  }
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

/** The city with the sun closest to directly overhead right now. */
function citySunHighest(instant: Date): City {
  let best = CITIES[0];
  let highest = -Infinity;
  for (const city of CITIES) {
    const { elevation } = solarSnapshot(instant, city.lat, city.lon);
    if (elevation > highest) {
      highest = elevation;
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
