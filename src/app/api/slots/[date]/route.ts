import { NextResponse } from 'next/server'
import { getSlotDay, storeKind } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/slots/2026-07-28
 *
 * Availability for one day.
 *
 * Only needed when Firestore isn't configured: with Firebase the browser
 * subscribes to the document directly and gets push updates, which is both
 * cheaper and instant. This route is the fallback path so the local store's
 * bookings still show up in the grid.
 */
export async function GET(_request: Request, { params }: { params: { date: string } }) {
  const { date } = params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  try {
    const slots = await getSlotDay(date)
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
