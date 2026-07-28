import { FieldValue } from 'firebase-admin/firestore'
import { COLLECTIONS, getAdminDb } from '@/lib/firebase/admin'
import { HOLD_TTL_MS, effectiveStatus } from '@/lib/slots'
import { totalForSlots } from '@/lib/pricing'
import type { Booking, BookingStatus, SlotDayDoc, StoredSlot } from '@/types'
import type { BookingDetails } from '@/lib/schema'

/**
 * Server-side booking lifecycle.
 *
 * Concurrency model — the thing that stops two teams paying for the
 * same 9 PM slot:
 *
 *   1. HOLD    /api/razorpay/order opens a Firestore transaction, checks
 *              every requested slot is free, and marks them `held` with a
 *              10-minute TTL. The transaction fails on any conflict, so
 *              only one of two simultaneous requests can win.
 *   2. CONFIRM /api/razorpay/verify flips `held` → `booked` after the
 *              payment signature checks out. Idempotent, because the
 *              webhook may arrive for the same payment as well.
 *   3. EXPIRE  An abandoned checkout needs no cleanup job: a `held` slot
 *              whose TTL has lapsed reads as available everywhere
 *              (see `effectiveStatus`).
 */

export class SlotUnavailableError extends Error {
  constructor(public readonly conflicts: string[]) {
    super(
      conflicts.length === 1
        ? `Slot ${conflicts[0]} was just taken`
        : `${conflicts.length} of your slots were just taken`,
    )
    this.name = 'SlotUnavailableError'
  }
}

function slotDayRef(date: string) {
  const db = getAdminDb()
  if (!db) throw new Error('Firebase Admin is not configured')
  return db.collection(COLLECTIONS.slotDays).doc(date)
}

function bookingRef(bookingId: string) {
  const db = getAdminDb()
  if (!db) throw new Error('Firebase Admin is not configured')
  return db.collection(COLLECTIONS.bookings).doc(bookingId)
}

export function newBookingId(): string {
  const db = getAdminDb()
  if (!db) throw new Error('Firebase Admin is not configured')
  return db.collection(COLLECTIONS.bookings).doc().id
}

/** Short human reference printed on the confirmation: NSC-7F3K2. */
export { bookingReferenceFromId as bookingReference } from '@/lib/reference'

export interface HoldResult {
  bookingId: string
  amount: number
  holdExpiresAt: number
}

/**
 * Reserves slots and writes a `pending` booking. Throws
 * SlotUnavailableError if any slot is no longer free.
 */
