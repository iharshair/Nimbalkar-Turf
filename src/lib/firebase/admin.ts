import { type App, cert, getApps, initializeApp } from 'firebase-admin/app'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'

/**
 * Firebase Admin — SERVER ONLY.
 *
 * This credential bypasses firestore.rules completely. It is the only
 * thing allowed to write availability, and it must never reach a browser.
 *
 * Three layers keep it server-side:
 *   1. The env vars have no NEXT_PUBLIC_ prefix, so Next.js will not
 *      inline them into the client bundle.
 *   2. The runtime guard below throws if this module is ever evaluated in
 *      a browser — which is what would happen if someone imported it from
 *      a client component by mistake.
 *   3. Only /api routes and scripts import it (or lib/store, which is
 *      itself server-only).
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'firebase/admin.ts was imported into client code. This module holds a ' +
      'credential that bypasses all security rules and must only be used in ' +
      'API routes or server components. Use lib/firebase/client.ts instead.',
  )
}

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
// Env vars can't hold real newlines, so the key ships with \n escapes.
// Some dotenv implementations expand them already, in which case this
// replace is a harmless no-op.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey)

/**
 * Explains precisely what's missing or malformed.
 *
 * A misquoted private key is by far the most common setup failure, and it
 * surfaces as an opaque JWT signing error deep inside the SDK. Better to
 * say so here.
 */
export function adminConfigProblem(): string | null {
  const missing = [
    !projectId ? 'FIREBASE_PROJECT_ID' : null,
    !clientEmail ? 'FIREBASE_CLIENT_EMAIL' : null,
    !privateKey ? 'FIREBASE_PRIVATE_KEY' : null,
  ].filter(Boolean)

  if (missing.length) return `Missing ${missing.join(', ')}`

  if (!privateKey!.includes('-----BEGIN PRIVATE KEY-----')) {
    return 'FIREBASE_PRIVATE_KEY does not look like a PEM key — check it is double-quoted and on one line with \\n escapes intact'
  }
  if (!privateKey!.includes('\n')) {
    return 'FIREBASE_PRIVATE_KEY has no line breaks — the \\n escapes were probably stripped; wrap the value in double quotes'
  }
  return null
}

let adminApp: App | null = null
let adminDb: Firestore | null = null

function getAdminApp(): App | null {
  if (!isAdminConfigured) return null

  if (!adminApp) {
    const problem = adminConfigProblem()
    if (problem) {
      console.error(`[firebase-admin] ${problem}`)
      return null
    }

    // Reuse across hot reloads; initialising twice throws.
    adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })

    console.info(`[firebase-admin] connected to project "${projectId}"`)
  }
  return adminApp
}

/** Null only when the service account is absent or malformed. */
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
