/**
 * Ranks harvested animations by how relevant they are to this site.
 *
 * Bodymovin keeps the After Effects composition name and every layer name, so a
 * file's subject is readable straight out of the JSON. Scoring those strings
 * against the vocabulary of a world clock surfaces the handful worth rendering
 * out of a few hundred candidates.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, '.shots/harvest');

/**
 * Focused vocabularies. `node scripts/rank-harvest.mjs clock` scores only for
 * timekeeping subjects; `earth` for the planet; omitting it uses the general
 * world-clock vocabulary.
 */
const FOCUS = {
  clock: {
    clock: 14, watch: 12, hourglass: 12, alarm: 10, timer: 10, time: 9,
    stopwatch: 12, pendulum: 12, dial: 8, hand: 4, tick: 6, minute: 6,
    hour: 8, second: 4, schedule: 7, calendar: 6, deadline: 6, countdown: 10,
  },
  earth: {
    earth: 15, globe: 15, planet: 12, world: 12, map: 9, atlas: 8,
    continent: 10, orbit: 9, satellite: 8, space: 6, sphere: 8,
    country: 6, travel: 6, international: 8, global: 9, longitude: 12,
  },
};

/** Weighted vocabulary. Higher weight means more central to the brief. */
const TOPICS = {
  clock: 10, watch: 8, time: 8, hourglass: 7, alarm: 6, timer: 6,
  earth: 10, globe: 10, world: 9, planet: 8, map: 7, orbit: 6, satellite: 5,
  sun: 8, sunrise: 9, sunset: 9, moon: 9, night: 8, star: 6, sky: 7,
  cloud: 6, weather: 6, rain: 4, day: 5, dawn: 8, dusk: 8,
  city: 7, building: 5, skyline: 8, travel: 6, plane: 5, airport: 6,
  walk: 7, walking: 8, people: 8, person: 7, man: 5, woman: 5, human: 6,
  character: 5, business: 4, work: 4, desk: 6, laptop: 5, coffee: 5,
  meeting: 6, calendar: 5, schedule: 5,
};

const focusArg = process.argv[2];
const VOCAB = FOCUS[focusArg] ?? TOPICS;
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

const scored = [];
for (const file of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  } catch {
    continue;
  }

  const haystack = [
    data.nm ?? '',
    ...(data.layers ?? []).map((l) => l.nm ?? ''),
    ...(data.assets ?? []).flatMap((a) => (a.layers ?? []).map((l) => l.nm ?? '')),
  ]
    .join(' ')
    .toLowerCase();

  let score = 0;
  const hits = [];
  for (const [word, weight] of Object.entries(VOCAB)) {
    // Word-boundary match so "sun" does not fire on "sunglasses".
    const re = new RegExp(`\\b${word}`, 'g');
    const n = (haystack.match(re) ?? []).length;
    if (n) {
      score += weight * Math.min(n, 3);
      hits.push(word);
    }
  }

  const kb = Math.round(JSON.stringify(data).length / 1024);
  // Very heavy files are not worth shipping on a static site.
  if (kb > 320) score -= 25;
  if (kb > 700) score -= 60;

  scored.push({
    file,
    score,
    hits,
    kb,
    name: data.nm,
    size: `${data.w}x${data.h}`,
    seconds: +((data.op - data.ip) / (data.fr || 60)).toFixed(1),
    layers: (data.layers ?? []).length,
  });
}

scored.sort((a, b) => b.score - a.score);

console.log(`ranked ${scored.length} animations` + (focusArg ? ` — focus: ${focusArg}` : '') + '\n');
for (const s of scored.slice(0, 28)) {
  if (s.score <= 0) break;
  console.log(
    `${String(s.score).padStart(4)}  ${s.size.padEnd(11)} ${String(s.seconds + 's').padEnd(6)} ` +
      `${String(s.kb + 'KB').padStart(6)}  ${String(s.name ?? '').slice(0, 22).padEnd(22)} ${s.file}`,
  );
  console.log(`      ${s.hits.join(', ')}`);
}
