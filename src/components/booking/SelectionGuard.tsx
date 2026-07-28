'use client'

import { useEffect, useRef } from 'react'
import { useBooking } from '@/context/BookingContext'
import { useSlots } from '@/hooks/useSlots'
import { useToast } from '@/components/ui/Toast'
import { describeSlotRanges } from '@/lib/utils'

/**
 * Keeps the selection honest, in exactly one place.
 *
 * While a customer is deciding, another team can book one of the hours
 * they've highlighted. Something has to notice and drop it.
 *
 * That reconciliation deliberately does *not* live in `BookingEngine`:
 * the engine renders both inline on the page and inside the checkout
 * modal, so during the modal's open/close transition two copies exist
 * briefly. Two owners of one invariant means duplicate toasts and, with a
 * toggle-based removal, a slot that gets dropped and immediately re-added.
 *
 * This component renders nothing. It is mounted once, inside the provider.
 */
export function SelectionGuard() {
  const { date, selected, deselectSlots } = useBooking()
  const { slots, loading } = useSlots(date)
  const { warning } = useToast()
  /** Ids already warned about, so a re-render can't re-announce them. */
  const announced = useRef<Set<string>>(new Set())

  useEffect(() => {
    announced.current = new Set()
  }, [date])

  useEffect(() => {
    if (loading || !selected.length) return

    const taken = selected.filter((id) => {
      const slot = slots.find((s) => s.id === id)
      return slot ? slot.status !== 'available' || slot.past : false
    })
    if (!taken.length) return

    deselectSlots(taken)

    const fresh = taken.filter((id) => !announced.current.has(id))
    if (!fresh.length) return
    fresh.forEach((id) => announced.current.add(id))

    warning(
      fresh.length === 1 ? 'A slot was just taken' : 'Some slots were just taken',
      `${describeSlotRanges(fresh).join(', ')} is no longer free. Pick another hour.`,
    )
    // `selected` is intentionally omitted: deselectSlots changes it, and
    // re-running on that change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, loading, deselectSlots, warning])

  return null
}
