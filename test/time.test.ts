import { describe, it, expect } from 'vitest';
import {
  offsetMinutes,
  formatOffset,
  zonedParts,
  hoursOfDay,
  dayOffset,
  pad2,
  zonedTimeToInstant,
} from '../src/core/time';

describe('offsetMinutes', () => {
  it('reads a standard-time offset', () => {
    // Mid-January: New York is on EST, five hours behind UTC.
    expect(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-300);
  });

  it('follows the zone into daylight saving time', () => {
    // Mid-July: the same zone is on EDT, four hours behind.
    expect(offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-240);
  });

  it('handles half-hour zones', () => {
    expect(offsetMinutes(new Date('2026-08-15T12:00:00Z'), 'Asia/Kolkata')).toBe(330);
  });

  it('handles three-quarter-hour zones', () => {
    // Kathmandu sits at UTC+5:45 — the classic off-grid offset.
    expect(offsetMinutes(new Date('2026-08-15T12:00:00Z'), 'Asia/Kathmandu')).toBe(345);
  });

  it('handles southern-hemisphere DST running the other way', () => {
    // Sydney is UTC+10 in July (winter) and UTC+11 in January (summer).
    expect(offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Australia/Sydney')).toBe(600);
    expect(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Australia/Sydney')).toBe(660);
  });

  it('is exactly zero for UTC', () => {
    expect(offsetMinutes(new Date('2026-08-15T12:00:00Z'), 'UTC')).toBe(0);
  });

  it('is not thrown off by the instant carrying milliseconds', () => {
    expect(offsetMinutes(new Date('2026-08-15T12:00:00.750Z'), 'Asia/Kolkata')).toBe(330);
  });
});

describe('formatOffset', () => {
  it('renders whole hours', () => {
    expect(formatOffset(-480)).toBe('UTC−8');
    expect(formatOffset(120)).toBe('UTC+2');
  });

  it('renders fractional hours', () => {
    expect(formatOffset(330)).toBe('UTC+5:30');
    expect(formatOffset(345)).toBe('UTC+5:45');
    expect(formatOffset(-210)).toBe('UTC−3:30');
  });

  it('renders zero without a sign', () => {
    expect(formatOffset(0)).toBe('UTC');
  });
});

describe('zonedParts', () => {
  it('decomposes an instant into local wall-clock parts', () => {
    const p = zonedParts(new Date('2026-08-15T12:00:00Z'), 'Asia/Tokyo');
    expect(p).toMatchObject({ year: 2026, month: 8, day: 15, hour: 21, minute: 0, second: 0 });
  });

  it('reports midnight as hour 0, never hour 24', () => {
    // Some ICU builds emit "24" for midnight under h23; the module normalises it.
    const p = zonedParts(new Date('2026-08-15T00:00:00Z'), 'UTC');
    expect(p.hour).toBe(0);
  });

  it('rolls the date backwards across the dateline', () => {
    const p = zonedParts(new Date('2026-08-15T02:00:00Z'), 'America/Los_Angeles');
    expect(p).toMatchObject({ day: 14, hour: 19 });
  });

  it('reports the weekday in the target zone', () => {
    // 2026-08-15 is a Saturday; Tokyo is still Saturday evening at 12:00Z.
    expect(zonedParts(new Date('2026-08-15T12:00:00Z'), 'Asia/Tokyo').weekday).toBe(6);
  });
});

describe('hoursOfDay', () => {
  it('returns a continuous fractional hour', () => {
    const h = hoursOfDay(new Date('2026-08-15T12:30:36Z'), 'UTC');
    expect(h).toBeCloseTo(12.51, 2);
  });

  it('stays inside the day even for half-hour zones', () => {
    const h = hoursOfDay(new Date('2026-08-15T20:00:00Z'), 'Asia/Kolkata');
    expect(h).toBeCloseTo(1.5, 3); // 01:30 the next day
  });
});

describe('dayOffset', () => {
  it('reports tomorrow across the dateline', () => {
    // 23:00 UTC is already 08:00 the next morning in Tokyo.
    expect(dayOffset(new Date('2026-08-15T23:00:00Z'), 'Asia/Tokyo', 'UTC')).toBe(1);
  });

  it('reports yesterday going west', () => {
    expect(dayOffset(new Date('2026-08-15T02:00:00Z'), 'America/Los_Angeles', 'UTC')).toBe(-1);
  });

  it('reports zero when both zones share a date', () => {
    expect(dayOffset(new Date('2026-08-15T12:00:00Z'), 'Europe/Paris', 'Europe/London')).toBe(0);
  });
});

describe('zonedTimeToInstant', () => {
  it('round-trips a wall clock back through zonedParts', () => {
    for (const zone of ['Europe/London', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland']) {
      const instant = zonedTimeToInstant(2026, 8, 15, 14, 30, zone);
      const back = zonedParts(instant, zone);
      expect({ h: back.hour, m: back.minute, d: back.day }).toEqual({ h: 14, m: 30, d: 15 });
    }
  });

  it('resolves a plain winter time correctly', () => {
    // 09:00 in New York on a January morning is 14:00 UTC (EST, UTC−5).
    const instant = zonedTimeToInstant(2026, 1, 15, 9, 0, 'America/New_York');
    expect(instant.toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('resolves a plain summer time correctly', () => {
    // The same wall clock in July is 13:00 UTC (EDT, UTC−4).
    const instant = zonedTimeToInstant(2026, 7, 15, 9, 0, 'America/New_York');
    expect(instant.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('lands on the right side of a spring-forward transition', () => {
    // US clocks jump 02:00 to 03:00 on 8 March 2026. A time just after the gap
    // must resolve using the new offset, not the old one.
    const instant = zonedTimeToInstant(2026, 3, 8, 3, 30, 'America/New_York');
    const back = zonedParts(instant, 'America/New_York');
    expect({ h: back.hour, m: back.minute }).toEqual({ h: 3, m: 30 });
  });

  it('lands on the right side of an autumn fall-back transition', () => {
    // Clocks repeat 01:00-02:00 on 1 November 2026; either instant is a
    // defensible answer, but it must render back as the requested wall clock.
    const instant = zonedTimeToInstant(2026, 11, 1, 1, 30, 'America/New_York');
    const back = zonedParts(instant, 'America/New_York');
    expect({ h: back.hour, m: back.minute }).toEqual({ h: 1, m: 30 });
  });

  it('handles a half-hour zone', () => {
    const instant = zonedTimeToInstant(2026, 8, 15, 12, 0, 'Asia/Kolkata');
    expect(instant.toISOString()).toBe('2026-08-15T06:30:00.000Z');
  });
});

describe('pad2', () => {
  it('pads single digits', () => {
    expect(pad2(7)).toBe('07');
  });

  it('leaves two digits alone', () => {
    expect(pad2(42)).toBe('42');
  });

  it('floors fractional input so a running clock never shows a decimal', () => {
    expect(pad2(9.99)).toBe('09');
  });
});
