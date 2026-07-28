'use client'

import { useMemo } from 'react'
import { BOOKING_WINDOW_DAYS, bookingDates } from '@/lib/slots'
import { isWeekend } from '@/lib/pricing'
import { cn, clubToday, fromISODate } from '@/lib/utils'

interface DateStripProps {
  value: string
  onChange: (date: string) => void
}

/**
 * Horizontal date picker covering the booking window.
 *
 * A rail rather than a calendar popover: on a phone, choosing "tonight"
 * or "Saturday" should be one tap, not a modal and a grid.
 */
export function DateStrip({ value, onChange }: DateStripProps) {
  // Club time on both server and client, so the "Today" chip and the
  // initial selection agree across hydration.
  const today = useMemo(() => clubToday(), [])
  const dates = useMemo(() => bookingDates(BOOKING_WINDOW_DAYS), [])

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-[0.68rem] uppercase tracking-[0.2em] text-chalk/40">
          1 · Pick a date
        </h3>
        <span className="text-[0.7rem] text-chalk/35">
          Next {BOOKING_WINDOW_DAYS} days
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Booking date"
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {dates.map((date) => {
          const d = fromISODate(date)
          const active = value === date
          const weekend = isWeekend(date)

          return (
            <button
              key={date}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(date)}
              className={cn(
                'group relative flex w-[4.4rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border py-3',
                'transition-[border-color,background-color,color] duration-300 ease-turf',
                active
                  ? 'border-neon bg-neon text-night'
                  : 'border-chalk/12 bg-chalk/[0.02] text-chalk/70 hover:border-chalk/30 hover:text-chalk',
              )}
            >
              <span
                className={cn(
                  'font-display text-[0.6rem] uppercase tracking-[0.14em]',
                  active ? 'text-night/70' : weekend ? 'text-amber/80' : 'text-chalk/40',
                )}
              >
                {d.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <span className="font-display text-xl leading-none">{d.getDate()}</span>
              <span
                className={cn(
                  'text-[0.6rem] uppercase tracking-wider',
                  active ? 'text-night/60' : 'text-chalk/35',
                )}
              >
                {date === today
                  ? 'Today'
                  : d.toLocaleDateString('en-IN', { month: 'short' })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
