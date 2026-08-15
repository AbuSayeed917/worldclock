/**
 * Timezone maths built entirely on Intl.DateTimeFormat.
 *
 * Every modern browser ships the full IANA tz database behind Intl, including
 * historical and future DST rules. Pulling in moment-timezone or Luxon would add
 * ~180KB to re-implement what the platform already knows, so this module stays
 * dependency-free and works with plain `Date` objects throughout.
 */

/** The clock-face pieces of an instant, as observed in one timezone. */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  /** 0 = Sunday, matching Date#getDay. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsFormatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Decompose an instant into the wall-clock parts seen in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '0';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    // Intl emits "24" for midnight in some ICU versions even under h23.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  };
}

/**
 * Offset from UTC in minutes for `timeZone` at `instant`, DST included.
 *
 * The trick: format the instant in the target zone, reinterpret those wall-clock
 * numbers as if they were UTC, and diff against the real instant. The gap is
 * exactly the offset. This is the standard Intl-only approach and needs no table.
 */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Drop the instant's own milliseconds so the difference lands on a whole second.
  const actual = instant.getTime() - instant.getMilliseconds();
  return Math.round((asUtc - actual) / 60_000);
}

/** Render an offset the way clocks label it: "UTC+5:30", "UTC-8", "UTC". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Fractional hours past local midnight — 14:30:36 becomes 14.51.
 * Analog hands and the terminator strip both need a continuous value, not
 * integers, or they tick in visible jumps.
 */
export function hoursOfDay(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour + p.minute / 60 + p.second / 3600;
}

/** Short timezone abbreviation as the locale names it: "BST", "JST", "GMT+7". */
export function zoneAbbreviation(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(instant);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * Calendar days between the viewer's own date and the city's date: -1, 0 or +1.
 * This is what powers the "Tomorrow" / "Yesterday" badge — the single most
 * useful piece of information on a world clock, and the one people get wrong.
 */
export function dayOffset(instant: Date, timeZone: string, homeZone: string): number {
  const a = zonedParts(instant, timeZone);
  const b = zonedParts(instant, homeZone);
  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((dayA - dayB) / 86_400_000);
}

/**
 * The inverse of `zonedParts`: given a wall-clock reading in some zone, find the
 * UTC instant it refers to.
 *
 * This cannot be done in one step. The offset depends on the instant, but the
 * instant is what we are solving for. So: guess by treating the wall clock as
 * UTC, look up the offset at that guess, correct, then check whether the offset
 * at the corrected instant still agrees. The second pass matters only near a DST
 * transition, which is exactly where a single-pass conversion silently lands an
 * hour out.
 */
export function zonedTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = offsetMinutes(new Date(wallClock), timeZone);
  let instant = wallClock - firstOffset * 60_000;

  const secondOffset = offsetMinutes(new Date(instant), timeZone);
  if (secondOffset !== firstOffset) {
    instant = wallClock - secondOffset * 60_000;
  }

  return new Date(instant);
}

/** The viewer's own IANA zone, with a safe fallback if Intl is unavailable. */
export function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const labelCache = new Map<string, Intl.DateTimeFormat>();

/** "Friday, 15 August" in the given zone. */
export function formatDateLabel(instant: Date, timeZone: string): string {
  let fmt = labelCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    labelCache.set(timeZone, fmt);
  }
  return fmt.format(instant);
}

/** Zero-padded 2-digit string, used everywhere a clock digit is drawn. */
export function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}
