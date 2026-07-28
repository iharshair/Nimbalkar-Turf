import { isFirebaseConfigured } from '@/lib/firebase/client'

/**
 * What's actually wired up, as visible to the browser.
 *
 * Only NEXT_PUBLIC_* vars are readable here, which is exactly enough:
 * the Razorpay key id is public by design (it goes into Checkout), and
 * the Firebase web config is public too. Nothing secret is exposed.
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

/** Firestore streams availability; otherwise we poll the API route. */
export const availabilityMode: 'live' | 'polled' = isFirebaseConfigured ? 'live' : 'polled'

/** True when there's something the operator should still be told about. */
export const showSetupNotice = paymentMode !== 'live' || availabilityMode !== 'live'

export const SETUP_NOTICE: { tone: 'amber' | 'neon'; title: string; body: string } | null =
  paymentMode === 'simulated'
    ? {
        tone: 'amber',
        title: 'Demo mode',
        body: 'Razorpay is not connected, so checkout is simulated and no money moves. Add your keys to go live.',
      }
    : paymentMode === 'test'
      ? {
          tone: 'amber',
          title: 'Test payments',
          body:
            'Razorpay is in test mode — use a test card or UPI id. No real money moves. ' +
            (availabilityMode === 'polled'
              ? 'Bookings are saved locally until Firebase is connected.'
              : 'Bookings are saved to Firestore.'),
        }
      : availabilityMode === 'polled'
        ? {
            tone: 'amber',
            title: 'Storage not configured',
            body: 'Live payment keys are set but Firestore is not, so online booking is disabled. Connect Firebase to accept bookings.',
          }
        : null
