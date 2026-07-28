/** Minimal typings for the Razorpay Checkout script (checkout.js). */

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayFailureResponse {
  error: {
    code: string
    description: string
    source?: string
    step?: string
    reason?: string
    metadata?: { order_id?: string; payment_id?: string }
  }
}

export interface RazorpayOptions {
  key: string
  /** Paise. */
  amount: number
  currency: 'INR'
  name: string
  description?: string
  image?: string
  order_id: string
  handler: (response: RazorpaySuccessResponse) => void
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string; backdrop_color?: string }
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean }
  retry?: { enabled?: boolean }
  remember_customer?: boolean
}

export interface RazorpayInstance {
  open: () => void
  close: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}
