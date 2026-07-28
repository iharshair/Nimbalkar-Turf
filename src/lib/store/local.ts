import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { HOLD_TTL_MS, seedSlotsForDate } from '@/lib/slots'
import { totalForSlots } from '@/lib/pricing'
import {
  BookingNotConfirmableError,
  ConfirmationConflictError,
  SlotUnavailableError,
} from '@/lib/store/errors'
import type { Booking, BookingStatus, StoredSlot } from '@/types'
import type { BookingDetails } from '@/lib/schema'

/**
 * A JSON-file booking store, for running the real payment flow before
 * Firestore exists.
 *
 * Why this is here: Razorpay and Firebase are independent decisions, but
 * the checkout routes previously required both. That meant test keys alone
 * couldn't exercise slot holds, double-booking protection, or "this slot
 * is now taken" — the interesting half of the booking logic.
 *
 * What it is NOT: production storage. It holds no lock across processes,
 * and on a serverless host the filesystem is ephemeral, so writes vanish
 * between invocations. `src/lib/store/index.ts` therefore refuses to pair
 * this backend with live Razorpay keys.
 */

const DATA_FILE = resolve(process.cwd(), '.data', 'store.json')

interface StoreShape {
  slotDays: Record<string, { date: string; slots: Record<string, StoredSlot> }>
  bookings: Record<string, Booking>
}

const EMPTY: StoreShape = { slotDays: {}, bookings: {} }

/**
 * Serialises every read-modify-write so concurrent requests can't
 * interleave. This is what stands in for a Firestore transaction — good
 * enough within one Node process, which is all this backend supports.
 */
let tail: Promise<unknown> = Promise.resolve()

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = tail.then(fn, fn)
  // Swallow rejections on the chain itself, or one failed call would
  // reject every queued call behind it.
  tail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function read(): Promise<StoreShape> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoreShape>
    return { slotDays: parsed.slotDays ?? {}, bookings: parsed.bookings ?? {} }
  } catch {
    // Missing or corrupt file — start clean rather than crash checkout.
    return { ...EMPTY }
  }
}

async function write(data: StoreShape): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true })
  // Write-then-rename so a crash mid-write can't leave a truncated file.
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, DATA_FILE)
}

/**
 * First touch of a date seeds it with the same realistic pattern the demo
 * grid uses, so the ground doesn't look implausibly empty.
 */
function ensureDay(data: StoreShape, date: string) {
  if (!data.slotDays[date]) {
    data.slotDays[date] = { date, slots: seedSlotsForDate(date) }
  }
  return data.slotDays[date]
}

export function newBookingId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 20)
}

export async function getSlotDay(date: string): Promise<Record<string, StoredSlot>> {
  return withLock(async () => {
    const data = await read()
    const existed = Boolean(data.slotDays[date])
    const day = ensureDay(data, date)
    // Persist the seed so availability is stable across requests.
    if (!existed) await write(data)
    return day.slots
  })
}

export async function holdSlots(params: {
  bookingId: string
  date: string
  slotIds: string[]
  details: BookingDetails
  userId?: string | null
}): Promise<{ bookingId: string; amount: number; holdExpiresAt: number }> {
  const { bookingId, date, slotIds, details, userId } = params
  // Priced server-side from the rate card, exactly as the Firestore path
  // does — a tampered client total can never reach Razorpay.
  const amount = totalForSlots(date, slotIds)
  const holdExpiresAt = Date.now() + HOLD_TTL_MS

  return withLock(async () => {
    const data = await read()
    const day = ensureDay(data, date)
    const now = Date.now()

    const conflicts = slotIds.filter((id) => {
      const slot = day.slots[id]
      if (!slot) return false
      if (slot.status === 'available') return false
      // A lapsed hold is free again.
      if (slot.status === 'held') return (slot.holdExpiresAt ?? 0) > now
      return true
    })
    if (conflicts.length) throw new SlotUnavailableError(conflicts)

    for (const id of slotIds) {
      day.slots[id] = { status: 'held', bookingId, holdExpiresAt }
    }

    const iso = new Date().toISOString()
    data.bookings[bookingId] = {
      id: bookingId,
      date,
      slotIds,
      amount,
      status: 'pending',
      name: details.name,
      phone: details.phone,
      email: details.email || null,
      sport: details.sport,
      whatsappOptIn: details.whatsappOptIn,
      notes: details.notes || null,
      userId: userId ?? null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      createdAt: iso,
      updatedAt: iso,
    }

    await write(data)
    return { bookingId, amount, holdExpiresAt }
  })
}

