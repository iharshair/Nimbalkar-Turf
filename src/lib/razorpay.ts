import crypto from 'node:crypto'
import Razorpay from 'razorpay'

/** Server-only Razorpay helpers. Never import this into a client component. */

const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
// RAZORPAY_SECRET is accepted as an alias: it's what the Razorpay
// dashboard calls the field, and mismatched naming here fails in a way
// that looks like "payments just don't work".
const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

export const isRazorpayConfigured = Boolean(keyId && keySecret)
export const RAZORPAY_KEY_ID = keyId ?? null
/** True for rzp_test_* keys — used to label the UI honestly. */
export const isRazorpayTestMode = (keyId ?? '').startsWith('rzp_test_')

let client: Razorpay | null = null

export function getRazorpay(): Razorpay | null {
  if (!isRazorpayConfigured) return null
  if (!client) client = new Razorpay({ key_id: keyId!, key_secret: keySecret! })
  return client
}

export interface CreatedOrder {
  id: string
  amount: number
  currency: string
}

/** Creates an order. `amountInRupees` is converted to paise here, once. */
export async function createOrder(params: {
  amountInRupees: number
  receipt: string
  notes?: Record<string, string>
}): Promise<CreatedOrder> {
  const rzp = getRazorpay()
  if (!rzp) throw new Error('Razorpay is not configured')

  // No `payment_capture` flag: it's a legacy field that the current SDK
  // types reject, and auto-capture is the account-level default.
  const order = await rzp.orders.create({
    amount: Math.round(params.amountInRupees * 100),
    currency: 'INR',
    // Razorpay caps receipt at 40 chars.
    receipt: params.receipt.slice(0, 40),
    notes: params.notes,
  })

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  }
}

/**
 * Verifies a Checkout success payload.
 *
 * Razorpay signs `${order_id}|${payment_id}` with the key secret. Without
 * this check anyone could POST a fabricated payment id and get a
 * confirmed booking, so this is the only thing standing between the
 * client and free turf.
 */
export function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  if (!keySecret) return false

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex')

  return timingSafeEqual(expected, params.signature)
}

/**
 * Capability token for /api/bookings/release.
 *
 * Slot documents are public-read, so a booking id is visible to any
 * anonymous visitor. Without a token, anyone could cancel a stranger's
 * in-flight hold just by reading the availability grid. The token is
 * issued alongside the order and only the holder can release the hold.
 */
export function issueReleaseToken(bookingId: string): string | null {
  if (!keySecret) return null
  return crypto.createHmac('sha256', keySecret).update(`release:${bookingId}`).digest('hex')
}

export function verifyReleaseToken(bookingId: string, token: string): boolean {
  const expected = issueReleaseToken(bookingId)
  if (!expected) return false
  return timingSafeEqual(expected, token)
}

/** Verifies an inbound webhook body against the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!webhookSecret) return false
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return timingSafeEqual(expected, signature)
}

export const isWebhookConfigured = Boolean(webhookSecret)

/** Length-checked, constant-time comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