export async function holdSlots(params: {
  bookingId: string
  date: string
  slotIds: string[]
  details: BookingDetails
  userId?: string | null
}): Promise<HoldResult> {
  const db = getAdminDb()
  if (!db) throw new Error('Firebase Admin is not configured')

  const { bookingId, date, slotIds, details, userId } = params
  // Price is computed server-side from the rate card. A tampered client
  // total can never reach Razorpay.
  const amount = totalForSlots(date, slotIds)
  const holdExpiresAt = Date.now() + HOLD_TTL_MS

  await db.runTransaction(async (tx) => {
    const dayRef = slotDayRef(date)
    const snap = await tx.get(dayRef)
    const stored = (snap.data() as SlotDayDoc | undefined)?.slots ?? {}

    const conflicts = slotIds.filter((id) => effectiveStatus(stored[id]) !== 'available')
    if (conflicts.length) throw new SlotUnavailableError(conflicts)

    const slots: Record<string, StoredSlot> = { ...stored }
    for (const id of slotIds) {
      slots[id] = { status: 'held', bookingId, holdExpiresAt }
    }

    // Whole-map write is safe: the transaction read the doc, so any
    // concurrent change aborts and retries us.
    tx.set(dayRef, { date, slots, updatedAt: FieldValue.serverTimestamp() }, { merge: true })

    tx.set(bookingRef(bookingId), {
      id: bookingId,
      date,
      slotIds,
      amount,
      status: 'pending' satisfies BookingStatus,
      name: details.name,
      phone: details.phone,
      email: details.email || null,
      sport: details.sport,
      whatsappOptIn: details.whatsappOptIn,
      notes: details.notes || null,
      userId: userId ?? null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  return { bookingId, amount, holdExpiresAt }
}

export async function attachOrderId(bookingId: string, orderId: string): Promise<void> {
  await bookingRef(bookingId).set(
    { razorpayOrderId: orderId, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
}

/**
 * Raised when a payment succeeded but the slots are no longer ours —
 * a hold that lapsed during a slow UPI collect or 3-D Secure step-up, and
 * that another customer then took.
 *
 * The money has been captured, so this must never be swallowed: the
 * booking is flagged `needsAttention` for staff and the customer is told
 * to call us. Silently returning "confirmed" here would hand someone a
 * receipt for hours they don't own.
 */
export class ConfirmationConflictError extends Error {
  constructor(
    public readonly bookingId: string,
    /** Slots another booking took while payment was in flight. */
    public readonly conflicts: string[],
    /** Slots we did manage to secure — the customer keeps these. */
    public readonly secured: string[],
  ) {
    super(`Booking ${bookingId} lost ${conflicts.length} slot(s) before confirmation`)
    this.name = 'ConfirmationConflictError'
  }
}

/** A payment arrived for a booking that has already been refunded. */
export class BookingNotConfirmableError extends Error {
  constructor(
    public readonly bookingId: string,
    public readonly status: BookingStatus,
  ) {
    super(`Booking ${bookingId} cannot be confirmed from status "${status}"`)
    this.name = 'BookingNotConfirmableError'
  }
}

/**
 * Marks a booking paid and its slots permanently booked.
 * Idempotent — safe to call from both /verify and the webhook.
 */
export async function confirmBooking(params: {
  bookingId: string
  paymentId: string
  orderId?: string
}): Promise<Booking> {
  const db = getAdminDb()
  if (!db) throw new Error('Firebase Admin is not configured')

  const { bookingId, paymentId, orderId } = params

  const outcome = await db.runTransaction(async (tx) => {
    const bRef = bookingRef(bookingId)
    const bSnap = await tx.get(bRef)
    if (!bSnap.exists) throw new Error(`Booking ${bookingId} not found`)

    const booking = bSnap.data() as Booking

    // Already processed by the other path — return as-is.
    if (booking.status === 'confirmed') {
      return { booking, conflicts: [] as string[], secured: booking.slotIds }
    }

    // A refunded booking must never be re-confirmed by a redelivered
    // webhook. Every other status may be: `cancelled` and `failed` can
    // both belong to a payment that actually did settle, and a captured
    // payment has to end up either confirmed or flagged — never dropped.
    if (booking.status === 'refunded') {
      throw new BookingNotConfirmableError(bookingId, booking.status)
    }

    const dayRef = slotDayRef(booking.date)
    const daySnap = await tx.get(dayRef)
    const stored = (daySnap.data() as SlotDayDoc | undefined)?.slots ?? {}

    // Re-establish which slots are still ours. One belongs to us if it is
    // unclaimed or already claimed by this booking.
    const now = Date.now()
    const conflicts = booking.slotIds.filter((id) => {
      const current = stored[id]
      if (!current || current.bookingId === bookingId) return false
      if (current.status === 'booked' || current.status === 'blocked') return true
      // A live hold owned by someone else is equally off-limits; a lapsed
      // one is not.
      return current.status === 'held' && (current.holdExpiresAt ?? 0) > now
    })

    const secured = booking.slotIds.filter((id) => !conflicts.includes(id))

    // Claim everything we still own, even on a partial conflict. Aborting
    // the lot would let uncontested hours the customer paid for lapse back
    // into the pool on TTL.
    const slots: Record<string, StoredSlot> = { ...stored }
    for (const id of secured) {
      slots[id] = { status: 'booked', bookingId, holdExpiresAt: null }
    }

    tx.set(
      dayRef,
      { date: booking.date, slots, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )

    const partial = conflicts.length > 0

    tx.set(
      bRef,
      {
        // Partial bookings stay `pending` so they can't be mistaken for
        // fulfilled, and carry the detail staff need to reconcile.
        status: (partial ? 'pending' : 'confirmed') satisfies BookingStatus,
        needsAttention: partial,
        conflictSlotIds: conflicts,
        securedSlotIds: partial ? secured : [],
        razorpayPaymentId: paymentId,
        ...(orderId ? { razorpayOrderId: orderId } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return {
      booking: { ...booking, status: 'confirmed' as const, razorpayPaymentId: paymentId },
      conflicts,
      secured,
    }
  })

  // Thrown AFTER the transaction commits, never inside it: throwing from
  // the callback rolls the whole thing back, which would discard the
  // needsAttention flag and the partial claim along with it.
  if (outcome.conflicts.length) {
    throw new ConfirmationConflictError(bookingId, outcome.conflicts, outcome.secured)
  }

  return outcome.booking
}

/** Releases held slots after an abandoned or failed payment. */
export async function releaseBooking(
  bookingId: string,
  status: Extract<BookingStatus, 'failed' | 'cancelled'> = 'failed',
): Promise<void> {
  const db = getAdminDb()
  if (!db) throw new Error('Firebase Admin is not configured')

  await db.runTransaction(async (tx) => {
    const bRef = bookingRef(bookingId)
    const bSnap = await tx.get(bRef)
    if (!bSnap.exists) return

    const booking = bSnap.data() as Booking
    // Never un-book a paid slot.
    if (booking.status === 'confirmed') return

    const dayRef = slotDayRef(booking.date)
    const daySnap = await tx.get(dayRef)
    const stored = (daySnap.data() as SlotDayDoc | undefined)?.slots ?? {}

    const slots: Record<string, StoredSlot> = { ...stored }
    for (const id of booking.slotIds) {
      // Only release what this booking is actually holding.
      if (stored[id]?.bookingId === bookingId && stored[id]?.status === 'held') {
        slots[id] = { status: 'available', bookingId: null, holdExpiresAt: null }
      }
    }

    tx.set(
      dayRef,
      { date: booking.date, slots, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    tx.set(bRef, { status, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  })
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const db = getAdminDb()
  if (!db) return null
  const snap = await bookingRef(bookingId).get()
  return snap.exists ? (snap.data() as Booking) : null
}

/** Looks up a booking by Razorpay order id — used by the webhook. */
export async function findBookingByOrderId(orderId: string): Promise<Booking | null> {
  const db = getAdminDb()
  if (!db) return null
  const q = await db
    .collection(COLLECTIONS.bookings)
    .where('razorpayOrderId', '==', orderId)
    .limit(1)
    .get()
  return q.empty ? null : (q.docs[0].data() as Booking)
}
