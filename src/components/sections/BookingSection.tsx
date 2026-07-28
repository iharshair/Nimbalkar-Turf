'use client'

import { Clock3, ShieldCheck, Wallet } from 'lucide-react'
import { useBooking } from '@/context/BookingContext'
import { BookingEngine } from '@/components/booking/BookingEngine'
import { Reveal } from '@/components/motion/Reveal'
import { Floodlight, Section, SectionHeading } from '@/components/ui/Section'
import { HOLD_TTL_MS } from '@/lib/slots'

const ASSURANCES = [
  {
    icon: Wallet,
    title: 'Pay once, online',
    body: 'UPI, card or netbanking through Razorpay. Nothing to settle at the gate.',
  },
  {
    icon: Clock3,
    title: 'Held while you pay',
    body: `Your slots are locked for ${HOLD_TTL_MS / 60000} minutes so nobody can take them mid-checkout.`,
  },
  {
    icon: ShieldCheck,
    title: 'No hidden charges',
    body: 'The slot price is the whole price. The overtime rule is published, capped and confirmed.',
  },
]

/**
 * The booking engine, inline on the page.
 *
 * Availability is the strongest thing we can show a visitor, so it lives
 * in the page rather than only behind a button. Hitting "Continue" hands
 * the same selection to the checkout modal.
 */
export function BookingSection() {
  const { open } = useBooking()

  return (
    <Section id="booking" grain label="Book a slot">
      <Floodlight className="left-1/3 top-0 h-[30rem] w-[30rem] opacity-50" animation="a" />

      <div className="shell relative">
        <SectionHeading
          eyebrow="Live availability"
          title="Pick your hour. It's yours."
          lead="Availability updates in real time as other teams book. Choose your slots, pay online, and turn up — that's the whole process."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-12">
          <Reveal className="card p-5 sm:p-7" y={30}>
            <BookingEngine onContinue={() => open('details')} />
          </Reveal>

          <Reveal group className="flex flex-col gap-4" y={26} stagger={0.09}>
            {ASSURANCES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card p-6">
                <Icon className="mb-4 h-5 w-5 text-neon" aria-hidden />
                <h3 className="font-display text-[0.9rem] uppercase tracking-[0.05em] text-chalk">
                  {title}
                </h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-chalk/55">{body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </Section>
  )
}

