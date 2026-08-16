/**
 * Application entry point.
 *
 * One requestAnimationFrame loop drives everything, but not everything runs at
 * frame rate. Clock hands and the seconds readout need every frame to sweep
 * smoothly; the sky palette and the terminator geometry change far too slowly to
 * justify recomputing sixty times a second. The loop therefore keeps three
 * cadences, which is the difference between a page that idles near zero CPU and
 * one that spins a fan.
 */

import './styles/tokens.css';
import './styles/app.css';

import { CITIES, nearestCity, type City } from './data/cities';
import { CityStore } from './core/store';
import { skyPalette, applyPalette } from './core/sky';
import { solarSnapshot, skyPhase, PHASE_LABEL } from './core/solar';
import {
  localZone,
  zonedParts,
  offsetMinutes,
  formatOffset,
  formatDateLabel,
  pad2,
} from './core/time';

import { createDial } from './ui/analog';
import { createStarField } from './ui/stars';
import { createTerminator } from './ui/terminator';
import { createCard, type Card } from './ui/card';
import { createSearch } from './ui/search';
import { createConverter } from './ui/converter';
import { createRail } from './ui/rail';
import { createStage } from './ui/lottie-stage';

const q = <T extends Element = HTMLElement>(role: string): T =>
  document.querySelector<T>(`[data-role="${role}"]`)!;

/* -------------------------------------------------------------- home city */

const homeZone = localZone();

/**
 * The viewer's city, inferred from their IANA zone. Matching the zone outright
 * is exact when it works; falling back to the zone's rough geography keeps the
 * hero sensible for zones no city in the table shares.
 */
function resolveHomeCity(): City {
  const exact = CITIES.find((city) => city.zone === homeZone);
  if (exact) return exact;

  // Derive an approximate longitude from the current UTC offset — 15° per hour —
  // and take the nearest city on the equator-ish band. Crude, but it never
  // leaves the hero showing a city on the wrong side of the planet.
  const approximateLongitude = (offsetMinutes(new Date(), homeZone) / 60) * 15;
  return nearestCity(0, approximateLongitude);
}

const homeCity = resolveHomeCity();

/* ------------------------------------------------------------ time offset */

/**
 * Scrub offset in milliseconds. Zero means "now"; the terminator drag moves it.
 */
let offsetMs = 0;
const currentInstant = (): Date => new Date(Date.now() + offsetMs);

/* ----------------------------------------------------------------- pieces */

const store = new CityStore();

createStarField(q<HTMLCanvasElement>('stars'));

const heroDial = createDial({ size: 100, detailed: true });
q('hero-dial').append(heroDial.el);

/**
 * The hero animation follows the local time of day: someone stretching awake at
 * dawn, people out walking at midday, someone still at a desk after dark. It is
 * chosen from the sun's actual elevation, so scrubbing the terminator strip
 * across a sunrise swaps the scene too.
 */
const HERO_SCENES = {
  dawn: { src: 'lottie/dawn.json', label: 'Someone waking as the sun comes up' },
  midday: { src: 'lottie/midday.json', label: 'People out walking under a bright sky' },
  dusk: { src: 'lottie/dusk.json', label: 'People heading home as the sun sets' },
  night: { src: 'lottie/night.json', label: 'Someone still at a desk after dark' },
} as const;

type SceneKey = keyof typeof HERO_SCENES;

/**
 * Choose the scene from the sun's height *and* its direction of travel.
 *
 * Elevation alone cannot tell dawn from dusk — the sun sits at the same angle
 * on both sides of noon. Sampling the elevation ten minutes ahead gives the
 * sign of the change, which is what separates someone waking up from someone
 * walking home.
 */
function sceneForSun(instant: Date, elevation: number): SceneKey {
  if (elevation < -6) return 'night';
  if (elevation >= 14) return 'midday';

  const later = solarSnapshot(
    new Date(instant.getTime() + 10 * 60_000),
    homeCity.lat,
    homeCity.lon,
  );
  return later.elevation > elevation ? 'dawn' : 'dusk';
}

let heroScene: SceneKey = 'midday';

const heroStage = createStage({
  src: HERO_SCENES[heroScene].src,
  label: HERO_SCENES[heroScene].label,
  // Fit inside the box, anchored to the ground line, so the whole scene stays
  // visible however wide the hero gets.
  fit: 'xMidYMax meet',
});
q('hero-stage').append(heroStage.el);

const terminator = createTerminator({
  onScrub(deltaMinutes) {
    offsetMs += deltaMinutes * 60_000;
    // Cap the scrub at ±3 days. Past that the map stops being a planner and
    // starts being a calendar, which is a different tool.
    const limit = 3 * 24 * 60 * 60_000;
    offsetMs = Math.max(-limit, Math.min(limit, offsetMs));
    renderSlow(currentInstant());
    renderOffsetReadout();
  },
  onScrubEnd: renderOffsetReadout,
  onSelect(city) {
    store.add(city.id);
  },
});
q('strip').append(terminator.el);

const rail = createRail(q('rail'));

// A vendored illustration for the planning section. Decorative, lazily mounted,
// and the one place a stock loop fits without needing to know anything.
const converterArt = createStage({
  src: 'lottie/vendor/world-people.json',
  label: 'Two people meeting across a globe',
  fit: 'xMidYMid meet',
});
q('converter-art').append(converterArt.el);

