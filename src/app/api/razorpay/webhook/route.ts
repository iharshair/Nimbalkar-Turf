import { NextResponse } from 'next/server'
import { isAdminConfigured } from '@/lib/firebase/admin'
import {
  BookingNotConfirmableError,
  ConfirmationConflictError,
  bookingReference,
  confirmBooking,
  findBookingByOrderId,
  getBooking,
  releaseBooking,
} from '@/lib/firebase/bookings'
import { isWebhookConfigured, verifyWebhookSignature } from '@/lib/razorpay'
import { sendReceipts } from '@/lib/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/razorpay/webhook
 *
 * The safety net. If a customer closes the tab between paying and our
 * /verify call, Razorpay still tells us here — so the booking gets
 * confirmed and the slots don't quietly fall back to available.
 *
 * Configure in the Razorpay dashboard for `payment.captured` and
 * `payment.failed`, pointing at:
 *   https://<your-domain>/api/razorpay/webhook
 *
 * confirmBooking is idempotent, so a duplicate delivery is harmless.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured || !isWebhookConfigured) {
    // 200 so Razorpay doesn't retry against an unconfigured environment.
    console.info('[webhook] ignored — not configured')
    return NextResponse.json({ ignored: true })
  }

  // The signature covers the exact bytes, so read the body as raw text.
  const raw = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature || !verifyWebhookSignature(raw, signature)) {
    console.warn('[webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: {
    event?: string
    payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } } }
  }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const payment = event.payload?.payment?.entity
  const paymentId = payment?.id
  const orderId = payment?.order_id
  const noteBookingId = payment?.notes?.bookingId

  if (!paymentId || !orderId) {
    return NextResponse.json({ ignored: true })
  }

  // Prefer the id we put in notes; fall back to a lookup by order id.
  const bookingId =
    noteBookingId ?? (await findBookingByOrderId(orderId).then((b) => b?.id ?? null))

  if (!bookingId) {
    console.warn('[webhook] no booking for order', orderId)
    return NextResponse.json({ ignored: true })
  }

  try {
    // Only `captured` means the money is actually ours. `authorized`
    // can still fail to capture, and confirming on it would give away
    // slots for a payment that never settles.
    if (event.event === 'payment.captured') {
      const before = await getBooking(bookingId)
      const alreadyConfirmed = before?.status === 'confirmed'

      const booking = await confirmBooking({ bookingId, paymentId, orderId })

      // Only send receipts if /verify hadn't already done it.
      if (!alreadyConfirmed) {
        void sendReceipts({
          reference: bookingReference(bookingId),
          name: booking.name,
          phone: booking.phone,
          email: booking.email,
          date: booking.date,
          slotIds: booking.slotIds,
          amount: booking.amount,
          paymentId,
        })
      }
    } else if (event.event === 'payment.failed') {
      await releaseBooking(bookingId, 'failed')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfirmationConflictError) {
      // Committed and flagged for staff. Retrying can't help, so
      // acknowledge (200) rather than inviting endless redelivery.
      console.error('[webhook] slots lost before confirmation', {
        bookingId: err.bookingId,
        conflicts: err.conflicts,
        secured: err.secured,
      })
      return NextResponse.json({ ok: false, needsAttention: true })
    }
    if (err instanceof BookingNotConfirmableError) {
      console.warn('[webhook] ignoring payment for settled booking', {
        bookingId: err.bookingId,
        status: err.status,
      })
      return NextResponse.json({ ignored: true })
    }
    console.error('[webhook] processing failed', err)
    // 500 asks Razorpay to retry, which is what we want for a transient
    // Firestore error.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
