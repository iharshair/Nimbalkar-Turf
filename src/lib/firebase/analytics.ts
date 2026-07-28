'use client'

import type { Analytics } from 'firebase/analytics'
import { getFirebaseApp, isAnalyticsConfigured } from '@/lib/firebase/client'

/**
 * Firebase Analytics, isolated in its own module.
 *
 * Split from `services.ts` on purpose. Analytics is initialised in the root
 * layout, so it loads for every visitor — and `services.ts` statically
 * imports `firebase/auth` and `firebase/storage`, which would drag both
 * SDKs into the initial bundle for a site that currently uses neither.
 *
 * The Analytics SDK itself is dynamically imported, so it stays out of the
 * main chunk too.
 */

let analytics: Analytics | null = null
let attempted = false

/**
 * Returns Analytics, or null if the environment doesn't support it.
 *
 * Three gates, all necessary:
 *   • a measurement id must be configured,
 *   • we must be in a browser, not a server render,
 *   • `isSupported()` must resolve true — it returns false in some
 *     browsers, in private modes, and where IndexedDB is unavailable.
 *
 * Never throws: telemetry must not be able to break the page.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analytics || attempted) return analytics
  attempted = true

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
 * to branch on it:
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
