'use client'

import { type Auth, getAuth } from 'firebase/auth'
import { type FirebaseStorage, getStorage } from 'firebase/storage'
import type { Analytics } from 'firebase/analytics'
import { getDb, getFirebaseApp, isAnalyticsConfigured } from '@/lib/firebase/client'

/**
 * Reusable Firebase service instances: auth, db, storage, analytics.
 *
 * These are exposed as accessor functions rather than bare `export const`
 * values, for three concrete reasons:
 *
 *   1. SSR. This module is evaluated on the server during prerendering.
 *      `getAuth()` and `getAnalytics()` expect browser globals, so
 *      constructing them at module scope would crash the build.
 *   2. They can legitimately be absent. With no Firebase config the app
 *      still runs (bookings fall back to the local store), so the honest
 *      return type is `T | null` — which a bare const can't express
 *      without lying to every caller.
 *   3. Analytics is conditional. It requires `isSupported()` to resolve
 *      true, which is asynchronous, so it cannot be a synchronous const.
 *
 * Each getter memoises, so repeated calls are free.
 *
 * Kept out of `client.ts` on purpose: that module is imported by the
 * booking grid, so anything in it ships to every visitor. Import from here
 * only where the service is actually used.
 */

let auth: Auth | null = null
let storage: FirebaseStorage | null = null
let analytics: Analytics | null = null
let analyticsAttempted = false

/* ── Firestore ───────────────────────────────────────────────────────── */

/** Re-exported so all four services can be imported from one place. */
export { getDb } from '@/lib/firebase/client'

/* ── Authentication ──────────────────────────────────────────────────── */

/**
 * Firebase Auth, or null when unconfigured.
 *
 * Nothing in the site requires a signed-in user yet — booking is
 * deliberately guest-first, because forcing an account before someone can
 * book a pitch loses bookings. This is here for when customer accounts
 * (booking history, saved details) get built; `Booking.userId` already
 * carries the field.
 */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app) return null
  if (!auth) auth = getAuth(app)
  return auth
}

/* ── Storage ─────────────────────────────────────────────────────────── */

/**
 * Cloud Storage, or null when unconfigured.
 *
 * Intended use is gallery media: uploading real photos and videos so they
 * stop being the SVG placeholders in `public/media`. See `storage.rules` —
 * public read, authenticated write.
 */
export function getFirebaseStorage(): FirebaseStorage | null {
  const app = getFirebaseApp()
  if (!app) return null
  if (!storage) storage = getStorage(app)
  return storage
}

/* ── Analytics ───────────────────────────────────────────────────────── */

/**
 * Analytics, or null if the environment doesn't support it.
 *
 * Three gates, all necessary:
 *   • a measurement id must be configured (`isAnalyticsConfigured`),
 *   • we must be in a browser, not a server render,
 *   • `isSupported()` must resolve true — it returns false in some
 *     browsers, in private modes, and where IndexedDB is unavailable.
 *
 * The SDK is dynamically imported so it never enters the main bundle, and
 * a failure here is swallowed: analytics must never break the site.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analytics) return analytics
  if (analyticsAttempted) return analytics
  analyticsAttempted = true

  if (!isAnalyticsConfigured || typeof window === 'undefined') return null

  const app = getFirebaseApp()
  if (!app) return null

  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (!(await isSupported())) return null
    analytics = getAnalytics(app)
    return analytics
  } catch (err) {
    console.warn('[firebase] analytics unavailable', err)
    return null
  }
}

/**
 * Fire-and-forget custom event.
 *
 * Resolves silently when analytics isn't available, so callers never need
 * to branch on it. Example:
 *   void logAnalyticsEvent('booking_completed', { hours: 2, amount: 2400 })
 */
export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  const instance = await getFirebaseAnalytics()
  if (!instance) return
  try {
    const { logEvent } = await import('firebase/analytics')
    logEvent(instance, name, params)
  } catch {
    // Never let telemetry surface as a user-visible failure.
  }
}
