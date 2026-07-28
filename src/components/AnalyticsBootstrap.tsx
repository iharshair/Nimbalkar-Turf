'use client'

import { useEffect } from 'react'
import { getFirebaseAnalytics } from '@/lib/firebase/analytics'

/**
 * Initialises Firebase Analytics once, after mount.
 *
 * Analytics doesn't self-start — something has to call `getAnalytics()`.
 * Without this, `services.ts` was never imported by anything, so a
 * configured measurement id collected precisely nothing.
 *
 * Deliberately a component rather than a call in `layout.tsx`: the root
 * layout is a server component, and `getAnalytics()` needs browser globals
 * plus an async `isSupported()` check. Renders nothing.
 *
 * Imports from `firebase/analytics.ts`, NOT `firebase/services.ts` —
 * services.ts statically pulls in the Auth and Storage SDKs, which would
 * then ship to every visitor for features nothing uses yet.
 */
export function AnalyticsBootstrap() {
  useEffect(() => {
    // Fire and forget: the helper resolves to null (never throws) when
    // Analytics is unconfigured or unsupported, and telemetry must never
    // be able to break the page.
    void getFirebaseAnalytics()
  }, [])

  return null
}
