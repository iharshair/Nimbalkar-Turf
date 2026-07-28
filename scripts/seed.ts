/**
 * Seeds the availability grid.
 *
 *   npm run seed              # next 14 days, every hour AVAILABLE
 *   npm run seed -- 30        # next 30 days
 *   npm run seed -- 14 --demo # fake "busy" pattern, for screenshots only
 *
 * The default opens every hour. That matters: this writes to a real
 * business's calendar, and the previous behaviour marked 30-60% of hours
 * `booked` with no corresponding booking — turning away paying customers
 * for reservations that never existed. The fabricated pattern is now
 * opt-in behind --demo, which additionally requires --yes to confirm.
 *
 * Days that already contain a real booking (a `booked` slot carrying a
 * bookingId) are always skipped, so re-running is safe.
 *
 * Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

import { ALL_HOURS, bookingDates, seedSlotsForDate, slotId } from '../src/lib/slots'
import type { StoredSlot } from '../src/types'
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

/** Every hour of the day, free. The correct default for a real ground. */
function openDay(): Record<string, StoredSlot> {
  const slots: Record<string, StoredSlot> = {}
  for (const hour of ALL_HOURS) {
    slots[slotId(hour)] = { status: 'available', bookingId: null, holdExpiresAt: null }
  }
  return slots
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

  const args = process.argv.slice(2)
  const demo = args.includes('--demo')
  const days = Number(args.find((a) => !a.startsWith('--')) ?? 14)

  // Writing fabricated "booked" hours to a live project turns away real
  // customers, so make it impossible to do by accident.
  if (demo && !args.includes('--yes')) {
    console.error(
      '\n  --demo writes FABRICATED bookings that block real customers from\n' +
        '  those hours. Only use it on a throwaway project.\n\n' +
        '  Re-run with --yes if that is really what you want:\n' +
        `    npm run seed -- ${days} --demo --yes\n`,
    )
    process.exit(1)
  }
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
        slots: demo ? seedSlotsForDate(date) : openDay(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      written++
    }

    await batch.commit()
  }

  console.log(
    `\n  Seeded ${written} day(s), skipped ${skipped}. ` +
      `${demo ? 'DEMO pattern (fabricated bookings).' : 'All hours open.'}\n`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
