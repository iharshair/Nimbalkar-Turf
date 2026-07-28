import type { RateTier, RateTierId } from '@/types'

/**
 * Rate card. Peak carries a weekend uplift; everything else is flat.
 * These numbers are also what the Pricing table renders, so the table
 * and the checkout total can never drift apart.
 */
export const RATE_TIERS: RateTier[] = [
  {
    id: 'night',
    label: 'Night Owl',
    from: 0,
    to: 6,
    weekday: 700,
    weekend: 700,
    note: 'Midnight to 6 AM. Full floodlights, lowest rate.',
  },
  {
    id: 'offpeak',
    label: 'Off-Peak',
    from: 6,
    to: 17,
    weekday: 800,
    weekend: 800,
    note: 'Morning and afternoon. Best for practice sessions.',
  },
  {
    id: 'peak',
    label: 'Prime Floodlight',
    from: 17,
    to: 24,
    weekday: 1200,
    weekend: 1400,
    note: '5 PM to midnight — our busiest window. Book early.',
  },
]

/**
 * The overtime policy, stated in one place and rendered before checkout.
 * This exists specifically to kill the recurring "extra minutes" dispute:
 * the customer sees the exact grace window and the exact block rate
 * *before* they pay, and it is reprinted on the confirmation.
 */
export const OVERTIME_POLICY = {
  graceMinutes: 10,
  blockMinutes: 15,
  blockRate: 250,
  /** Overtime never exceeds one extra hour of billing. */
  maxBlocks: 4,
  headline: '10 minutes grace. Then ₹250 per 15 minutes. Nothing else.',
  rules: [
    'Your slot starts and ends on the hour. Play begins when your slot begins, not when you arrive.',
    'A 10-minute grace period applies at the end of every booking — free, always, no questions asked.',
    'Past the grace period, overtime is billed at ₹250 per 15-minute block, rounded up to the next block.',
    'Overtime is capped at 4 blocks (one hour). Beyond that the next slot holder has the turf.',
    'If the following slot is already booked, we cannot extend — the grace period is the hard limit.',
    'Overtime is shown to you on the ground tablet and confirmed before it is charged. It is never added silently.',
  ],
  /**
   * Worked examples. `minutes` is the worst case in each band, and the
   * charge shown to customers is computed from `overtimeCharge` below —
   * so the published table can never drift from the billing logic.
   */
  examples: [
    { over: 'Up to 10 min', minutes: 10 },
    { over: '11–25 min', minutes: 25 },
    { over: '26–40 min', minutes: 40 },
    { over: '41–55 min', minutes: 55 },
  ],
} as const

/** Advance payable online. 100% — no part-payment, no on-ground surprises. */
export const ADVANCE_PERCENT = 100

export function isWeekend(dateISO: string): boolean {
  // Parse as a plain calendar date, not UTC, so the day never shifts.
  const [y, m, d] = dateISO.split('-').map(Number)
  const day = new Date(y, (m ?? 1) - 1, d ?? 1).getDay()
  return day === 0 || day === 6
}

export function tierForHour(hour: number): RateTier {
  const tier = RATE_TIERS.find((t) => hour >= t.from && hour < t.to)
  // Hours are always 0–23, but keep the fallback total-safe.
  return tier ?? RATE_TIERS[1]
}

export function priceForHour(dateISO: string, hour: number): number {
  const tier = tierForHour(hour)
  return isWeekend(dateISO) ? tier.weekend : tier.weekday
}

export function tierIdForHour(hour: number): RateTierId {
  return tierForHour(hour).id
}

/** Total for a set of slot ids ("HH:mm") on a given date. */
export function totalForSlots(dateISO: string, slotIds: string[]): number {
  return slotIds.reduce((sum, id) => sum + priceForHour(dateISO, hourFromSlotId(id)), 0)
}

export function hourFromSlotId(slotId: string): number {
  return Number(slotId.split(':')[0])
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * The single implementation of the overtime rule. Used by the published
 * examples on the site, and the same function the ground tablet should
 * call — one rule, one place.
 */
export function overtimeCharge(minutesOver: number): number {
  const billable = minutesOver - OVERTIME_POLICY.graceMinutes
  if (billable <= 0) return 0
  const blocks = Math.min(
    Math.ceil(billable / OVERTIME_POLICY.blockMinutes),
    OVERTIME_POLICY.maxBlocks,
  )
  return blocks * OVERTIME_POLICY.blockRate
}
