'use client'

import { Ban, Check, Lock } from 'lucide-react'
import type { Slot } from '@/types'
import { RATE_TIERS, formatINR } from '@/lib/pricing'
import { isBookable } from '@/lib/slots'
import { SlotGridSkeleton } from '@/components/ui/Skeleton'
import { MAX_SLOTS_PER_BOOKING } from '@/context/BookingContext'
import { cn } from '@/lib/utils'

interface SlotGridProps {
  slots: Slot[]
  selected: string[]
  loading: boolean
  onToggle: (slotId: string) => void
}

/**
 * The availability grid.
 *
 * Colour alone never carries the meaning — every state also has a label
 * and, where it matters, an icon, so the grid is readable without colour
 * vision and to a screen reader.
 */
export function SlotGrid({ slots, selected, loading, onToggle }: SlotGridProps) {
  if (loading) return <SlotGridSkeleton />

  const atLimit = selected.length >= MAX_SLOTS_PER_BOOKING

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[0.68rem] uppercase tracking-[0.2em] text-chalk/40">
          2 · Choose your hours
        </h3>
        <SlotLegend />
      </div>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot) => {
          const isSelected = selected.includes(slot.id)
          const bookable = isBookable(slot)
          // A slot you can't add because you've hit the cap is disabled,
          // but one you've already picked stays clickable so you can undo.
          const disabled = !bookable || (atLimit && !isSelected)

          const reason = slot.past
            ? 'Passed'
            : slot.status === 'booked'
              ? 'Booked'
              : slot.status === 'held'
                ? 'On hold'
                : slot.status === 'blocked'
                  ? 'Maintenance'
                  : null

          return (
            <li key={slot.id}>
              <button
                type="button"
                onClick={() => onToggle(slot.id)}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={`${slot.rangeLabel}, ${formatINR(slot.price)}${
                  reason ? `, unavailable: ${reason}` : ''
                }`}
                className={cn(
                  'group relative flex h-[74px] w-full flex-col items-start justify-center gap-1 rounded-xl border px-3.5 text-left',
                  'transition-[border-color,background-color,color,transform] duration-300 ease-turf',
                  isSelected
                    ? 'border-neon bg-neon text-night shadow-neon'
                    : bookable
                      ? 'border-chalk/12 bg-chalk/[0.02] text-chalk hover:-translate-y-0.5 hover:border-neon/50'
                      : 'cursor-not-allowed border-chalk/[0.07] bg-chalk/[0.015] text-chalk/25',
                  disabled && !isSelected && 'hover:translate-y-0',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-display text-[0.95rem] leading-none">{slot.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden />
                  ) : slot.status === 'blocked' ? (
                    <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : slot.status === 'held' ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : null}
                </span>

                <span
                  className={cn(
                    'text-[0.72rem] tabular-nums',
                    isSelected ? 'text-night/70' : bookable ? 'text-chalk/45' : 'text-chalk/25',
                  )}
                >
                  {reason ?? formatINR(slot.price)}
                </span>

                {/* Strike-through for unavailable slots — a non-colour cue. */}
                {reason && !isSelected ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-3.5 top-1/2 h-px bg-chalk/10"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      {atLimit ? (
        <p className="text-[0.78rem] text-amber">
          That&apos;s the {MAX_SLOTS_PER_BOOKING}-hour maximum for a single booking. For longer
          sessions or tournaments, give us a call.
        </p>
      ) : null}

      {/* Rate bands, so the varying prices in the grid make sense. */}
      <p className="text-[0.72rem] leading-relaxed text-chalk/35">
        {RATE_TIERS.map((t) => t.label).join(' · ')} rates apply by time of day. Weekend evenings
        carry a higher rate — the price on each slot is what you pay.
      </p>
    </div>
  )
}

function SlotLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-[0.62rem] uppercase tracking-[0.12em] text-chalk/35">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-chalk/25" aria-hidden />
        Free
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-neon" aria-hidden />
        Selected
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-chalk/[0.08]" aria-hidden />
        Taken
      </li>
    </ul>
  )
}
