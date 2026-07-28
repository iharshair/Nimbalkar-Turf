/**
 * Human-readable booking reference.
 *
 * Lives in its own module so client components can format a reference
 * without pulling in firebase-admin (which is server-only).
 */
export function bookingReferenceFromId(bookingId: string): string {
  return `NSC-${bookingId.slice(0, 5).toUpperCase()}`
}
