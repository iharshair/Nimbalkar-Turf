import { NextResponse } from 'next/server'
import { getSlotDay, storageUnavailableReason, storeKind } from '@/lib/store'
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rateLimit'
import type { SlotStatus } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Generous: the client polls every 20s and two hooks may share a page. */
const LIMIT = 60
const WINDOW_MS = 60_000

/**
 * What a browser is allowed to know about a slot.
 *
 * Deliberately NOT the stored record. That carries `bookingId`, which is
 * nobody else's business — it identifies another customer's booking, and
 * publishing it invites treating an id as a capability. `holdExpiresAt` is
 * included because the client needs it to decide whether a hold has
 * lapsed (see effectiveStatus).
 */
interface PublicSlot {
  status: SlotStatus
  holdExpiresAt?: number | null
}

/**
 * GET /api/slots/2026-07-28
 *
 * Availability for one day.
 *
 * Only needed when Firestore isn't configured: with Firebase the browser
 * subscribes to the document directly and gets push updates, which is both
 * cheaper and instant. This route is the fallback path so the local
 * store's bookings still show up in the grid — and it's what tells the
 * client which backend is authoritative.
 */
export async function GET(request: Request, { params }: { params: { date: string } }) {
  const limit = rateLimit(clientKey(request, 'slots'), LIMIT, WINDOW_MS)
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfter, 'Too many requests. Please slow down.')
  }

  const { date } = params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  /*
    Refuse rather than invent. Without a service account in production the
    local backend would try to seed a day onto a read-only filesystem;
    worse, if it succeeded it would serve plausible-looking availability
    that no booking can ever be written against. A 503 makes the client
    show its "indicative times" warning instead of quietly lying.
  */
  const storageProblem = storageUnavailableReason()
  if (storageProblem) {
    console.error(`[slots] refusing to serve availability — ${storageProblem}`)
    return NextResponse.json({ error: 'Availability is temporarily unavailable' }, { status: 503 })
  }

  try {
    const stored = await getSlotDay(date)

    const slots: Record<string, PublicSlot> = {}
    for (const [id, slot] of Object.entries(stored)) {
      slots[id] = { status: slot.status, holdExpiresAt: slot.holdExpiresAt ?? null }
    }

    return NextResponse.json(
      { date, slots, source: storeKind },
      // Availability is the one thing that must never be served stale.
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (err) {
    console.error('[slots] read failed', err)
    return NextResponse.json({ error: 'Could not load availability' }, { status: 500 })
  }
}
