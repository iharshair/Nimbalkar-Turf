import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createOrderSchema } from '@/lib/schema'
import { totalForSlots } from '@/lib/pricing'
import {
  STORAGE_BLOCKED_MESSAGE,
  SlotUnavailableError,
  attachOrderId,
  bookingReference,
  holdSlots,
  newBookingId,
  storageBlockedForLiveKeys,
  storeKind,
} from '@/lib/store'
import {
  RAZORPAY_KEY_ID,
  createOrder,
  isRazorpayConfigured,
  issueReleaseToken,
} from '@/lib/razorpay'
import { isPastSlot } from '@/lib/slots'
import { describeSlotRanges } from '@/lib/utils'

/**
 * Demo mode must be decided here as well as on the client. If the server
 * ignored the flag, a staging demo would show fake availability while
 * charging real cards.
 */
const forceDemo = process.env.NEXT_PUBLIC_FORCE_DEMO_MODE === 'true'

/** Payments must never be cached or statically evaluated. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/razorpay/order
 *
 * Step 1 of checkout. This route is the trust boundary:
 *   • it re-prices the slots from the server-side rate card, so the
 *     amount can't be tampered with in the browser;
 *   • it holds the slots in a transaction, so two people can't both
 *     reach payment for the same hour;
 *   • it writes a `pending` booking that /verify later confirms.
 *
 * Without Razorpay or Firebase credentials it returns `demo: true` and the
 * client simulates a settled payment, so the flow stays reviewable.
 */
export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let input
  try {
    input = createOrderSchema.parse(payload)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message ?? 'Invalid booking details' },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: 'Invalid booking details' }, { status: 422 })
  }

  const { date, slotIds, details } = input
  // Deduplicate — the client shouldn't send repeats, but a repeated slot
  // would otherwise be charged twice.
  const uniqueSlots = Array.from(new Set(slotIds)).sort()
  const amount = totalForSlots(date, uniqueSlots)

  if (amount <= 0) {
    return NextResponse.json({ error: 'Could not price those slots' }, { status: 422 })
  }

  // The grid disables past hours, but the API is the boundary that counts —
  // a direct POST must not be able to buy this morning's 6 AM slot.
  const expired = uniqueSlots.filter((id) => isPastSlot(date, id))
  if (expired.length) {
    return NextResponse.json(
      {
        error: `${describeSlotRanges(expired).join(', ')} has already passed. Please choose a later hour.`,
        conflicts: expired,
      },
      { status: 409 },
    )
  }

  // ── Demo mode: nothing to persist, nothing to charge. ───────────────
  // Never take real money into storage that can't be trusted to keep it.
  if (storageBlockedForLiveKeys()) {
    console.error(`[order] ${STORAGE_BLOCKED_MESSAGE}`)
    return NextResponse.json(
      { error: 'Online payment is temporarily unavailable. Please call us to book.' },
      { status: 503 },
    )
  }

  // Demo mode is now only about Razorpay: bookings persist either way,
  // to Firestore or to the local store.
  if (forceDemo || !isRazorpayConfigured) {
    const reason = forceDemo
      ? 'NEXT_PUBLIC_FORCE_DEMO_MODE is set'
      : 'Razorpay keys not configured'
    console.info(`[order] demo mode — ${reason}`)

    return NextResponse.json({
      bookingId: `demo-${Date.now().toString(36)}`,
      amount,
      orderId: null,
      keyId: null,
      releaseToken: null,
      demo: true,
    })
  }

  const bookingId = newBookingId()

  try {
    await holdSlots({ bookingId, date, slotIds: uniqueSlots, details })
    console.info(`[order] held ${uniqueSlots.length} slot(s) in ${storeKind} store`, { bookingId })
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      // 409 — the client turns this into "those slots just went".
      return NextResponse.json(
        {
          error: `${describeSlotRanges(err.conflicts).join(', ')} has just been taken. Please choose another hour.`,
          conflicts: err.conflicts,
        },
        { status: 409 },
      )
    }
    console.error('[order] failed to hold slots', err)
    return NextResponse.json({ error: 'Could not reserve those slots' }, { status: 500 })
  }

  try {
    const order = await createOrder({
      amountInRupees: amount,
      receipt: bookingReference(bookingId),
      notes: {
        bookingId,
        date,
        slots: uniqueSlots.join(','),
        name: details.name,
        phone: details.phone,
      },
    })

    await attachOrderId(bookingId, order.id)

    return NextResponse.json({
      bookingId,
      amount,
      orderId: order.id,
      keyId: RAZORPAY_KEY_ID,
      // Capability token — the only way to release this hold early.
      releaseToken: issueReleaseToken(bookingId),
      demo: false,
    })
  } catch (err) {
    console.error('[order] Razorpay order creation failed', err)
    // The hold expires on its own; don't leave the customer guessing.
    return NextResponse.json(
      { error: 'Could not start the payment. Please try again.' },
      { status: 502 },
    )
  }
}
