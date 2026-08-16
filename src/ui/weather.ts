/**
 * Picks the sky animation for a city.
 *
 * These are professional Lottie files vendored from LottieFiles (see
 * public/lottie/vendor/CREDITS.md). They are stock loops, so they cannot know
 * anything on their own — the selection is what makes them meaningful. A city
 * shows the moon when it is genuinely dark there, and its daytime condition is
 * drawn from its own latitude, so Tromsø gets snow and Singapore gets storms.
 *
 * The condition is deterministic per city, not random, so a card does not change
 * its weather every time the page re-renders.
 */

import type { City } from '../data/cities';

export type SkyCondition = 'moon' | 'partly-cloudy' | 'rain' | 'snow' | 'storm';

const SOURCES: Record<SkyCondition, string> = {
  moon: 'lottie/vendor/sky-moon.json',
  'partly-cloudy': 'lottie/vendor/sky-partly-cloudy.json',
  rain: 'lottie/vendor/sky-rain.json',
  snow: 'lottie/vendor/sky-snow.json',
  storm: 'lottie/vendor/sky-storm.json',
};

const LABELS: Record<SkyCondition, string> = {
  moon: 'Night sky',
  'partly-cloudy': 'Partly cloudy',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Storms',
};

export function sourceFor(condition: SkyCondition): string {
  return SOURCES[condition];
}

export function labelFor(condition: SkyCondition): string {
  return LABELS[condition];
}

/**
 * Daytime condition from latitude and a stable per-city hash.
 *
 * Not a forecast — there is no weather API here, and pretending otherwise would
 * be worse than not showing weather at all. It is a plausible climate hint: the
 * far north gets snow, the tropics get storms, everywhere else is mostly fair.
 */
export function conditionFor(city: City, isDay: boolean): SkyCondition {
  if (!isDay) return 'moon';

  const lat = Math.abs(city.lat);
  const roll = hash(city.id) % 100;

  if (lat > 55) return roll < 34 ? 'snow' : roll < 62 ? 'rain' : 'partly-cloudy';
  if (lat < 25) return roll < 30 ? 'storm' : roll < 48 ? 'rain' : 'partly-cloudy';
  return roll < 22 ? 'rain' : 'partly-cloudy';
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
