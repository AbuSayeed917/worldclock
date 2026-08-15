/**
 * Time converter: pick a moment in one city, read it in all the others.
 *
 * The whole feature rests on `zonedTimeToInstant` — turn the chosen wall clock
 * into a real instant once, then every other city is just a formatting of that
 * same instant. Converting zone-to-zone directly would mean juggling two offsets
 * and is where most converters get DST wrong.
 */

import { CITIES, type City } from '../data/cities';
import {
  zonedParts,
  zonedTimeToInstant,
  zoneAbbreviation,
  dayOffset,
  pad2,
} from '../core/time';

export interface Converter {
  setCities(cities: City[]): void;
}

export interface ConverterOptions {
  root: HTMLElement;
  initialCityId: string;
}

export function createConverter({ root, initialCityId }: ConverterOptions): Converter {
  const citySelect = root.querySelector<HTMLSelectElement>('[data-role="conv-city"]')!;
  const timeInput = root.querySelector<HTMLInputElement>('[data-role="conv-time"]')!;
  const dateInput = root.querySelector<HTMLInputElement>('[data-role="conv-date"]')!;
  const list = root.querySelector<HTMLUListElement>('[data-role="conv-list"]')!;

  let pinned: City[] = [];

  for (const city of CITIES) {
    const option = document.createElement('option');
    option.value = city.id;
    option.textContent = `${city.name}, ${city.country}`;
    citySelect.append(option);
  }
  citySelect.value = initialCityId;

  // Seed with the next round half-hour — the time somebody scheduling a call
  // would reach for anyway.
  const now = new Date();
  const seed = new Date(now);
  seed.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  timeInput.value = `${pad2(seed.getHours())}:${pad2(seed.getMinutes())}`;
  dateInput.value = `${seed.getFullYear()}-${pad2(seed.getMonth() + 1)}-${pad2(seed.getDate())}`;

  function render(): void {
    const source = CITIES.find((c) => c.id === citySelect.value);
    if (!source) return;

    const [hour, minute] = timeInput.value.split(':').map(Number);
    const [year, month, day] = dateInput.value.split('-').map(Number);
    if ([hour, minute, year, month, day].some((n) => !Number.isFinite(n))) return;

    const instant = zonedTimeToInstant(year, month, day, hour, minute, source.zone);

    // Always include the source city so the reference point stays on screen.
    const rows = [source, ...pinned.filter((c) => c.id !== source.id)];

    list.replaceChildren();
    for (const city of rows) {
      const parts = zonedParts(instant, city.zone);
      const delta = dayOffset(instant, city.zone, source.zone);

      const item = document.createElement('li');
      item.className = 'converter-row';
      item.innerHTML = `
        <span>
          <span class="converter-city">${escapeHtml(city.name)}</span>
          <span class="converter-zone"> ${escapeHtml(zoneAbbreviation(instant, city.zone))}</span>
        </span>
        <span class="converter-time">${pad2(parts.hour)}:${pad2(parts.minute)}</span>
        <span class="converter-day">${dayLabel(delta)}</span>
      `;
      list.append(item);
    }
  }

  citySelect.addEventListener('change', render);
  timeInput.addEventListener('input', render);
  dateInput.addEventListener('input', render);

  return {
    setCities(cities: City[]): void {
      pinned = cities;
      render();
    },
  };
}

function dayLabel(delta: number): string {
  if (delta === 0) return 'same day';
  if (delta === 1) return 'next day';
  if (delta === -1) return 'prev day';
  return `${delta > 0 ? '+' : ''}${delta} days`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
