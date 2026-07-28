import type { Slot, SlotStatus, StoredSlot } from '@/types'
import { priceForHour, tierIdForHour } from '@/lib/pricing'
import { addDays, clubNow, clubToday, formatHour, hashString, seededRandom } from '@/lib/utils'

/** The club is 24/7, so every hour of the day is a bookable slot. */
export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)

/** How far ahead customers may book. */
export const BOOKING_WINDOW_DAYS = 14

/** How long a slot stays held while the customer is inside Razorpay. */
export const HOLD_TTL_MS = 10 * 60 * 1000

export function slotId(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** A held slot whose TTL has lapsed is available again. */
export function effectiveStatus(stored: StoredSlot | undefined, now = Date.now()): SlotStatus {
  if (!stored) return 'available'
  if (stored.status === 'held') {
    return stored.holdExpiresAt && stored.holdExpiresAt > now ? 'held' : 'available'
  }
  return stored.status
}

/**
 * Builds the grid the UI renders: 24 hours, priced for the date, with
 * stored availability folded in and past hours marked non-bookable.
 */
export function buildSlotGrid(
  dateISO: string,
  stored: Record<string, StoredSlot> = {},
  instant: Date = new Date(),
): Slot[] {
  // Club time, not the visitor's — see CLUB_TIME_ZONE.
  const { dateISO: today, hour: currentHour } = clubNow(instant)
  const isToday = today === dateISO
  const nowMs = instant.getTime()

  return ALL_HOURS.map((hour) => {
    const id = slotId(hour)
    return {
      id,
      hour,
      label: formatHour(hour),
      rangeLabel: `${formatHour(hour)} – ${formatHour(hour + 1)}`,
      status: effectiveStatus(stored[id], nowMs),
      price: priceForHour(dateISO, hour),
      tier: tierIdForHour(hour),
      // A slot is bookable until its start hour passes.
      past: isToday && hour <= currentHour,
    }
  })
}

export function isBookable(slot: Slot): boolean {
  return slot.status === 'available' && !slot.past
}

/** Dates offered by the date strip, starting today at the club. */
export function bookingDates(days = BOOKING_WINDOW_DAYS, from: string = clubToday()): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i))
}

/** True once a slot's start hour has passed at the club. */
export function isPastSlot(dateISO: string, slotIdOrHour: string | number): boolean {
  const { dateISO: today, hour } = clubNow()
  if (dateISO > today) return false
  if (dateISO < today) return true
  const h = typeof slotIdOrHour === 'number' ? slotIdOrHour : Number(slotIdOrHour.split(':')[0])
  return h <= hour
}

/**
 * Realistic seed availability. Used by `scripts/seed.ts` to populate
 * Firestore, and by the client as a demo-mode fallback when Firebase
 * credentials are absent — so the booking UI is always reviewable.
 *
 * Deterministic per date: identical output on server and client.
 */
export function seedSlotsForDate(dateISO: string): Record<string, StoredSlot> {
  const rand = seededRandom(hashString(dateISO))
  const out: Record<string, StoredSlot> = {}

  for (const hour of ALL_HOURS) {
    // Evening prime time fills up first; dead-of-night rarely books.
    const likelihood =
      hour >= 18 && hour <= 23 ? 0.62 : hour >= 6 && hour <= 9 ? 0.34 : hour >= 1 && hour <= 5 ? 0.08 : 0.2

    const roll = rand()
    let status: SlotStatus = 'available'
    if (roll < likelihood) status = 'booked'
    // One maintenance window most mornings — turf cutting and lining.
    else if (hour === 11 && roll > 0.82) status = 'blocked'

    out[slotId(hour)] = { status, bookingId: null, holdExpiresAt: null }
  }
  return out
}
