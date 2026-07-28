import { clamp, clubNow, fromISODate, hashString, seededRandom } from '@/lib/utils'

/**
 * A recreation of the "Popular times" widget from the Google listing.
 * Baselines are hand-tuned to how a 24-hour Pune turf actually fills:
 * dead through the small hours, a morning bump, a dip in the heat,
 * then a hard evening peak from 7 PM.
 *
 * Index = hour 0–23, value = busyness 0–100.
 */
type DayCurve = readonly number[]

const WEEKDAY: DayCurve = [
  22, 12, 6, 4, 4, 8, 34, 46, 38, 24, 16, 12, 10, 12, 16, 26, 44, 62, 78, 92, 96, 84, 62, 40,
]

const FRIDAY: DayCurve = [
  30, 18, 10, 6, 5, 9, 32, 44, 36, 24, 18, 14, 12, 16, 22, 34, 52, 72, 88, 100, 98, 92, 76, 54,
]

const SATURDAY: DayCurve = [
  46, 30, 18, 10, 6, 10, 30, 48, 52, 44, 34, 26, 22, 26, 34, 46, 62, 80, 94, 100, 96, 90, 80, 64,
]

const SUNDAY: DayCurve = [
  50, 32, 18, 10, 6, 12, 42, 58, 60, 48, 36, 28, 24, 24, 30, 42, 58, 76, 88, 92, 86, 74, 58, 40,
]

/** 0 = Sunday. */
const CURVES: Record<number, DayCurve> = {
  0: SUNDAY,
  1: WEEKDAY,
  2: WEEKDAY,
  3: WEEKDAY,
  4: WEEKDAY,
  5: FRIDAY,
  6: SATURDAY,
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function curveForDay(day: number): number[] {
  return [...(CURVES[day] ?? WEEKDAY)]
}

export type Busyness = 'quiet' | 'steady' | 'busy' | 'packed'

export function busynessBand(value: number): Busyness {
  if (value < 25) return 'quiet'
  if (value < 55) return 'steady'
  if (value < 82) return 'busy'
  return 'packed'
}

export const BUSYNESS_COPY: Record<Busyness, string> = {
  quiet: 'Usually quiet — walk-ins welcome',
  steady: 'Usually a little busy',
  busy: 'Usually busy — book ahead',
  packed: 'Usually packed — book ahead',
}

export interface LiveStatus {
  /** Club-local date, "YYYY-MM-DD". */
  dateISO: string
  /** Club-local day of week, 0 = Sunday. */
  day: number
  hour: number
  /** Today's baseline for this hour. */
  baseline: number
  /** Simulated live reading. */
  live: number
  band: Busyness
  /** Live materially above baseline → amber "Busier than usual" badge. */
  busierThanUsual: boolean
  quieterThanUsual: boolean
  peakHour: number
}

/**
 * Derives the live reading. Deterministic for a given date+hour so the
 * badge doesn't flicker between renders, but drifts hour to hour.
 *
 * Swap this for a real occupancy signal (today's confirmed bookings /
 * total slots) once there is enough booking volume to be meaningful.
 */
export function liveStatus(instant: Date = new Date()): LiveStatus {
  // Club time throughout — a visitor in another timezone should still see
  // how busy the ground is *there*, not where they happen to be.
  const { dateISO, hour } = clubNow(instant)
  const day = fromISODate(dateISO).getDay()
  const curve = curveForDay(day)
  const baseline = curve[hour]

  const rand = seededRandom(hashString(`${dateISO}#${hour}`))
  // ±22 points of swing around the baseline.
  const delta = Math.round((rand() - 0.45) * 44)
  const live = clamp(baseline + delta, 0, 100)

  const peakHour = curve.reduce((best, v, i) => (v > curve[best] ? i : best), 0)

  return {
    dateISO,
    day,
    hour,
    baseline,
    live,
    band: busynessBand(live),
    busierThanUsual: live - baseline >= 12,
    quieterThanUsual: baseline - live >= 12,
    peakHour,
  }
}
