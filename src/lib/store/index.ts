import { isAdminConfigured } from '@/lib/firebase/admin'
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
 * The local store is not durable: no cross-process locking, and an
 * ephemeral filesystem on serverless hosts. Taking real money with it
 * would mean silently losing bookings, so that combination is refused
 * outright rather than merely warned about.
 */
export function storageBlockedForLiveKeys(): boolean {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''
  return storeKind === 'local' && keyId.startsWith('rzp_live_')
}

export const STORAGE_BLOCKED_MESSAGE =
  'Live Razorpay keys are configured but Firestore is not. Refusing to take real payments ' +
  'into local file storage, which is not durable. Set FIREBASE_PROJECT_ID, ' +
  'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY before going live.'

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
