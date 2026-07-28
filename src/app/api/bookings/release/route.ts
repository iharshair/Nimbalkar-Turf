import { NextResponse } from 'next/server'
import { z } from 'zod'
import { releaseBooking } from '@/lib/store'
import { verifyReleaseToken } from '@/lib/razorpay'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  bookingId: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
})

/**
 * POST /api/bookings/release
 *
 * Called when a customer dismisses the Razorpay window. Holds expire on
 * their own after 10 minutes, so this is a courtesy — it puts the slot
 * back in front of the next person immediately.
 *
 * A booking id alone is NOT authorisation. `slotDays` documents are
 * public-read (the grid streams to anonymous visitors) and they carry the
 * holding `bookingId`, so anyone could otherwise read an in-flight hold
 * out of the grid and cancel a stranger's checkout. The caller must
 * present the HMAC token that /api/razorpay/order issued to them.
 */
export async function POST(request: Request) {
  let input: z.infer<typeof schema>
  try {
    input = schema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  if (!verifyReleaseToken(input.bookingId, input.token)) {
    console.warn('[release] rejected — bad token', { bookingId: input.bookingId })
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  try {
    // releaseBooking additionally refuses to touch a confirmed booking, so
    // a paid slot can never be freed through this route.
    await releaseBooking(input.bookingId, 'cancelled')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[release] failed', err)
    // Not worth surfacing: the hold lapses on its own regardless.
    return NextResponse.json({ ok: false })
  }
}
