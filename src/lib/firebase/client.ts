import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app'
import { type Firestore, getFirestore } from 'firebase/firestore'

/**
 * Firebase web app + Firestore.
 *
 * Auth, Storage and Analytics deliberately live in `./services.ts`, not
 * here. This module is imported by the booking grid, so anything added to
 * it ships to every visitor. Keeping the heavier SDKs in a separate module
 * means they're only downloaded on pages that actually use them.
 *
 * Note on the prefix: Next.js only inlines `NEXT_PUBLIC_*` variables into
 * the client bundle. A `VITE_*` name (or any other prefix) would read as
 * `undefined` in the browser and Firebase would silently never start.
 *
 * These values are public by design — they identify the project, they
 * don't authorise anything. Access control lives in firestore.rules and
 * storage.rules.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const

/** True when the web config is present. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

/**
 * Analytics needs a measurement id on top of the base config. Absent one,
 * the project simply doesn't have Analytics enabled.
 */
export const isAnalyticsConfigured = isFirebaseConfigured && Boolean(config.measurementId)

// Note: there is deliberately no `isDemoMode` here. Payment mode and
// storage mode are independent — see src/lib/runtime.ts, which is the
// single place that reasons about what is actually wired up.

let app: FirebaseApp | null = null
let db: Firestore | null = null

/**
 * The shared FirebaseApp, or null when unconfigured.
 *
 * `getApps().length` guards against Next.js's dev-mode hot reload
 * re-running module initialisation, which would otherwise throw
 * "Firebase App named '[DEFAULT]' already exists".
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (!app) {
    app = getApps().length
      ? getApp()
      : initializeApp({
          apiKey: config.apiKey!,
          authDomain: config.authDomain,
          projectId: config.projectId!,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId!,
          ...(config.measurementId ? { measurementId: config.measurementId } : {}),
        })
  }
  return app
}

/** Returns null when unconfigured — every caller must handle that. */
export function getDb(): Firestore | null {
  const instance = getFirebaseApp()
  if (!instance) return null
  if (!db) db = getFirestore(instance)
  return db
}
