import { NextResponse } from 'next/server'
import { adminConfigProblem, getAdminDb, isAdminConfigured } from '@/lib/firebase/admin'
import { isFirebaseConfigured } from '@/lib/firebase/client'
import { isRazorpayConfigured, isWebhookConfigured } from '@/lib/razorpay'
import { storageUnavailableReason, storeKind } from '@/lib/store'
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { clubToday } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/health
 *
 * Answers "is Firebase actually connected, and can we take a payment?"
 * without needing the Vercel logs.
 *
 * Deliberately exposes NO secrets: booleans, the already-public project
 * id, the Razorpay key *mode* (test/live — never the key), and config
 * hints like "Missing FIREBASE_CLIENT_EMAIL". Nothing here helps an
 * attacker who can already read the client bundle.
 *
 * The Firestore probe is a real read, so a `true` here means credentials
 * work and rules permit it — not merely that env vars are present.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, 'health'), 20, 60_000)
  if (!limit.ok) return tooManyRequests(limit.retryAfter, 'Too many requests.')

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''
  const razorpayMode = keyId.startsWith('rzp_live_')
    ? 'live'
    : keyId.startsWith('rzp_test_')
      ? 'test'
      : 'not-configured'

  // Real round trip to Firestore, so this can't pass on config alone.
  let firestoreRead: { ok: boolean; detail: string } = {
    ok: false,
    detail: 'Not attempted — Admin SDK is not configured',
  }
  if (isAdminConfigured) {
    try {
      const db = getAdminDb()
      if (!db) throw new Error('Admin SDK returned no Firestore instance')
      const snap = await db.collection('slotDays').doc(clubToday()).get()
      firestoreRead = {
        ok: true,
        detail: snap.exists
          ? `Read slotDays/${clubToday()} — seeded`
          : `Connected, but slotDays/${clubToday()} does not exist yet. Run: npm run seed`,
      }
    } catch (err) {
      firestoreRead = {
        ok: false,
        detail: err instanceof Error ? err.message.slice(0, 300) : 'Unknown Firestore error',
      }
    }
  }

  const blocked = storageUnavailableReason()

  const body = {
    ok: isRazorpayConfigured && firestoreRead.ok && !blocked,
    environment: process.env.NODE_ENV,
    bookingsAccepted: !blocked,
    blockedReason: blocked,
    store: storeKind,
    firebase: {
      // NEXT_PUBLIC_* present at build time → the browser can read Firestore.
      clientConfigured: isFirebaseConfigured,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      // Service account present → the server can write bookings.
      adminConfigured: isAdminConfigured,
      adminProblem: adminConfigProblem(),
      firestoreRead,
    },
    razorpay: {
      configured: isRazorpayConfigured,
      mode: razorpayMode,
      // Absent only means /verify carries the happy path alone.
      webhookConfigured: isWebhookConfigured,
    },
  }

  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
