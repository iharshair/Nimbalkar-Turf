'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useBooking } from '@/context/BookingContext'
import { useRazorpay } from '@/hooks/useRazorpay'
import { broadcastSlotsRefresh } from '@/hooks/useSlots'
import { logAnalyticsEvent } from '@/lib/firebase/analytics'
import { useSmoothScroll } from '@/components/motion/SmoothScrollProvider'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useToast } from '@/components/ui/Toast'
import { BookingEngine } from '@/components/booking/BookingEngine'
import { DetailsForm } from '@/components/booking/DetailsForm'
import { Confirmation } from '@/components/booking/Confirmation'
import type { BookingDetails } from '@/lib/schema'
import { cn } from '@/lib/utils'

const STEP_TITLES = {
  slots: 'Book your slot',
  details: 'Your details',
  success: 'Confirmed',
} as const

/**
 * The booking flow, as a modal rather than a separate route: the customer
 * keeps their place on the page, and there's no navigation cost between
 * "I'm interested" and "I'm paying".
 */
export function BookingModal() {
  const { isOpen, close, step, setStep, date, selected, confirmed, setConfirmed } = useBooking()
  const { pay, busy } = useRazorpay()
  const { stop, start } = useSmoothScroll()
  const { success, error, warning, info } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)

  // Without this, Tab escapes into the inline BookingEngine behind the
  // dialog — a second slot grid bound to the same selection state.
  useFocusTrap(panelRef, isOpen)

  // Read through a ref inside the key handler so that toggling
  // `submitting` doesn't re-run the lock effect below — which would
  // release the scroll lock and yank focus back to the panel mid-payment.
  const submittingRef = useRef(false)
  submittingRef.current = submitting

  // Lock the page and move focus into the panel. Keyed on `isOpen` only.
  useEffect(() => {
    if (!isOpen) return
    stop()
    const onKey = (e: KeyboardEvent) => {
      // Never let Escape close the dialog mid-payment.
      if (e.key === 'Escape' && !submittingRef.current) close()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panelRef.current?.focus(), 80)
    return () => {
      start()
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [isOpen, close, stop, start])

  const handleSubmit = useCallback(
    async (details: BookingDetails) => {
      // SelectionGuard can empty the selection while the customer is on
      // the details step (someone else booked those hours). Without this,
      // they'd submit a zero-slot order and see a generic "payment failed"
      // instead of being told what actually happened.
      if (!selected.length) {
        warning('Your slots are no longer held', 'Pick your hours again to continue.')
        setStep('slots')
        return
      }

      setSubmitting(true)
      info('Opening secure payment…', 'Your slots are held for the next 10 minutes.')

      const result = await pay({ date, slotIds: selected, details })
      setSubmitting(false)

      if (result.ok) {
        setConfirmed(result.booking)
        setStep('success')
        // The hours are gone now — tell every mounted grid at once.
        broadcastSlotsRefresh()
        // No PII: hours and amount only.
        void logAnalyticsEvent('booking_completed', {
          hours: result.booking.slotIds.length,
          amount: result.booking.amount,
          demo: Boolean(result.booking.demo),
        })
        success(
          result.booking.demo ? 'Demo booking complete' : 'Payment received',
          `Reference ${result.booking.reference}.`,
        )
        return
      }

      switch (result.reason) {
        case 'dismissed':
          info('Payment cancelled', result.message)
          break
        case 'unavailable':
          // Nothing was charged — send them back to pick again.
          warning('Those slots just went', result.message)
          setStep('slots')
          break
        case 'conflict':
          // Money taken, slots lost. Stay put and be explicit; this needs
          // a phone call, not a retry.
          error('Payment taken — booking not confirmed', result.message)
          break
        default:
          error('Payment failed', result.message)
      }
    },
    [pay, date, selected, setConfirmed, setStep, success, error, warning, info],
  )

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[170] flex items-end justify-center bg-night/80 backdrop-blur-lg sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) close()
          }}
          data-lenis-prevent
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={STEP_TITLES[step]}
            initial={{ opacity: 0, y: 40, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.99 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'turf-noise relative flex max-h-[92svh] w-full flex-col overflow-hidden',
              'rounded-t-3xl border border-chalk/12 bg-night-800 shadow-lift',
              'sm:max-h-[88svh] sm:max-w-2xl sm:rounded-card',
              'outline-none',
            )}
          >
            {/* Header */}
            <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-chalk/10 px-5 py-4 sm:px-7">
              <div>
                <p className="font-display text-[0.62rem] uppercase tracking-[0.2em] text-neon">
                  {step === 'success' ? 'All set' : step === 'details' ? 'Step 2 of 2' : 'Step 1 of 2'}
                </p>
                <h2 className="mt-1 font-display text-lg uppercase tracking-[0.04em] text-chalk">
                  {STEP_TITLES[step]}
                </h2>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={submitting}
                aria-label="Close booking"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-chalk/15 text-chalk/60 transition-colors hover:border-neon/50 hover:text-neon disabled:opacity-30"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>

              {/* Progress rail */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px bg-neon/70 transition-[width] duration-700 ease-turf"
                style={{ width: step === 'slots' ? '33%' : step === 'details' ? '72%' : '100%' }}
              />
            </div>

            {/* Body — the only scrollable region. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 'slots' ? (
                    <BookingEngine compact onContinue={() => setStep('details')} />
                  ) : null}

                  {step === 'details' ? (
                    <DetailsForm
                      onBack={() => setStep('slots')}
                      onSubmit={handleSubmit}
                      submitting={submitting || busy}
                    />
                  ) : null}

                  {step === 'success' && confirmed ? (
                    <Confirmation booking={confirmed} onDone={close} />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
