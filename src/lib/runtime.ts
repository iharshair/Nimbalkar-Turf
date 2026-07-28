import type { StoreBackend } from '@/types'

/**
 * What's actually wired up, as visible to the browser.
 *
 * Only NEXT_PUBLIC_* vars are readable here, which is exactly enough: the
 * Razorpay key id is public by design (it goes into Checkout), and the
 * Firebase web config is public too. Nothing secret is exposed.
 *
 * The point is to describe the running system honestly in the UI —
 * "payment is simulated" and "payment is real but in test mode" are very
 * different promises to make to someone about to enter a card number.
 */

const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''
const forceDemo = process.env.NEXT_PUBLIC_FORCE_DEMO_MODE === 'true'

export type PaymentMode = 'simulated' | 'test' | 'live'

export const paymentMode: PaymentMode = forceDemo
  ? 'simulated'
  : razorpayKeyId.startsWith('rzp_live_')
    ? 'live'
    : razorpayKeyId.startsWith('rzp_test_')
      ? 'test'
      : 'simulated'

export interface SetupNotice {
  tone: 'amber'
  title: string
  body: string
}

/**
 * The banner shown in the booking panel, or null when everything is
 * production-ready and there's nothing to disclose.
 *
 * Takes the storage backend as an argument rather than reading it from
 * config: whether the *server* can write to Firestore depends on an Admin
 * service account, which the browser cannot see. `useSlots` learns it from
 * the API and passes it in.
 */
export function buildSetupNotice(backend: StoreBackend): SetupNotice | null {
  const storageNote =
    backend === 'local'
      ? 'Bookings are saved to local file storage until a Firebase service account is configured.'
      : backend === 'firestore'
        ? 'Bookings are saved to Firestore.'
        : 'Checking where bookings are stored…'

  if (paymentMode === 'simulated') {
    return {
      tone: 'amber',
      title: 'Demo mode',
      body: 'Razorpay is not connected, so checkout is simulated and no money moves. Add your keys to go live.',
    }
  }

  if (paymentMode === 'test') {
    return {
      tone: 'amber',
      title: 'Test payments',
      body: `Razorpay is in test mode — use a test card or UPI id. No real money moves. ${storageNote}`,
    }
  }

  // Live keys with non-durable storage: /api/razorpay/order refuses these
  // orders outright, so say so plainly rather than letting checkout fail.
  if (backend === 'local') {
    return {
      tone: 'amber',
      title: 'Storage not configured',
      body: 'Live payment keys are set but Firestore is not, so online booking is disabled. Add a Firebase service account to accept bookings.',
    }
  }

  return null
}
