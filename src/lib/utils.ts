import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The club's timezone. Every booking date and hour is expressed in it,
 * never in the visitor's local time.
 *
 * Two bugs this avoids:
 *   1. Hydration mismatches — a server in UTC and a browser in IST would
 *      disagree about what "today" is for five and a half hours a day.
 *   2. A customer travelling abroad seeing (and booking) the wrong day.
 */
export const CLUB_TIME_ZONE = 'Asia/Kolkata'

const istFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export interface ClubNow {
  /** "2026-07-28" in club time. */
  dateISO: string
  /** 0–23 in club time. */
  hour: number
  minute: number
}

/** Current date and hour at the club. Identical on server and client. */
export function clubNow(instant: Date = new Date()): ClubNow {
  const parts = istFormatter.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00'

  // Intl renders midnight as "24" in some hourCycle configurations.
  const hour = Number(get('hour')) % 24

  return {
    dateISO: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: Number(get('minute')),
  }
}

/** "2026-07-28" — today at the club. */
export function clubToday(): string {
  return clubNow().dateISO
}

/**
 * Calendar arithmetic on an ISO date string. Done in UTC so it can't be
 * knocked sideways by the host's offset; IST has no DST, so a day is
 * always a day.
 */
export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const t = Date.UTC(y, (m ?? 1) - 1, d ?? 1) + days * 86_400_000
  const next = new Date(t)
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(
    next.getUTCDate(),
  ).padStart(2, '0')}`
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 0 → "12:00 AM", 13 → "1:00 PM" */
export function formatHour(hour: number): string {
  const h = hour % 24
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${suffix}`
}

export function formatHourShort(hour: number): string {
  const h = hour % 24
  const suffix = h < 12 ? 'a' : 'p'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${suffix}`
}

/**
 * Deterministic PRNG (mulberry32). Used for seed data so the "booked"
 * pattern is stable across server and client renders — random data here
 * would cause hydration mismatches and a flickering slot grid.
 */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Groups consecutive slot ids into human ranges: "6:00 PM – 8:00 PM". */
export function describeSlotRanges(slotIds: string[]): string[] {
  const hours = [...slotIds].map((id) => Number(id.split(':')[0])).sort((a, b) => a - b)
  const out: string[] = []
  let start = hours[0]
  let prev = hours[0]

  for (let i = 1; i <= hours.length; i++) {
    const h = hours[i]
    if (h !== prev + 1 || i === hours.length) {
      out.push(`${formatHour(start)} – ${formatHour(prev + 1)}`)
      start = h
    }
    prev = h
  }
  return hours.length ? out : []
}
