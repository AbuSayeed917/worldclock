/**
 * Turns a solar elevation into a palette.
 *
 * The page does not have a "dark theme" and a "light theme". It has a sun, and
 * every colour on screen is a function of where that sun sits. Elevation runs
 * from about -90 to +90 degrees; the interesting range is -18 (true night) up to
 * +10 (full day), because that is where the sky actually changes colour.
 *
 * Colours are expressed in OKLCH. Interpolating dusk to night in sRGB drags the
 * midpoint through a desaturated grey; OKLCH is perceptually uniform, so the
 * gradient stays luminous across the whole sweep.
 */

export interface SkyPalette {
  /** Zenith colour of the sky gradient. */
  top: string;
  /** Mid-band, where most of the drama lives. */
  mid: string;
  /** Horizon colour. */
  low: string;
  /** Accent for interactive chrome, pulled from the sky so the page stays coherent. */
  accent: string;
  /** Glow behind the sun or moon disc. */
  glow: string;
  /** How visible the stars are, 0 to 1. */
  starOpacity: number;
  /** How visible the sun disc is, 0 to 1. */
  sunOpacity: number;
  /** Page background tint — always dark enough to keep body text readable. */
  ink: string;
}

interface Stop {
  at: number; // solar elevation, degrees
  top: OKLCH;
  mid: OKLCH;
  low: OKLCH;
  accent: OKLCH;
  glow: OKLCH;
  ink: OKLCH;
  stars: number;
  sun: number;
}

type OKLCH = [l: number, c: number, h: number];

/**
 * Keyframes of the day. Between these the module interpolates, so the sky moves
 * continuously rather than snapping between named states.
 */
const STOPS: Stop[] = [
  {
    at: -90, // deep night
    top: [0.14, 0.05, 265],
    mid: [0.19, 0.07, 272],
    low: [0.24, 0.08, 285],
    accent: [0.72, 0.13, 265],
    glow: [0.4, 0.06, 270],
    ink: [0.16, 0.026, 268],
    stars: 1,
    sun: 0,
  },
  {
    at: -18, // astronomical twilight begins
    top: [0.17, 0.07, 268],
    mid: [0.24, 0.1, 280],
    low: [0.31, 0.11, 295],
    accent: [0.75, 0.14, 275],
    glow: [0.45, 0.09, 285],
    ink: [0.17, 0.03, 270],
    stars: 0.85,
    sun: 0,
  },
  {
    at: -9, // nautical twilight — the blue hour
    top: [0.24, 0.1, 265],
    mid: [0.36, 0.13, 295],
    low: [0.48, 0.14, 330],
    accent: [0.78, 0.15, 320],
    glow: [0.58, 0.15, 340],
    ink: [0.18, 0.034, 275],
    stars: 0.45,
    sun: 0.15,
  },
  {
    at: -3, // civil twilight — the sky burns
    top: [0.36, 0.12, 268],
    mid: [0.55, 0.16, 20],
    low: [0.72, 0.17, 45],
    accent: [0.8, 0.16, 45],
    glow: [0.78, 0.18, 55],
    ink: [0.19, 0.036, 285],
    stars: 0.12,
    sun: 0.6,
  },
  {
    at: 4, // golden hour
    top: [0.62, 0.13, 245],
    mid: [0.79, 0.13, 70],
    low: [0.88, 0.12, 85],
    accent: [0.82, 0.15, 70],
    glow: [0.92, 0.14, 85],
    ink: [0.21, 0.032, 275],
    stars: 0,
    sun: 1,
  },
  {
    at: 20, // full daylight
    top: [0.66, 0.15, 240],
    mid: [0.82, 0.1, 225],
    low: [0.93, 0.05, 215],
    accent: [0.72, 0.16, 235],
    glow: [0.97, 0.06, 95],
    ink: [0.22, 0.03, 258],
    stars: 0,
    sun: 1,
  },
  {
    at: 90,
    top: [0.68, 0.16, 238],
    mid: [0.84, 0.1, 222],
    low: [0.95, 0.04, 210],
    accent: [0.73, 0.16, 232],
    glow: [0.98, 0.06, 95],
    ink: [0.23, 0.03, 255],
    stars: 0,
    sun: 1,
  },
];

/** Build the full palette for a given solar elevation. */
export function skyPalette(elevation: number): SkyPalette {
  const { a, b, t } = bracket(elevation);
  return {
    top: oklch(mixOklch(a.top, b.top, t)),
    mid: oklch(mixOklch(a.mid, b.mid, t)),
    low: oklch(mixOklch(a.low, b.low, t)),
    accent: oklch(mixOklch(a.accent, b.accent, t)),
    glow: oklch(mixOklch(a.glow, b.glow, t)),
    ink: oklch(mixOklch(a.ink, b.ink, t)),
    starOpacity: lerp(a.stars, b.stars, t),
    sunOpacity: lerp(a.sun, b.sun, t),
  };
}

/** Locate the two stops surrounding an elevation and how far between them it sits. */
function bracket(elevation: number): { a: Stop; b: Stop; t: number } {
  if (elevation <= STOPS[0].at) return { a: STOPS[0], b: STOPS[0], t: 0 };
  const last = STOPS[STOPS.length - 1];
  if (elevation >= last.at) return { a: last, b: last, t: 0 };

  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (elevation >= a.at && elevation <= b.at) {
      const span = b.at - a.at;
      const raw = span === 0 ? 0 : (elevation - a.at) / span;
      // Smoothstep keeps the colour velocity from lurching at each keyframe.
      return { a, b, t: raw * raw * (3 - 2 * raw) };
    }
  }
  return { a: last, b: last, t: 0 };
}

function mixOklch(a: OKLCH, b: OKLCH, t: number): OKLCH {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerpHue(a[2], b[2], t)];
}

/** Hues live on a circle, so 350 to 10 must travel 20 degrees, not 340. */
function lerpHue(a: number, b: number, t: number): number {
  let delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function oklch([l, c, h]: OKLCH): string {
  return `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
}

/**
 * Apply a palette to an element as custom properties.
 *
 * The matching CSS registers these with `@property … syntax: '<color>'`, which is
 * what allows the browser to *interpolate* them. Without that registration a
 * custom property is just a string and every sky change would snap.
 */
export function applyPalette(target: HTMLElement, palette: SkyPalette): void {
  target.style.setProperty('--sky-top', palette.top);
  target.style.setProperty('--sky-mid', palette.mid);
  target.style.setProperty('--sky-low', palette.low);
  target.style.setProperty('--accent', palette.accent);
  target.style.setProperty('--glow', palette.glow);
  target.style.setProperty('--star-opacity', palette.starOpacity.toFixed(3));
  target.style.setProperty('--sun-opacity', palette.sunOpacity.toFixed(3));
  target.style.setProperty('--ink', palette.ink);
}
