import { type App, cert, getApps, initializeApp } from 'firebase-admin/app'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'

/**
 * Server-only Firebase Admin. Used by the /api routes and the seed
 * script — the only paths allowed to write availability, per
 * firestore.rules.
 */

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
// Env vars can't hold real newlines, so the key ships with \n escapes.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey)

let adminApp: App | null = null
let adminDb: Firestore | null = null

export function getAdminApp(): App | null {
  if (!isAdminConfigured) return null
  if (!adminApp) {
    adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        })
  }
  return adminApp
}

/** Null when the service account is not configured (demo mode). */
export function getAdminDb(): Firestore | null {
  const app = getAdminApp()
  if (!app) return null
  if (!adminDb) {
    adminDb = getFirestore(app)
    adminDb.settings({ ignoreUndefinedProperties: true })
  }
  return adminDb
}

export const COLLECTIONS = {
  slotDays: 'slotDays',
  bookings: 'bookings',
  customers: 'customers',
} as const
