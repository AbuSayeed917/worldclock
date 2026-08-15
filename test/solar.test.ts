import { describe, it, expect } from 'vitest';
import {
  solarSnapshot,
  terminatorLatitude,
  isLitAt,
  skyPhase,
} from '../src/core/solar';

const LONDON = { lat: 51.5074, lon: -0.1278 };
const TROMSO = { lat: 69.6492, lon: 18.9553 };
const SINGAPORE = { lat: 1.3521, lon: 103.8198 };

/** Minutes past midnight UTC, for comparing against published sun tables. */
function utcMinutesOf(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

describe('declination', () => {
  it('peaks at the June solstice', () => {
    const s = solarSnapshot(new Date('2026-06-21T12:00:00Z'), 0, 0);
    expect(s.declination).toBeCloseTo(23.44, 1);
  });

  it('bottoms out at the December solstice', () => {
    const s = solarSnapshot(new Date('2026-12-21T12:00:00Z'), 0, 0);
    expect(s.declination).toBeCloseTo(-23.44, 1);
  });

  it('crosses zero at the March equinox', () => {
    const s = solarSnapshot(new Date('2026-03-20T12:00:00Z'), 0, 0);
    expect(Math.abs(s.declination)).toBeLessThan(0.5);
  });
});

describe('sunrise and sunset', () => {
  it('matches published times for London at the summer solstice', () => {
    // Published: sunrise 04:43 BST (03:43 UTC), sunset 21:21 BST (20:21 UTC).
    const s = solarSnapshot(new Date('2026-06-21T12:00:00Z'), LONDON.lat, LONDON.lon);
    expect(s.sunrise).not.toBeNull();
    expect(s.sunset).not.toBeNull();
    expect(utcMinutesOf(s.sunrise!)).toBeCloseTo(3 * 60 + 43, -0.7); // within ~5 min
    expect(utcMinutesOf(s.sunset!)).toBeCloseTo(20 * 60 + 21, -0.7);
  });

  it('gives Singapore a near-constant twelve-hour day', () => {
    // On the equator day length barely moves across the year.
    const s = solarSnapshot(new Date('2026-08-15T06:00:00Z'), SINGAPORE.lat, SINGAPORE.lon);
    const dayLengthHours = (s.sunset!.getTime() - s.sunrise!.getTime()) / 3_600_000;
    expect(dayLengthHours).toBeGreaterThan(11.5);
    expect(dayLengthHours).toBeLessThan(12.5);
  });

  it('returns null through the polar day', () => {
    // Tromsø is inside the Arctic Circle: the sun never sets in late June.
    const s = solarSnapshot(new Date('2026-06-21T12:00:00Z'), TROMSO.lat, TROMSO.lon);
    expect(s.sunrise).toBeNull();
    expect(s.sunset).toBeNull();
    expect(s.isDay).toBe(true);
  });

  it('returns null through the polar night', () => {
    const s = solarSnapshot(new Date('2026-12-21T12:00:00Z'), TROMSO.lat, TROMSO.lon);
    expect(s.sunrise).toBeNull();
    expect(s.sunset).toBeNull();
    expect(s.isDay).toBe(false);
  });
});

describe('elevation', () => {
  it('puts the sun overhead at the subsolar point', () => {
    const instant = new Date('2026-06-21T12:00:00Z');
    const probe = solarSnapshot(instant, 0, 0);
    // Stand at the subsolar point and the sun should be within a degree of zenith.
    const overhead = solarSnapshot(instant, probe.declination, probe.subsolarLongitude);
    expect(overhead.elevation).toBeGreaterThan(89);
  });

  it('is negative on the night side', () => {
    // 00:00 UTC is the small hours in London.
    const s = solarSnapshot(new Date('2026-01-15T00:00:00Z'), LONDON.lat, LONDON.lon);
    expect(s.elevation).toBeLessThan(0);
    expect(s.isDay).toBe(false);
  });

  it('is positive at local noon', () => {
    const s = solarSnapshot(new Date('2026-01-15T12:00:00Z'), LONDON.lat, LONDON.lon);
    expect(s.elevation).toBeGreaterThan(0);
    expect(s.isDay).toBe(true);
  });
});

describe('subsolarLongitude', () => {
  it('sits near the prime meridian at 12:00 UTC', () => {
    // Offset from zero is the equation of time, which never exceeds ~4 degrees.
    const s = solarSnapshot(new Date('2026-08-15T12:00:00Z'), 0, 0);
    expect(Math.abs(s.subsolarLongitude)).toBeLessThan(5);
  });

  it('sits near the dateline at 00:00 UTC', () => {
    const s = solarSnapshot(new Date('2026-08-15T00:00:00Z'), 0, 0);
    expect(Math.abs(s.subsolarLongitude)).toBeGreaterThan(175);
  });

  it('travels westward as the day advances', () => {
    const a = solarSnapshot(new Date('2026-08-15T06:00:00Z'), 0, 0).subsolarLongitude;
    const b = solarSnapshot(new Date('2026-08-15T09:00:00Z'), 0, 0).subsolarLongitude;
    // Three hours of rotation moves the subsolar point 45 degrees west.
    expect(a - b).toBeCloseTo(45, 0);
  });
});

describe('terminatorLatitude', () => {
  it('marks the boundary where elevation is zero', () => {
    const { declination, subsolarLongitude } = solarSnapshot(
      new Date('2026-08-15T12:00:00Z'),
      0,
      0,
    );
    for (const lon of [-150, -60, 0, 75, 160]) {
      const lat = terminatorLatitude(lon, declination, subsolarLongitude);
      const onBoundary = solarSnapshot(new Date('2026-08-15T12:00:00Z'), lat, lon);
      expect(Math.abs(onBoundary.elevation)).toBeLessThan(0.5);
    }
  });

  it('stays finite at the equinox when declination approaches zero', () => {
    const lat = terminatorLatitude(45, 0, 0);
    expect(Number.isFinite(lat)).toBe(true);
  });

  it('stands the boundary vertical at the equinox instead of flattening it', () => {
    // With zero declination the terminator is a pair of meridians, not a wave.
    // Longitudes facing the sun push the curve to one pole, the far side to the
    // other, so the night region still closes over the correct half of the map.
    const sunward = terminatorLatitude(0, 0, 0); // sun overhead
    const antisolar = terminatorLatitude(180, 0, 0); // midnight meridian
    expect(sunward).toBeCloseTo(-90, 4);
    expect(antisolar).toBeCloseTo(90, 4);
  });

  it('flips which pole is dark when the season turns', () => {
    // Northern summer: the south pole sits in polar night, so at the antisolar
    // meridian the boundary runs to the north and darkness fills below it.
    const june = solarSnapshot(new Date('2026-06-21T12:00:00Z'), 0, 0);
    const december = solarSnapshot(new Date('2026-12-21T12:00:00Z'), 0, 0);
    expect(june.declination).toBeGreaterThan(0);
    expect(december.declination).toBeLessThan(0);
    expect(isLitAt(85, 0, june.declination, june.subsolarLongitude)).toBe(true);
    expect(isLitAt(-85, 0, june.declination, june.subsolarLongitude)).toBe(false);
    expect(isLitAt(85, 0, december.declination, december.subsolarLongitude)).toBe(false);
    expect(isLitAt(-85, 0, december.declination, december.subsolarLongitude)).toBe(true);
  });
});

describe('isLitAt', () => {
  it('agrees with the elevation sign', () => {
    const instant = new Date('2026-08-15T12:00:00Z');
    const { declination, subsolarLongitude } = solarSnapshot(instant, 0, 0);
    for (const [lat, lon] of [
      [LONDON.lat, LONDON.lon],
      [TROMSO.lat, TROMSO.lon],
      [-33.87, 151.21], // Sydney
      [40.71, -74.01], // New York
    ] as const) {
      const lit = isLitAt(lat, lon, declination, subsolarLongitude);
      expect(lit).toBe(solarSnapshot(instant, lat, lon).elevation > 0);
    }
  });
});

describe('skyPhase', () => {
  it('names each band of the twilight scale', () => {
    expect(skyPhase(-25)).toBe('night');
    expect(skyPhase(-15)).toBe('astronomical');
    expect(skyPhase(-9)).toBe('nautical');
    expect(skyPhase(-3)).toBe('civil');
    expect(skyPhase(3)).toBe('golden');
    expect(skyPhase(45)).toBe('day');
  });
});
