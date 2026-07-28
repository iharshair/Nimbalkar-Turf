import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { COLLECTIONS, getAdminDb } from '@/lib/firebase/admin'
import { clubToday } from '@/lib/utils'
import type { Booking, BookingStatus, SlotDayDoc, SlotStatus, Sport, StoredSlot } from '@/types'

/**
 * Data access for the admin panel.
 *
 * Deliberately NOT part of the `BookingStore` abstraction. That exists so
 * the customer booking flow can fall back to a local JSON file in
 * development — but the admin panel can't run without a service account at
 * all, because staff sign-in depends on Firebase Auth's session cookies.
 * Adding these to the interface would mean writing a local implementation
 * that is unreachable by construction.
 *
 * Every function returns [] or null rather than throwing when Firestore is
 * absent, so an unconfigured deployment renders an empty panel instead of a
 * crash.
 */

function db() {
  return getAdminDb()
}

/* ── Reading documents ───────────────────────────────────────────────────
   Firestore hands back untyped data, so these turn `unknown` into the
   shape the panel needs. Written as narrowing helpers rather than a cast:

   `raw as Booking` doesn't compile, and shouldn't. `Booking` is an
   interface, so it gets no implicit index signature, which makes it and
   `Record<string, unknown>` mutually non-assignable — TypeScript is
   correctly pointing out that asserting between them proves nothing. And a
   cast would be a lie anyway: a document written by an older version of
   the app, or half-written by a failed transaction, genuinely might not
   have these fields.

   Mapping explicitly means a malformed document renders as a booking with
   sensible blanks instead of crashing the page staff use to handle
   problems. */

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** Empty strings collapse to null, so `{value ?? 'â€"'}` renders sensibly. */
function optStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function optNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/*
  Widened to readonly string[] so `.includes()` accepts an arbitrary string.
  `satisfies` still checks every member is a real BookingStatus, so adding a
  status to the union without adding it here is a compile error.
*/
const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'failed',
  'cancelled',
  'refunded',
] as const satisfies readonly BookingStatus[]

function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && (BOOKING_STATUSES as readonly string[]).includes(value)
}

const SPORTS = ['football', 'cricket', 'other'] as const satisfies readonly Sport[]

function isSport(value: unknown): value is Sport {
  return typeof value === 'string' && (SPORTS as readonly string[]).includes(value)
}

/**
 * Epoch millis from whatever the field actually holds.
 *
 * Firestore writes `Timestamp`, the local dev store writes ISO strings, and
 * a document read back straight after `serverTimestamp()` can hold null.
 */
function readMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

/** `fallbackId` is the document id, used when the stored `id` is missing. */
function toBooking(raw: Record<string, unknown>, fallbackId: string): Booking {
  return {
    id: str(raw.id, fallbackId),
    date: str(raw.date),
    slotIds: strList(raw.slotIds),
    amount: num(raw.amount),
    status: isBookingStatus(raw.status) ? raw.status : 'pending',
    name: str(raw.name),
    phone: str(raw.phone),
    email: optStr(raw.email),
    sport: isSport(raw.sport) ? raw.sport : 'other',
    whatsappOptIn: raw.whatsappOptIn === true,
    notes: optStr(raw.notes),
    userId: optStr(raw.userId),
    razorpayOrderId: optStr(raw.razorpayOrderId),
    razorpayPaymentId: optStr(raw.razorpayPaymentId),
    needsAttention: raw.needsAttention === true,
    conflictSlotIds: strList(raw.conflictSlotIds),
    securedSlotIds: strList(raw.securedSlotIds),
    refundId: optStr(raw.refundId),
    refundedAmount: optNum(raw.refundedAmount),
    refundedBy: optStr(raw.refundedBy),
    resolvedBy: optStr(raw.resolvedBy),
    createdAt: readMillis(raw.createdAt),
    updatedAt: readMillis(raw.updatedAt),
  }
}

/**
 * Bookings where money was captured but the slots were lost.
 *
 * This is the query that matters most: someone has paid and does not have
 * what they paid for. `confirmBooking` sets the flag; until this panel
 * existed, nothing ever read it back.
 */
