'use client'

import { useCallback, useState } from 'react'
import { BUSINESS } from '@/lib/business'
import { bookingReferenceFromId } from '@/lib/reference'
import type { BookingDetails } from '@/lib/schema'
import type { ConfirmedBooking } from '@/context/BookingContext'
import type {
  RazorpayFailureResponse,
  RazorpaySuccessResponse,
} from '@/types/razorpay'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

/** Loads checkout.js on demand, once. Not in the initial bundle. */
function loadCheckout(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

interface OrderResponse {
  bookingId: string
  amount: number
  orderId: string | null
  keyId: string | null
  /** Capability token required by /api/bookings/release. */
  releaseToken: string | null
  /** True when the server is in demo mode — simulate instead of charging. */
  demo: boolean
}

export type PayResult =
  | { ok: true; booking: ConfirmedBooking }
  | {
      ok: false
      /** `conflict` means the money was taken but the slots were lost. */
      reason: 'dismissed' | 'failed' | 'unavailable' | 'conflict' | 'error'
      message: string
    }

interface PayArgs {
  date: string
  slotIds: string[]
  details: BookingDetails
}

/** Carries the HTTP status so callers can branch on it, not on prose. */
class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new ApiError(json?.error || `Request failed (${res.status})`, res.status)
  return json
}

/**
 * Safety valve on the checkout promise.
 *
 * `submitting` disables Escape, the close button and the backdrop. If
 * Razorpay ever fires none of `handler`, `ondismiss` or `payment.failed`
 * — a crashed iframe, a blocked third-party frame — the modal would stay
 * locked forever with no way out. Comfortably longer than the 10-minute
 * slot hold, so it can't fire while a payment is legitimately in flight.
 */
const CHECKOUT_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Drives the payment leg of a booking.
 *
 * Order of operations matters for correctness:
 *   1. Ask our server for an order. It re-prices the slots, holds them,
 *      and writes a `pending` booking. The client never sends an amount.
 *   2. Open Razorpay Checkout.
 *   3. Send the signature back to our server to verify and confirm.
 *      A payment is only ever trusted after step 3.
 */
export function useRazorpay() {
  const [busy, setBusy] = useState(false)

  /**
   * Frees a hold when the customer closes checkout without paying. The
   * token proves this hold is ours to release — see the route's comment.
   */
  const release = useCallback(async (bookingId: string, token: string | null) => {
    if (!token) return
    try {
      await fetch('/api/bookings/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, token }),
        keepalive: true,
      })
    } catch {
      // Holds expire on their own, so a failure here is not fatal.
    }
  }, [])

  const pay = useCallback(
    async ({ date, slotIds, details }: PayArgs): Promise<PayResult> => {
      setBusy(true)
      try {
        const order = await postJSON<OrderResponse>('/api/razorpay/order', {
          date,
          slotIds,
          details,
        })
        const base: Omit<ConfirmedBooking, 'paymentId' | 'demo'> = {
          bookingId: order.bookingId,
          reference: bookingReferenceFromId(order.bookingId),
          date,
          slotIds,
          amount: order.amount,
          name: details.name,
          phone: details.phone,
          whatsappOptIn: details.whatsappOptIn,
        }

        // ── Demo mode: no keys configured, so simulate a settled payment.
        if (order.demo || !order.orderId || !order.keyId) {
          await new Promise((r) => setTimeout(r, 900))
          return { ok: true, booking: { ...base, paymentId: null, demo: true } }
        }

        const loaded = await loadCheckout()
        if (!loaded) {
          await release(order.bookingId, order.releaseToken)
          return {
            ok: false,
            reason: 'error',
            message: 'Payment window could not load. Check your connection and try again.',
          }
        }

        return await new Promise<PayResult>((resolve) => {
          let settled = false
          let timeoutId: number | undefined
          const finish = (result: PayResult) => {
            if (settled) return
            settled = true
            if (timeoutId !== undefined) window.clearTimeout(timeoutId)
            resolve(result)
          }

          timeoutId = window.setTimeout(() => {
            void release(order.bookingId, order.releaseToken)
            finish({
              ok: false,
              reason: 'error',
              message:
                'The payment window stopped responding. Nothing has been charged — please try again.',
            })
          }, CHECKOUT_TIMEOUT_MS)

          const rzp = new window.Razorpay!({
            key: order.keyId!,
            amount: order.amount * 100, // Razorpay works in paise.
            currency: 'INR',
            name: BUSINESS.name,
            description: `Turf booking · ${slotIds.length} hour${slotIds.length > 1 ? 's' : ''}`,
            order_id: order.orderId!,
            prefill: {
              name: details.name,
              contact: details.phone,
              ...(details.email ? { email: details.email } : {}),
            },
            notes: { bookingId: order.bookingId, date, slots: slotIds.join(',') },
            theme: { color: '#146B3A', backdrop_color: '#0A0E14' },
            retry: { enabled: false },
            modal: {
              escape: false,
              ondismiss: () => {
                void release(order.bookingId, order.releaseToken)
                finish({
                  ok: false,
                  reason: 'dismissed',
                  message: 'Payment cancelled. Your slots have been released.',
                })
              },
            },
            handler: (response: RazorpaySuccessResponse) => {
              // Confirm server-side before telling the customer anything.
              postJSON<{ paymentId: string }>('/api/razorpay/verify', {
                bookingId: order.bookingId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
                .then(() =>
                  finish({
                    ok: true,
                    booking: { ...base, paymentId: response.razorpay_payment_id },
                  }),
                )
                .catch((err: Error) =>
                  finish({
                    // Paid, but not confirmable. Never retryable, and the
                    // customer must talk to a human.
                    ok: false,
                    reason: 'conflict',
                    message:
                      err.message ||
                      'Payment went through but we could not confirm it. Call us and we will sort it out.',
                  }),
                )
            },
          })

          rzp.on('payment.failed', (response: RazorpayFailureResponse) => {
            void release(order.bookingId, order.releaseToken)
            finish({
              ok: false,
              reason: 'failed',
              message: response.error?.description || 'The payment did not go through.',
            })
          })

          rzp.open()
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.'
        // 409 from /order means a lost race for the slots. Reading the
        // status is stable; the previous version regex-matched the error
        // prose, so an innocuous copy edit would have silently broken the
        // "those slots just went" recovery path.
        const unavailable = err instanceof ApiError && err.status === 409
        return { ok: false, reason: unavailable ? 'unavailable' : 'error', message }
      } finally {
        setBusy(false)
      }
    },
    [release],
  )

  return { pay, busy }
}
