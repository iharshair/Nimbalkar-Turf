/**
 * Seeds the availability grid.
 *
 *   npm run seed            # next 14 days
 *   npm run seed -- 30      # next 30 days
 *
 * Idempotent-ish: it will not overwrite a day that already has any
 * `booked` slot carrying a bookingId, so you can safely re-run this
 * against a live project without wiping real reservations.
 *
 * Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

import { bookingDates, seedSlotsForDate } from '../src/lib/slots'
import type { SlotDayDoc } from '../src/types'

/** Minimal .env.local reader so the script needs no extra dependency. */
function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), 'utf8')
      for (const line of raw.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
        if (!match) continue
        const [, key, rawValue] = match
        if (process.env[key]) continue
        process.env[key] = rawValue.replace(/^["']|["']$/g, '')
      }
    } catch {
      // File absent — fall through to the real environment.
    }
  }
}

async function main() {
  loadDotEnv()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      '\n  Missing Firebase Admin credentials.\n' +
        '  Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.\n',
    )
    process.exit(1)
  }

  const days = Number(process.argv[2] ?? 14)
  if (!Number.isFinite(days) || days < 1 || days > 120) {
    console.error('  Day count must be between 1 and 120.')
    process.exit(1)
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  }
  const db = getFirestore()

  const dates = bookingDates(days)
  let written = 0
  let skipped = 0

  // Chunked batches: Firestore caps a batch at 500 writes.
  for (let i = 0; i < dates.length; i += 400) {
    const chunk = dates.slice(i, i + 400)
    const batch = db.batch()

    for (const date of chunk) {
      const ref = db.collection('slotDays').doc(date)
      const existing = (await ref.get()).data() as SlotDayDoc | undefined

      const hasRealBookings = Object.values(existing?.slots ?? {}).some(
        (s) => s.status === 'booked' && Boolean(s.bookingId),
      )
      if (hasRealBookings) {
        skipped++
        console.log(`  skip  ${date}  (has real bookings)`)
        continue
      }

      batch.set(ref, {
        date,
        slots: seedSlotsForDate(date),
        updatedAt: FieldValue.serverTimestamp(),
      })
      written++
    }

    await batch.commit()
  }

  console.log(`\n  Seeded ${written} day(s), skipped ${skipped}.\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
