/**
 * Solar position, sunrise/sunset and the day/night terminator.
 *
 * This is the NOAA Solar Calculator algorithm, accurate to well under a minute
 * for any date this century — far better than the "assume 6am and 6pm" shortcut
 * most clock sites use. Everything downstream of here (the page palette, the
 * per-city sky, the terminator curve, the golden-hour readout) is driven by
 * these numbers, so it is worth doing properly.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Sun's centre sits 0.833° below the horizon at visible sunrise (refraction + disc radius). */
const SUNRISE_ZENITH = 90.833;

export interface SolarSnapshot {
  /** Degrees above the horizon. Negative means below it. */
  elevation: number;
  /** Sun's declination in degrees — where the subsolar point sits in latitude. */
  declination: number;
  /** Longitude directly beneath the sun, in degrees east. */
  subsolarLongitude: number;
  /** Local sunrise, or null during polar day/night. */
  sunrise: Date | null;
  /** Local sunset, or null during polar day/night. */
  sunset: Date | null;
  /** True while the sun is above the visible horizon. */
  isDay: boolean;
}

function julianCentury(instant: Date): number {
  const julianDay = instant.getTime() / 86_400_000 + 2440587.5;
  return (julianDay - 2451545) / 36525;
}

/** Minutes elapsed since 00:00 UTC on the instant's own UTC date. */
function utcMinutes(instant: Date): number {
  return (
    instant.getUTCHours() * 60 +
    instant.getUTCMinutes() +
    instant.getUTCSeconds() / 60
  );
}

interface Orbit {
  declination: number;
  equationOfTime: number; // minutes
}

function orbit(t: number): Orbit {
  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const centre =
    Math.sin(RAD * meanAnom) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(RAD * 2 * meanAnom) * (0.019993 - 0.000101 * t) +
    Math.sin(RAD * 3 * meanAnom) * 0.000289;

  const trueLong = meanLong + centre;
  const apparentLong =
    trueLong - 0.00569 - 0.00478 * Math.sin(RAD * (125.04 - 1934.136 * t));

  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity =
    meanObliquity + 0.00256 * Math.cos(RAD * (125.04 - 1934.136 * t));

  const declination =
    DEG * Math.asin(Math.sin(RAD * obliquity) * Math.sin(RAD * apparentLong));

  // Equation of time: the gap between clock noon and true solar noon, which
  // swings by ±16 minutes across the year thanks to orbital eccentricity and
  // axial tilt. Skipping it is what makes naive sunrise calculators drift.
  const varY = Math.tan((RAD * obliquity) / 2) ** 2;
  const equationOfTime =
    4 *
    DEG *
    (varY * Math.sin(2 * RAD * meanLong) -
      2 * eccentricity * Math.sin(RAD * meanAnom) +
      4 * eccentricity * varY * Math.sin(RAD * meanAnom) * Math.cos(2 * RAD * meanLong) -
      0.5 * varY * varY * Math.sin(4 * RAD * meanLong) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * RAD * meanAnom));

  return { declination, equationOfTime };
}

/** Full solar picture for one place at one instant. */
export function solarSnapshot(instant: Date, lat: number, lon: number): SolarSnapshot {
  const t = julianCentury(instant);
  const { declination, equationOfTime } = orbit(t);

  // Hour angle: how far the sun is from the local meridian, in degrees.
  const trueSolarMinutes =
    (utcMinutes(instant) + equationOfTime + 4 * lon + 1440) % 1440;
  const hourAngle = trueSolarMinutes / 4 - 180;

  const zenith =
    DEG *
    Math.acos(
      clamp(
        Math.sin(RAD * lat) * Math.sin(RAD * declination) +
          Math.cos(RAD * lat) * Math.cos(RAD * declination) * Math.cos(RAD * hourAngle),
        -1,
        1,
      ),
    );
  const elevation = 90 - zenith;

  // The sunrise hour angle has no solution inside the polar circles at the
  // solstices — the sun simply never crosses the horizon that day.
  const cosH =
    Math.cos(RAD * SUNRISE_ZENITH) / (Math.cos(RAD * lat) * Math.cos(RAD * declination)) -
    Math.tan(RAD * lat) * Math.tan(RAD * declination);

  let sunrise: Date | null = null;
  let sunset: Date | null = null;

  if (cosH >= -1 && cosH <= 1) {
    const haMinutes = 4 * DEG * Math.acos(cosH);
    const solarNoonMinutes = 720 - 4 * lon - equationOfTime;
    const midnightUtc = Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate(),
    );
    sunrise = new Date(midnightUtc + (solarNoonMinutes - haMinutes) * 60_000);
    sunset = new Date(midnightUtc + (solarNoonMinutes + haMinutes) * 60_000);
  }

  const subsolarLongitude = normaliseLongitude(
    -15 * (utcMinutes(instant) / 60 + equationOfTime / 60 - 12),
  );

  return {
    elevation,
    declination,
    subsolarLongitude,
    sunrise,
    sunset,
    isDay: elevation > -0.833,
  };
}

/**
 * Latitude of the day/night boundary at a given longitude.
 *
 * Setting solar elevation to zero and solving for latitude gives
 * `tan(lat) = -cos(H) / tan(declination)`. Plotted across all longitudes on an
 * equirectangular map this traces a sine-like wave — the shape that makes the
 * terminator strip legible at a glance.
 */
export function terminatorLatitude(
  longitude: number,
  declination: number,
  subsolarLongitude: number,
): number {
  const hourAngle = RAD * (longitude - subsolarLongitude);
  const tanDec = Math.tan(RAD * declination);
  const cosH = Math.cos(hourAngle);

  // At an equinox the declination reaches zero and the terminator becomes a pair
  // of meridians rather than a wave. The limit handles itself: the quotient runs
  // to ±Infinity and atan resolves to ±90°, which is exactly right — the curve
  // stands vertical and the night region still closes correctly. Only the
  // genuine 0/0 case needs a guard.
  const quotient = -cosH / tanDec;
  if (Number.isNaN(quotient)) return 0;
  return DEG * Math.atan(quotient);
}

/** True when the given latitude sits on the lit side of the terminator. */
export function isLitAt(
  lat: number,
  lon: number,
  declination: number,
  subsolarLongitude: number,
): boolean {
  const hourAngle = RAD * (lon - subsolarLongitude);
  const sinElevation =
    Math.sin(RAD * lat) * Math.sin(RAD * declination) +
    Math.cos(RAD * lat) * Math.cos(RAD * declination) * Math.cos(hourAngle);
  return sinElevation > 0;
}

/** Named phase of the sky, derived from how high the sun sits. */
export type SkyPhase = 'night' | 'astronomical' | 'nautical' | 'civil' | 'golden' | 'day';

export function skyPhase(elevation: number): SkyPhase {
  if (elevation < -18) return 'night';
  if (elevation < -12) return 'astronomical';
  if (elevation < -6) return 'nautical';
  if (elevation < -0.833) return 'civil';
  if (elevation < 6) return 'golden';
  return 'day';
}

export const PHASE_LABEL: Record<SkyPhase, string> = {
  night: 'Night',
  astronomical: 'Astronomical twilight',
  nautical: 'Nautical twilight',
  civil: 'Civil twilight',
  golden: 'Golden hour',
  day: 'Daylight',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normaliseLongitude(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}
