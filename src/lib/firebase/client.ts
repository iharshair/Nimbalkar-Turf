import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app'
import { type Firestore, getFirestore } from 'firebase/firestore'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/**
 * Whether real Firebase credentials are present. When false the app runs
 * in demo mode: the booking engine falls back to deterministic seed data
 * so the whole UX is reviewable without a project attached.
 */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

export const isDemoMode =
  process.env.NEXT_PUBLIC_FORCE_DEMO_MODE === 'true' || !isFirebaseConfigured

let app: FirebaseApp | null = null
let db: Firestore | null = null

function getFirebaseApp(): FirebaseApp | null {
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
        })
  }
  return app
}

/** Returns null in demo mode — every caller must handle that. */
export function getDb(): Firestore | null {
  const instance = getFirebaseApp()
  if (!instance) return null
  if (!db) db = getFirestore(instance)
  return db
}

// No Auth helper yet: nothing consumes it, and importing `firebase/auth`
// would add it to the client bundle for every visitor. Add one here when
// customer accounts are actually built — `getFirebaseApp()` is ready for it.
