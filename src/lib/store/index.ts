import { adminConfigProblem, isAdminConfigured } from '@/lib/firebase/admin'
import * as firestore from '@/lib/firebase/bookings'
import * as local from '@/lib/store/local'
import type { Booking, BookingStatus, StoredSlot } from '@/types'
import type { BookingDetails } from '@/lib/schema'

export {
  BookingNotConfirmableError,
  ConfirmationConflictError,
  SlotUnavailableError,
} from '@/lib/store/errors'
export { bookingReferenceFromId as bookingReference } from '@/lib/reference'

/**
 * Chooses the booking store.
 *
 * Firestore when a service account is configured; otherwise a local JSON
 * file. This exists so Razorpay and Firebase can be set up independently —
 * the payment flow, slot holds and double-booking protection all work with
 * test keys alone, and switching to Firestore is purely a matter of
 * filling in env vars.
 */
export type StoreKind = 'firestore' | 'local'

/**
 * The contract both backends satisfy.
 *
 * Declared explicitly rather than inferred from a ternary: two module
 * namespaces produce a union type, and calling a method on a union of
 * near-identical signatures is exactly the case TypeScript refuses to
 * resolve. Naming the shape also means adding a backend is a compile
 * error until it's complete.
 */
export interface BookingStore {
  newBookingId(): string
  getSlotDay(date: string): Promise<Record<string, StoredSlot>>
  holdSlots(params: {
    bookingId: string
    date: string
    slotIds: string[]
    details: BookingDetails
    userId?: string | null
  }): Promise<{ bookingId: string; amount: number; holdExpiresAt: number }>
  attachOrderId(bookingId: string, orderId: string): Promise<void>
  confirmBooking(params: {
    bookingId: string
    paymentId: string
    orderId?: string
  }): Promise<Booking>
  releaseBooking(
    bookingId: string,
    status?: Extract<BookingStatus, 'failed' | 'cancelled'>,
  ): Promise<void>
  getBooking(bookingId: string): Promise<Booking | null>
  findBookingByOrderId(orderId: string): Promise<Booking | null>
}

export const storeKind: StoreKind = isAdminConfigured ? 'firestore' : 'local'

const firestoreStore: BookingStore = firestore
const localStore: BookingStore = local
const backend: BookingStore = isAdminConfigured ? firestoreStore : localStore

/**
 * Whether bookings can be accepted at all, and why not if they can't.
 *
 * Firestore is now the real store. The local JSON backend survives only as
 * a development convenience so a fresh clone can run the booking flow
 * without credentials — it has no cross-process locking, and serverless
 * filesystems are ephemeral, so it loses data.
 *
 * Two situations therefore refuse the booking outright instead of quietly
 * degrading, because silently accepting money into storage that forgets it
 * is the worst possible failure:
 *
 *   • a production build without Firestore
 *   • live Razorpay keys without Firestore, in any environment
 *
 * Returns null when it is safe to proceed.
 */
export function storageUnavailableReason(): string | null {
  if (storeKind === 'firestore') return null

  const detail = adminConfigProblem() ?? 'Firebase Admin credentials are not set'
  const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''

  if (process.env.NODE_ENV === 'production') {
    return `Production requires Firestore. ${detail}.`
  }
  if (razorpayKeyId.startsWith('rzp_live_')) {
    return `Live Razorpay keys require Firestore. ${detail}.`
  }
  return null
}

/* ── Unified API ─────────────────────────────────────────────────────── */

export const newBookingId: BookingStore['newBookingId'] = () => backend.newBookingId()

export const getSlotDay: BookingStore['getSlotDay'] = (date) => backend.getSlotDay(date)

export const holdSlots: BookingStore['holdSlots'] = (params) => backend.holdSlots(params)

export const attachOrderId: BookingStore['attachOrderId'] = (bookingId, orderId) =>
  backend.attachOrderId(bookingId, orderId)

export const confirmBooking: BookingStore['confirmBooking'] = (params) =>
  backend.confirmBooking(params)

export const releaseBooking: BookingStore['releaseBooking'] = (bookingId, status = 'failed') =>
  backend.releaseBooking(bookingId, status)

export const getBooking: BookingStore['getBooking'] = (bookingId) => backend.getBooking(bookingId)

export const findBookingByOrderId: BookingStore['findBookingByOrderId'] = (orderId) =>
  backend.findBookingByOrderId(orderId)