export async function attachOrderId(bookingId: string, orderId: string): Promise<void> {
  return withLock(async () => {
    const data = await read()
    const booking = data.bookings[bookingId]
    if (!booking) return
    booking.razorpayOrderId = orderId
    booking.updatedAt = new Date().toISOString()
    await write(data)
  })
}

/** Mirrors the Firestore implementation's semantics exactly. */
export async function confirmBooking(params: {
  bookingId: string
  paymentId: string
  orderId?: string
}): Promise<Booking> {
  const { bookingId, paymentId, orderId } = params

  const outcome = await withLock(async () => {
    const data = await read()
    const booking = data.bookings[bookingId]
    if (!booking) throw new Error(`Booking ${bookingId} not found`)

    if (booking.status === 'confirmed') {
      return { booking, conflicts: [] as string[], secured: booking.slotIds }
    }
    // Only a refund blocks re-confirmation: `cancelled` and `failed` can
    // both belong to a payment that actually did settle.
    if (booking.status === 'refunded') {
      throw new BookingNotConfirmableError(bookingId, booking.status)
    }

    const day = ensureDay(data, booking.date)
    const now = Date.now()

    const conflicts = booking.slotIds.filter((id) => {
      const slot = day.slots[id]
      if (!slot || slot.bookingId === bookingId) return false
      if (slot.status === 'booked' || slot.status === 'blocked') return true
      return slot.status === 'held' && (slot.holdExpiresAt ?? 0) > now
    })
    const secured = booking.slotIds.filter((id) => !conflicts.includes(id))

    // Claim what's still ours even on a partial conflict, so paid-for
    // hours can't lapse back into the pool.
    for (const id of secured) {
      day.slots[id] = { status: 'booked', bookingId, holdExpiresAt: null }
    }

    const partial = conflicts.length > 0
    booking.status = (partial ? 'pending' : 'confirmed') satisfies BookingStatus
    booking.needsAttention = partial
    booking.conflictSlotIds = conflicts
    booking.securedSlotIds = partial ? secured : []
    booking.razorpayPaymentId = paymentId
    if (orderId) booking.razorpayOrderId = orderId
    booking.updatedAt = new Date().toISOString()

    await write(data)
    return { booking: { ...booking }, conflicts, secured }
  })

  if (outcome.conflicts.length) {
    throw new ConfirmationConflictError(bookingId, outcome.conflicts, outcome.secured)
  }
  return outcome.booking
}

export async function releaseBooking(
  bookingId: string,
  status: Extract<BookingStatus, 'failed' | 'cancelled'> = 'failed',
): Promise<void> {
  return withLock(async () => {
    const data = await read()
    const booking = data.bookings[bookingId]
    if (!booking) return
    // Never un-book a paid slot.
    if (booking.status === 'confirmed') return

    const day = ensureDay(data, booking.date)
    for (const id of booking.slotIds) {
      const slot = day.slots[id]
      if (slot?.bookingId === bookingId && slot.status === 'held') {
        day.slots[id] = { status: 'available', bookingId: null, holdExpiresAt: null }
      }
    }

    booking.status = status
    booking.updatedAt = new Date().toISOString()
    await write(data)
  })
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const data = await read()
  return data.bookings[bookingId] ?? null
}

export async function findBookingByOrderId(orderId: string): Promise<Booking | null> {
  const data = await read()
  return Object.values(data.bookings).find((b) => b.razorpayOrderId === orderId) ?? null
}
