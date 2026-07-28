'use client'

import { useRef } from 'react'
import { CalendarPlus, MapPin, Phone } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { BUSINESS } from '@/lib/business'
import { OVERTIME_POLICY, formatINR } from '@/lib/pricing'
import { bookingConfirmationMessage, whatsappLink } from '@/lib/whatsapp'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { WhatsAppGlyph } from '@/components/layout/WhatsAppFab'
import type { ConfirmedBooking } from '@/context/BookingContext'
import { describeSlotRanges, fromISODate } from '@/lib/utils'

/**
 * Post-payment confirmation.
 *
 * Three jobs: prove the booking exists (reference + amount), get the
 * details somewhere the customer will still have them tomorrow (WhatsApp
 * or calendar), and restate the overtime rule one final time.
 */
export function Confirmation({
  booking,
  onDone,
}: {
  booking: ConfirmedBooking
  onDone: () => void
}) {
  const checkRef = useRef<SVGSVGElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  const ranges = describeSlotRanges(booking.slotIds)
  const longDate = fromISODate(booking.date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion) return
    const svg = checkRef.current
    const content = contentRef.current
    if (!svg || !content) return

    const ctx = gsap.context(() => {
      const circle = svg.querySelector('[data-check-circle]')
      const tick = svg.querySelector('[data-check-tick]')

      // Draw the ring, then the tick, by animating stroke offsets.
      const tl = gsap.timeline()
      if (circle) {
        tl.fromTo(
          circle,
          { strokeDasharray: '1 200', strokeDashoffset: 0, opacity: 0 },
          { strokeDasharray: '200 200', opacity: 1, duration: 0.7, ease: 'power2.inOut' },
        )
      }
      if (tick) {
        tl.fromTo(
          tick,
          { strokeDasharray: '50', strokeDashoffset: 50 },
          { strokeDashoffset: 0, duration: 0.42, ease: 'power2.out' },
          '-=0.12',
        )
      }
      tl.from(
        content.children,
        { opacity: 0, y: 18, duration: 0.6, stagger: 0.07, ease: 'power3.out' },
        '-=0.2',
      )
    }, svg)

    return () => ctx.revert()
  }, [reducedMotion])

  /** A .ics file, generated client-side — no server round trip needed. */
  const downloadIcs = () => {
    const hours = booking.slotIds.map((id) => Number(id.split(':')[0])).sort((a, b) => a - b)
    const start = fromISODate(booking.date)
    start.setHours(hours[0], 0, 0, 0)
    const end = fromISODate(booking.date)
    end.setHours(hours[hours.length - 1] + 1, 0, 0, 0)

    // Floating local time for the event itself: a 7 PM slot should read as
    // 7 PM in whatever calendar app opens it.
    const stamp = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(
        d.getHours(),
      ).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`

    // DTSTAMP, by contrast, must be UTC with a trailing Z (RFC 5545 §3.8.7.2).
    const utcStamp = (d: Date) => `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nimbalkar Sports Club//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${booking.bookingId}@nimbalkarsportsclub`,
      `DTSTAMP:${utcStamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:Turf booking · ${BUSINESS.name}`,
      `LOCATION:${BUSINESS.address.full}`,
      `DESCRIPTION:Ref ${booking.reference}. ${OVERTIME_POLICY.graceMinutes} minutes grace\\, then ${formatINR(
        OVERTIME_POLICY.blockRate,
      )} per ${OVERTIME_POLICY.blockMinutes} minutes.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${booking.reference}.ics`
    // The anchor must be in the document for the download to fire in
    // Firefox, and the URL must outlive the click — revoking it in the
    // same tick cancels the download in some browsers.
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    window.setTimeout(() => {
      a.remove()
      URL.revokeObjectURL(url)
    }, 0)
  }

  return (
    <div className="text-center">
      <svg
        ref={checkRef}
        viewBox="0 0 64 64"
        className="mx-auto h-20 w-20"
        role="img"
        aria-label="Booking confirmed"
      >
        <circle
          data-check-circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="#39FF6E"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <path
          data-check-tick
          d="M20 33.5 L28.5 42 L44.5 24"
          fill="none"
          stroke="#39FF6E"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div ref={contentRef} className="mt-7">
        <h3 className="font-display text-display-sm uppercase text-chalk">
          {booking.demo ? 'Booking simulated' : "You're on the turf"}
        </h3>

        <p className="mx-auto mt-2 max-w-sm text-[0.88rem] text-chalk/55">
          {booking.demo
            ? 'This was a demo run — no payment was taken and nothing was saved. Connect Razorpay and Firebase to take real bookings.'
            : `Paid in full. We've got the pitch ready for you, ${booking.name.split(' ')[0]}.`}
        </p>

        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/[0.07] px-4 py-2 font-mono text-[0.82rem] tracking-wider text-neon">
          {booking.reference}
        </p>

        <dl className="mx-auto mt-6 grid max-w-sm gap-y-2.5 rounded-xl border border-chalk/12 bg-chalk/[0.02] p-4 text-left text-[0.84rem] sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-chalk/40">Date</dt>
          <dd className="text-chalk/85 sm:text-right">{longDate}</dd>
          <dt className="text-chalk/40">Time</dt>
          <dd className="text-chalk/85 sm:text-right">{ranges.join(', ')}</dd>
          <dt className="text-chalk/40">Paid</dt>
          <dd className="font-display text-neon sm:text-right">{formatINR(booking.amount)}</dd>
        </dl>

        {/* The policy, in writing, at the last possible moment. */}
        <p className="mx-auto mt-4 max-w-sm rounded-xl border border-amber/20 bg-amber/[0.05] p-3.5 text-left text-[0.78rem] leading-relaxed text-chalk/65">
          <span className="font-display uppercase tracking-[0.1em] text-amber">Remember:</span>{' '}
          {OVERTIME_POLICY.graceMinutes} minutes grace at the end, free. Beyond that,{' '}
          {formatINR(OVERTIME_POLICY.blockRate)} per {OVERTIME_POLICY.blockMinutes} minutes — we&apos;ll
          confirm with you before charging anything.
        </p>

        <div className="mt-7 space-y-3">
          <MagneticButton
            fullWidth
            href={whatsappLink(
              bookingConfirmationMessage({
                reference: booking.reference,
                name: booking.name,
                date: booking.date,
                slotIds: booking.slotIds,
                amount: booking.amount,
              }),
            )}
          >
            <WhatsAppGlyph className="h-4 w-4" />
            Send confirmation to WhatsApp
          </MagneticButton>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={downloadIcs}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-chalk/15 font-display text-[0.72rem] uppercase tracking-[0.14em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Add to calendar
            </button>
            <a
              href={BUSINESS.maps.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-chalk/15 font-display text-[0.72rem] uppercase tracking-[0.14em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Directions
            </a>
          </div>

          <button
            type="button"
            onClick={onDone}
            className="w-full pt-1 text-[0.78rem] text-chalk/40 underline underline-offset-4 transition-colors hover:text-chalk"
          >
            Done
          </button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-[0.72rem] text-chalk/35">
          <Phone className="h-3 w-3" aria-hidden />
          Need to change something? Call {BUSINESS.phone}
        </p>
      </div>
    </div>
  )
}