export async function listNeedsAttention(): Promise<Booking[]> {
  const database = db()
  if (!database) return []

  // Single-field equality — served by the automatic index, no composite
  // index needed. Sorted in memory since the result set is tiny.
  const snap = await database
    .collection(COLLECTIONS.bookings)
    .where('needsAttention', '==', true)
    .limit(50)
    .get()

  return snap.docs
    .map((d) => toBooking(d.data(), d.id))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Confirmed bookings for one calendar day, earliest slot first. */
export async function listBookingsForDate(date: string): Promise<Booking[]> {
  const database = db()
  if (!database) return []

  const snap = await database
    .collection(COLLECTIONS.bookings)
    .where('date', '==', date)
    .limit(100)
    .get()

  return snap.docs
    .map((d) => toBooking(d.data(), d.id))
    .filter((b) => b.status === 'confirmed' || b.status === 'pending')
    .sort((a, b) => (a.slotIds[0] ?? '').localeCompare(b.slotIds[0] ?? ''))
}

/**
 * Confirmed bookings from today onwards.
 *
 * Uses the (status ASC, date ASC) composite index already declared in
 * firestore.indexes.json — equality plus a range on a different field
 * cannot be served by single-field indexes.
 */
export async function listUpcomingBookings(max = 60): Promise<Booking[]> {
  const database = db()
  if (!database) return []

  const snap = await database
    .collection(COLLECTIONS.bookings)
    .where('status', '==', 'confirmed')
    .where('date', '>=', clubToday())
    .orderBy('date', 'asc')
    .limit(max)
    .get()

  return snap.docs.map((d) => toBooking(d.data(), d.id))
}

/** Lookup for "someone is at the gate claiming they booked". */
export async function findBookingsByPhone(phone: string): Promise<Booking[]> {
  const database = db()
  if (!database) return []

  // Match the stored shape: schema.ts strips to 10 digits.
  const normalised = phone.replace(/[^\d]/g, '').slice(-10)
  if (normalised.length !== 10) return []

  const snap = await database
    .collection(COLLECTIONS.bookings)
    .where('phone', '==', normalised)
    .limit(25)
    .get()

  return snap.docs
    .map((d) => toBooking(d.data(), d.id))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const database = db()
  if (!database) return null
  const snap = await database.collection(COLLECTIONS.bookings).doc(bookingId).get()
  return snap.exists ? toBooking(snap.data() ?? {}, snap.id) : null
}

/**
 * Blocks or releases slots for maintenance.
 *
 * `blocked` already existed in SlotStatus and the booking grid already
 * renders it as "Maintenance" — nothing could ever set it until now.
 *
 * Refuses to touch a slot held or booked by a customer: taking the pitch
 * away from someone who has paid needs a refund conversation, not a
 * checkbox. Returns the slots it declined so the UI can say why.
 */
export async function setSlotStatus(
  date: string,
  slotIds: string[],
  status: Extract<SlotStatus, 'blocked' | 'available'>,
): Promise<{ changed: string[]; refused: string[] }> {
  const database = db()
  if (!database) return { changed: [], refused: slotIds }

  const ref = database.collection(COLLECTIONS.slotDays).doc(date)

  return database.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const stored = (snap.data() as SlotDayDoc | undefined)?.slots ?? {}

    const changed: string[] = []
    const refused: string[] = []
    const slots: Record<string, StoredSlot> = { ...stored }
    const now = Date.now()

    for (const id of slotIds) {
      const current = stored[id]
      const takenByCustomer =
        current?.status === 'booked' ||
        (current?.status === 'held' && (current.holdExpiresAt ?? 0) > now)

      if (takenByCustomer) {
        refused.push(id)
        continue
      }
      // Unblocking anything other than a blocked slot is a no-op, not an
      // error — it's already available.
      slots[id] = { status, bookingId: null, holdExpiresAt: null }
      changed.push(id)
    }

    if (changed.length) {
      tx.set(ref, { date, slots, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
    return { changed, refused }
  })
}

/**
 * Marks a booking refunded and returns its slots to the pool.
 *
 * Call only *after* Razorpay confirms the refund — this is the bookkeeping
 * half. `confirmBooking` refuses to re-confirm a `refunded` booking, so a
 * redelivered webhook can't quietly re-book these hours afterwards.
 */
export async function markBookingRefunded(params: {
  bookingId: string
  refundId: string
  amount: number
  by: string
}): Promise<void> {
  const database = db()
  if (!database) throw new Error('Firestore is not configured')

  const { bookingId, refundId, amount, by } = params
  const bookingRef = database.collection(COLLECTIONS.bookings).doc(bookingId)

  await database.runTransaction(async (tx) => {
    const bSnap = await tx.get(bookingRef)
    if (!bSnap.exists) throw new Error(`Booking ${bookingId} not found`)
    const booking = toBooking(bSnap.data() ?? {}, bookingId)

    const dayRef = database.collection(COLLECTIONS.slotDays).doc(booking.date)
    const daySnap = await tx.get(dayRef)
    const stored = (daySnap.data() as SlotDayDoc | undefined)?.slots ?? {}

    const slots: Record<string, StoredSlot> = { ...stored }
    for (const id of booking.slotIds) {
      // Only release what this booking actually holds — never free a slot
      // that has since been sold to someone else.
      if (stored[id]?.bookingId === bookingId) {
        slots[id] = { status: 'available', bookingId: null, holdExpiresAt: null }
      }
    }

    tx.set(dayRef, { date: booking.date, slots, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    tx.set(
      bookingRef,
      {
        status: 'refunded',
        needsAttention: false,
        refundId,
        refundedAmount: amount,
        refundedBy: by,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })
}

/** Clears the attention flag once staff have dealt with a booking. */
export async function clearNeedsAttention(bookingId: string, by: string): Promise<void> {
  const database = db()
  if (!database) throw new Error('Firestore is not configured')
  await database.collection(COLLECTIONS.bookings).doc(bookingId).set(
    {
      needsAttention: false,
      resolvedBy: by,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}
