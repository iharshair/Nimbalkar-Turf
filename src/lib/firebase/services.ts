'use client'

import { type Auth, getAuth } from 'firebase/auth'
import { type FirebaseStorage, getStorage } from 'firebase/storage'
import { getFirebaseApp } from '@/lib/firebase/client'

/**
 * Firebase Auth and Storage.
 *
 * IMPORTANT — nothing imports this module yet, and that is deliberate.
 * Both SDKs are imported statically here, so importing this module
 * anywhere in the initial render tree pulls both into the client bundle
 * (~60 KB gzipped combined). Analytics therefore lives in its own module,
 * `./analytics.ts`, because it *is* loaded on every page.
 *
 * Import from here only in the feature that actually needs it, and prefer
 * a route-level or dynamic import so the cost lands on the page that uses
 * it rather than the homepage.
 *
 * Exposed as accessor functions rather than bare `export const` values:
 *   1. This module is evaluated during SSR, where `getAuth()` has no
 *      browser globals to work with.
 *   2. They legitimately return null when Firebase isn't configured, so
 *      `T | null` is the honest type.
 * Each getter memoises, so repeated calls are free.
 */

let auth: Auth | null = null
let storage: FirebaseStorage | null = null

/** Re-exported so db/auth/storage can be reached from one place. */
export { getDb } from '@/lib/firebase/client'

/**
 * Firebase Auth, or null when unconfigured.
 *
 * No consumer yet: booking is guest-first by design, because requiring an
 * account before someone can reserve a pitch loses bookings. This is the
 * seam for customer accounts (booking history, saved details) — the
 * `Booking.userId` field already exists to hang them on.
 */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app) return null
  if (!auth) auth = getAuth(app)
  return auth
}

/**
 * Cloud Storage, or null when unconfigured.
 *
 * No consumer yet: gallery media is still the generated SVG placeholders
 * in `public/media`. This is what real photography will be uploaded
 * through — see `storage.rules` for the access model (public read,
 * admin-only write with size and content-type ceilings).
 */
export function getFirebaseStorage(): FirebaseStorage | null {
  const app = getFirebaseApp()
  if (!app) return null
  if (!storage) storage = getStorage(app)
  return storage
}
