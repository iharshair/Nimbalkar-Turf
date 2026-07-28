'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowRight, CalendarClock, Zap } from 'lucide-react'
import { useBooking } from '@/context/BookingContext'
import { useSlots } from '@/hooks/useSlots'
import { DateStrip } from '@/components/booking/DateStrip'
import { SlotGrid } from '@/components/booking/SlotGrid'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { OVERTIME_POLICY, formatINR } from '@/lib/pricing'
import { describeSlotRanges, cn, fromISODate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { buildSetupNotice } from '@/lib/runtime'

/**
 * Date picker + live slot grid + running total.
 *
 * Rendered both inline in the Booking section and inside the checkout
 * modal. State lives in BookingContext, so a customer who selects slots
 * on the page and then opens the modal keeps their choice.
 */
export function BookingEngine({
  onContinue,
  compact = false,
}: {
  onContinue: () => void
  compact?: boolean
}) {
  const { date, setDate, selected, toggleSlot, total, clearSelection } = useBooking()
  const { slots, loading, error, source, backend } = useSlots(date)
  const { warning } = useToast()

  // If live data disappears mid-session, say so once rather than silently
  // showing indicative times as if they were real.
  useEffect(() => {
    if (error) warning('Live availability unavailable', error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  // Pruning selections that someone else has taken is SelectionGuard's
  // job, not ours — this component can be mounted twice during the
  // checkout modal's transition, and that invariant needs a single owner.

  const notice = buildSetupNotice(backend)
  const ranges = describeSlotRanges(selected)
  const longDate = fromISODate(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className={cn('space-y-8', compact && 'space-y-6')}>
      {/*
        Describes what is actually wired up. "Payment is simulated" and
        "payment is real but in test mode" are very different promises to
        make to someone about to type a card number. `backend` comes from
        the server, since the browser can't see whether the Admin SDK is
        configured.
      */}
      {notice ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-amber/25 bg-amber/[0.06] p-3.5 text-[0.78rem] leading-relaxed text-amber/90">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">{notice.title}.</strong> {notice.body}
          </span>
        </p>
      ) : null}

      {source === 'demo' ? (
        <p className="rounded-xl border border-chalk/15 bg-chalk/[0.03] p-3.5 text-[0.78rem] leading-relaxed text-chalk/60">
          Showing indicative times — we couldn&apos;t reach live availability. Please call to
          confirm before paying.
        </p>
      ) : null}

      <DateStrip value={date} onChange={setDate} />

      <SlotGrid slots={slots} selected={selected} loading={loading} onToggle={toggleSlot} />

      {/* ── Running summary ──────────────────────────────────────── */}
      <div className="rounded-card border border-chalk/12 bg-night-800/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-[0.66rem] uppercase tracking-[0.18em] text-chalk/60">
              <CalendarClock className="h-3.5 w-3.5 text-neon" aria-hidden />
              {longDate}
            </p>

            {selected.length ? (
              <>
                <p className="mt-2 font-display text-[1.05rem] uppercase tracking-[0.04em] text-chalk">
                  {ranges.join('  ·  ')}
                </p>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-1.5 text-[0.72rem] text-chalk/60 underline underline-offset-4 transition-colors hover:text-chalk"
                >
                  Clear selection
                </button>
              </>
            ) : (
              <p className="mt-2 text-[0.88rem] text-chalk/60">
                No hours selected yet. Tap the slots you want — they can be back to back.
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="font-display text-[0.66rem] uppercase tracking-[0.18em] text-chalk/60">
              Total
            </p>
            {/* aria-live so the total is announced as slots are toggled. */}
            <p
              aria-live="polite"
              className="font-display text-display-sm leading-none text-chalk"
            >
              {formatINR(total)}
            </p>
            <p className="mt-1.5 text-[0.7rem] text-chalk/55">
              {selected.length} hour{selected.length === 1 ? '' : 's'} · paid in full online
            </p>
          </div>
        </div>

        {/* The policy, one last time, immediately above the pay button. */}
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber/20 bg-amber/[0.05] p-3.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden />
          <p className="text-[0.78rem] leading-relaxed text-chalk/65">
            <span className="font-display uppercase tracking-[0.1em] text-amber">
              Before you pay:
            </span>{' '}
            {OVERTIME_POLICY.graceMinutes} minutes of grace at the end of your slot, free. After
            that, {formatINR(OVERTIME_POLICY.blockRate)} per {OVERTIME_POLICY.blockMinutes} minutes,
            capped at one hour, and always confirmed with you first.
          </p>
        </div>

        <MagneticButton
          fullWidth
          className="mt-5"
          cursorLabel="book"
          disabled={!selected.length}
          onClick={onContinue}
        >
          {selected.length ? `Continue · ${formatINR(total)}` : 'Select an hour to continue'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </MagneticButton>
      </div>
    </div>
  )
}
