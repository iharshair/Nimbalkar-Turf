'use client'

import { Check, Info, ShieldCheck } from 'lucide-react'
import {
  ADVANCE_PERCENT,
  OVERTIME_POLICY,
  RATE_TIERS,
  formatINR,
  overtimeCharge,
} from '@/lib/pricing'
import { formatHour } from '@/lib/utils'
import { Reveal } from '@/components/motion/Reveal'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { Floodlight, Section, SectionHeading } from '@/components/ui/Section'
import { useBooking } from '@/context/BookingContext'

/**
 * Pricing and the overtime policy, in that order, before checkout.
 *
 * The overtime block is the whole point of this section. Reviews of the
 * club repeatedly mention disputes about extra minutes, so the rule is
 * published in full — grace window, block rate, cap, and worked examples
 * — where a customer sees it before they pay rather than after.
 */
export function Pricing() {
  const { open: openBooking } = useBooking()

  return (
    <Section id="pricing" grain label="Pricing and policy">
      <Floodlight className="-right-40 top-1/4 h-[24rem] w-[24rem] opacity-60" animation="a" />

      <div className="shell relative">
        <SectionHeading
          eyebrow="Rates & policy"
          title="One price per hour. Told to you up front."
          lead="Lights, water, parking and the changing room are all included. What you see here is what you pay online — the full amount, so there's nothing to settle at the gate."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* ── Rate card ────────────────────────────────────────── */}
          <Reveal className="card overflow-hidden" y={30}>
            <table className="w-full text-left">
              <caption className="sr-only">Hourly turf rates by time of day</caption>
              <thead>
                <tr className="border-b border-chalk/10 bg-chalk/[0.02]">
                  <th
                    scope="col"
                    className="px-5 py-4 font-display text-[0.62rem] uppercase tracking-[0.18em] text-chalk/40 sm:px-6"
                  >
                    Slot
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-4 text-right font-display text-[0.62rem] uppercase tracking-[0.18em] text-chalk/40"
                  >
                    Mon–Fri
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-right font-display text-[0.62rem] uppercase tracking-[0.18em] text-chalk/40 sm:px-6"
                  >
                    Sat–Sun
                  </th>
                </tr>
              </thead>
              <tbody>
                {RATE_TIERS.map((tier) => (
                  <tr
                    key={tier.id}
                    className="border-b border-chalk/[0.07] transition-colors last:border-0 hover:bg-chalk/[0.02]"
                  >
                    <th scope="row" className="px-5 py-5 align-top sm:px-6">
                      <span className="block font-display text-[0.95rem] uppercase tracking-[0.05em] text-chalk">
                        {tier.label}
                      </span>
                      <span className="mt-1 block text-[0.72rem] uppercase tracking-[0.12em] text-neon/70">
                        {formatHour(tier.from)} – {formatHour(tier.to === 24 ? 0 : tier.to)}
                      </span>
                      <span className="mt-2 block max-w-xs text-[0.8rem] font-normal leading-relaxed text-chalk/45">
                        {tier.note}
                      </span>
                    </th>
                    <td className="px-3 py-5 text-right align-top font-display text-lg text-chalk/75">
                      {formatINR(tier.weekday)}
                    </td>
                    <td className="px-5 py-5 text-right align-top font-display text-lg text-chalk sm:px-6">
                      {formatINR(tier.weekend)}
                      {tier.weekend > tier.weekday ? (
                        <span className="mt-1 block text-[0.62rem] uppercase tracking-[0.14em] text-amber">
                          Weekend rate
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-chalk/10 bg-chalk/[0.02] px-5 py-4 text-[0.78rem] text-chalk/50 sm:px-6">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-neon" aria-hidden />
                Per hour, per pitch
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-neon" aria-hidden />
                Floodlights included
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-neon" aria-hidden />
                {ADVANCE_PERCENT}% paid online
              </span>
            </div>
          </Reveal>

          {/* ── Overtime policy ──────────────────────────────────── */}
          <Reveal className="flex flex-col gap-5" y={30} delay={0.1}>
            <div className="card border-amber/25 bg-amber/[0.04] p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
                <div>
                  <h3 className="font-display text-[0.7rem] uppercase tracking-[0.2em] text-amber">
                    Overtime policy
                  </h3>
                  <p className="mt-2 font-display text-display-sm leading-tight text-chalk">
                    {OVERTIME_POLICY.headline}
                  </p>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {OVERTIME_POLICY.rules.map((rule) => (
                  <li key={rule.slice(0, 20)} className="flex gap-3 text-[0.85rem] leading-relaxed text-chalk/65">
                    <span
                      aria-hidden
                      className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-amber/80"
                    />
                    {rule}
                  </li>
                ))}
              </ul>

              {/* Worked examples remove any remaining ambiguity. */}
              <div className="mt-6 overflow-hidden rounded-xl border border-chalk/10">
                <table className="w-full text-left text-[0.8rem]">
                  <caption className="sr-only">Worked overtime examples</caption>
                  <thead>
                    <tr className="bg-chalk/[0.04]">
                      <th
                        scope="col"
                        className="px-4 py-2.5 font-display text-[0.6rem] uppercase tracking-[0.16em] text-chalk/40"
                      >
                        Minutes over
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-right font-display text-[0.6rem] uppercase tracking-[0.16em] text-chalk/40"
                      >
                        You pay
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {OVERTIME_POLICY.examples.map((ex) => {
                      // Computed, not written by hand — the table and the
                      // billing rule are the same code path.
                      const charge = overtimeCharge(ex.minutes)
                      return (
                        <tr key={ex.over} className="border-t border-chalk/[0.07]">
                          <td className="px-4 py-2.5 text-chalk/60">{ex.over}</td>
                          <td className="px-4 py-2.5 text-right font-display text-chalk">
                            {charge === 0 ? 'Free' : formatINR(charge)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card flex items-start gap-3 p-5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-neon" aria-hidden />
              <p className="text-[0.82rem] leading-relaxed text-chalk/60">
                You&apos;ll see this policy again on the checkout screen and once more in your
                confirmation message, so it&apos;s always in writing before you play.
              </p>
            </div>

            <MagneticButton fullWidth cursorLabel="book" onClick={() => openBooking()}>
              Check availability
            </MagneticButton>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
