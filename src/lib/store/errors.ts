import type { BookingStatus } from '@/types'

/**
 * Booking errors, shared by both storage backends.
 *
 * These live outside the Firestore module so the local JSON backend can
 * throw the identical types — the API routes then behave the same way
 * regardless of which store is active, and `instanceof` checks in the
 * route handlers keep working.
 */

/** Slots were taken between the customer choosing them and paying. */
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

/**
 * A payment succeeded but the slots are no longer ours — a hold that
 * lapsed during a slow UPI collect or 3-D Secure step-up, which another
 * customer then took.
 *
 * The money has been captured, so this must never be swallowed.
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
