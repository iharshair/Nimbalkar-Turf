import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin/auth'
import { clearNeedsAttention, getBookingById, markBookingRefunded } from '@/lib/admin/data'
import { bookingReference } from '@/lib/store'
import { createRefund, isRazorpayConfigured } from '@/lib/razorpay'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  bookingId: z.string().min(1).max(64),
  /** Omit for a full refund. Rupees. */
  amount: z.number().positive().max(200_000).optional(),
})

/**
 * POST /api/admin/refund — refund a booking and free its slots.
 *
 * Order of operations is deliberate: Razorpay first, Firestore second. If
 * the refund fails we haven't touched the booking, so staff can retry. If
 * the refund succeeds but the write fails, the money is back with the
 * customer and the booking stays flagged — which is the safe direction to
 * fail in, and the response says so explicitly.
 */
export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Not authorised' }, { status: 401 })

  if (!isRazorpayConfigured) {
    return NextResponse.json({ error: 'Razorpay is not configured' }, { status: 503 })
  }

  let input: z.infer<typeof schema>
  try {
    input = schema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  const booking = await getBookingById(input.bookingId)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  if (booking.status === 'refunded') {
    return NextResponse.json({ error: 'This booking has already been refunded.' }, { status: 409 })
  }

  // A booking that never captured a payment has nothing to refund — but its
  // slots may still be held, so clearing the flag is the right action.
  if (!booking.razorpayPaymentId) {
    await clearNeedsAttention(input.bookingId, session.email ?? session.uid)
    return NextResponse.json({
      ok: true,
      refunded: false,
      message: 'No payment was captured for this booking, so there is nothing to refund. Flag cleared.',
    })
  }

  if (input.amount !== undefined && input.amount > booking.amount) {
    return NextResponse.json(
      { error: `Cannot refund more than the ${booking.amount} paid.` },
      { status: 422 },
    )
  }

  let refund
  try {
    refund = await createRefund({
      paymentId: booking.razorpayPaymentId,
      amountInRupees: input.amount,
      receipt: bookingReference(input.bookingId),
      notes: { bookingId: input.bookingId, by: session.email ?? session.uid },
    })
  } catch (err) {
    console.error('[admin] Razorpay refund failed', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Razorpay refused the refund: ${err.message}`
            : 'Razorpay refused the refund.',
      },
      { status: 502 },
    )
  }

  try {
    await markBookingRefunded({
      bookingId: input.bookingId,
      refundId: refund.id,
      amount: input.amount ?? booking.amount,
      by: session.email ?? session.uid,
    })
  } catch (err) {
    console.error('[admin] refund recorded at Razorpay but not in Firestore', {
      bookingId: input.bookingId,
      refundId: refund.id,
      err,
    })
    return NextResponse.json(
      {
        error: `The refund went through at Razorpay (${refund.id}) but the booking could not be updated. The customer has their money. Update the booking by hand.`,
        refundId: refund.id,
      },
      { status: 500 },
    )
  }

  console.info('[admin] refund issued', {
    by: session.email,
    bookingId: input.bookingId,
    refundId: refund.id,
  })

  return NextResponse.json({
    ok: true,
    refunded: true,
    refundId: refund.id,
    message: `Refunded. Razorpay reference ${refund.id} — funds typically land in 5-7 working days.`,
  })
}
