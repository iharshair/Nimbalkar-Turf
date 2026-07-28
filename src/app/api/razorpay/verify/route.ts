import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { verifyPaymentSchema } from '@/lib/schema'
import {
  BookingNotConfirmableError,
  ConfirmationConflictError,
  bookingReference,
  confirmBooking,
  getBooking,
} from '@/lib/store'
import { describeSlotRanges } from '@/lib/utils'
import { isRazorpayConfigured, verifyPaymentSignature } from '@/lib/razorpay'
import { sendReceipts } from '@/lib/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/razorpay/verify
 *
 * Step 2 of checkout. Confirms a booking only after the HMAC signature
 * from Razorpay Checkout validates against our key secret. A payment is
 * never trusted on the client's word.
 */
export async function POST(request: Request) {
  if (!isRazorpayConfigured) {
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let input
  try {
    input = verifyPaymentSchema.parse(payload)
  } catch (err) {
    const message = err instanceof ZodError ? 'Incomplete payment details' : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = input

  const signatureValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  })

  if (!signatureValid) {
    console.warn('[verify] signature mismatch', { bookingId, orderId: razorpay_order_id })
    return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 })
  }

  // The signature proves the payment; this proves it belongs to this
  // booking. Both must hold.
  const existing = await getBooking(bookingId)
  if (!existing) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  // Strict equality, with no exemption for a missing value: /order always
  // attaches the id before checkout opens, so a null here means this
  // payment cannot be shown to belong to this booking.
  if (existing.razorpayOrderId !== razorpay_order_id) {
    console.warn('[verify] order/booking mismatch', {
      bookingId,
      expected: existing.razorpayOrderId,
      received: razorpay_order_id,
    })
    return NextResponse.json({ error: 'Payment does not match this booking' }, { status: 409 })
  }

  // Captured before confirming: if the webhook got here first it already
  // sent the receipts, and firing them again means the customer gets two
  // emails and two texts for one booking.
  const alreadyConfirmed = existing.status === 'confirmed'

  try {
    const booking = await confirmBooking({
      bookingId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    })

    if (!alreadyConfirmed) {
      /*
        Awaited, not fire-and-forget. A serverless runtime freezes the
        instance as soon as the response is returned, so a dangling
        promise here would have its HTTP calls cancelled mid-flight and
        the receipt would silently never arrive. sendReceipts swallows its
        own failures, so awaiting cannot fail the booking — it only costs
        a few hundred milliseconds on a screen the customer has already
        finished interacting with.
      */
      await sendReceipts({
        reference: bookingReference(bookingId),
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        date: booking.date,
        slotIds: booking.slotIds,
        amount: booking.amount,
        paymentId: razorpay_payment_id,
      })
    }

    return NextResponse.json({
      ok: true,
      bookingId,
      reference: bookingReference(bookingId),
      paymentId: razorpay_payment_id,
      amount: booking.amount,
      date: booking.date,
      slotIds: booking.slotIds,
    })
  } catch (err) {
    if (err instanceof ConfirmationConflictError) {
      // Paid, but a hold lapsed and someone else took part of it. The
      // booking is flagged `needsAttention` and whatever we did secure is
      // already booked. Be straight with the customer.
      console.error('[verify] slots lost before confirmation', {
        bookingId,
        conflicts: err.conflicts,
        secured: err.secured,
      })
      const lost = describeSlotRanges(err.conflicts).join(', ')
      const kept = err.secured.length ? describeSlotRanges(err.secured).join(', ') : null
      return NextResponse.json(
        {
          error: kept
            ? `Your payment went through and ${kept} is confirmed, but ${lost} was taken while it was processing. Call us and we will move that hour or refund the difference.`
            : `Your payment went through, but ${lost} was taken while it was processing. Call us and we will move you to the next free slot or refund you in full.`,
          needsAttention: true,
        },
        { status: 409 },
      )
    }
    if (err instanceof BookingNotConfirmableError) {
      console.error('[verify] booking not confirmable', { bookingId, status: err.status })
      return NextResponse.json(
        { error: 'This booking has already been settled. Please call us.' },
        { status: 409 },
      )
    }
    console.error('[verify] confirmation failed', err)
    // The money is taken but our write failed — say so honestly and give
    // them a way to reach a human.
    return NextResponse.json(
      {
        error:
          'Your payment went through but we could not save the booking. Please call us and we will confirm it manually.',
      },
      { status: 500 },
    )
  }
}