const converter = createConverter({
  root: document.querySelector<HTMLElement>('.converter')!,
  initialCityId: homeCity.id,
});

const search = createSearch({
  root: q('search'),
  onPick: (city) => store.add(city.id),
  isPinned: (id) => store.has(id),
});

q<HTMLButtonElement>('reset-time').addEventListener('click', () => {
  offsetMs = 0;
  renderSlow(currentInstant());
  renderOffsetReadout();
});

/* ------------------------------------------------------------- city cards */

const grid = q('grid');
let cards: Card[] = [];

function syncCards(cities: City[]): void {
  // Reuse the card instances that survive a change so pinning a new city does
  // not tear down and rebuild every other card's DOM and animation state.
  const existing = new Map(cards.map((card) => [card.city.id, card]));
  const next: Card[] = [];

  for (const city of cities) {
    next.push(existing.get(city.id) ?? createCard(city, (target) => store.remove(target.id)));
    existing.delete(city.id);
  }

  for (const orphan of existing.values()) orphan.el.remove();

  grid.replaceChildren(...next.map((card) => card.el));
  cards = next;

  if (!cities.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `
      <h3>No cities pinned</h3>
      <p>Search above to add one, or start from a common set.</p>
      <button class="btn btn-accent" type="button" data-role="restore">Restore defaults</button>
    `;
    empty.querySelector('[data-role="restore"]')!.addEventListener('click', () => store.reset());
    grid.replaceChildren(empty);
  }

  terminator.setCities(cities);
  converter.setCities(cities);
  search.refresh();

  const instant = currentInstant();
  for (const card of cards) card.update(instant, homeZone);
  terminator.update(instant);
}

store.subscribe(syncCards);

/* ------------------------------------------------------------- rendering */

const heroPlace = q('hero-place');
const heroPhase = q('hero-phase');
const heroHm = q('hero-hm');
const heroS = q('hero-s');
const heroDate = q('hero-date');
const heroSunrise = q('hero-sunrise');
const heroSunset = q('hero-sunset');
const heroOffset = q('hero-offset');
const navTime = q('nav-time');
const navZone = q('nav-zone');
const offsetReadout = q('offset-readout');

heroPlace.textContent = `${homeCity.name} · ${homeCity.country}`;
navZone.textContent = homeZone.replace(/_/g, ' ');

/** Frame-rate work: the sweeping hands and the running digits. */
function renderFast(instant: Date): void {
  const parts = zonedParts(instant, homeCity.zone);
  heroHm.textContent = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  heroS.textContent = pad2(parts.second);
  navTime.textContent = `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;

  heroDial.update(instant, homeCity.zone);
  for (const card of cards) card.update(instant, homeZone);
}

/** Second-rate work: the map geometry and anything driven by the sun's position. */
function renderSlow(instant: Date): void {
  terminator.update(instant);
  rail.update(instant);

  const sun = solarSnapshot(instant, homeCity.lat, homeCity.lon);
  applyPalette(document.documentElement, skyPalette(sun.elevation));

  const phase = skyPhase(sun.elevation);
  heroPhase.textContent = PHASE_LABEL[phase];

  // Swap the hero scene only when the sun crosses a boundary, never per frame.
  const wantedScene = sceneForSun(instant, sun.elevation);
  if (wantedScene !== heroScene) {
    heroScene = wantedScene;
    heroStage.setSource(HERO_SCENES[wantedScene].src, HERO_SCENES[wantedScene].label);
  }

  heroDate.textContent = formatDateLabel(instant, homeCity.zone);
  heroOffset.textContent = formatOffset(offsetMinutes(instant, homeCity.zone));

  if (sun.sunrise && sun.sunset) {
    const rise = zonedParts(sun.sunrise, homeCity.zone);
    const set = zonedParts(sun.sunset, homeCity.zone);
    heroSunrise.textContent = `${pad2(rise.hour)}:${pad2(rise.minute)}`;
    heroSunset.textContent = `${pad2(set.hour)}:${pad2(set.minute)}`;
  } else {
    heroSunrise.textContent = sun.isDay ? 'never' : '—';
    heroSunset.textContent = sun.isDay ? 'never' : '—';
  }
}

function renderOffsetReadout(): void {
  if (Math.abs(offsetMs) < 60_000) {
    offsetReadout.textContent = 'Showing the present moment';
    return;
  }

  const totalMinutes = Math.round(offsetMs / 60_000);
  const sign = totalMinutes > 0 ? 'ahead of' : 'behind';
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const span = hours ? `${hours}h ${pad2(minutes)}m` : `${minutes}m`;

  offsetReadout.innerHTML = `Scrubbed <b>${span}</b> ${sign} now`;
}

/* ------------------------------------------------------------------- loop */

let lastSlow = 0;

function tick(timestamp: number): void {
  const instant = currentInstant();
  renderFast(instant);

  // Four times a second is far more than the sun needs and still feels instant
  // when the strip is being dragged.
  if (timestamp - lastSlow > 250) {
    lastSlow = timestamp;
    renderSlow(instant);
  }

  requestAnimationFrame(tick);
}

syncCards(store.cities);
renderSlow(currentInstant());
renderOffsetReadout();
requestAnimationFrame(tick);
