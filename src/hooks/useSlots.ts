'use client'

import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getDb, isDemoMode } from '@/lib/firebase/client'
import { buildSlotGrid, seedSlotsForDate } from '@/lib/slots'
import type { Slot, SlotDayDoc, StoredSlot } from '@/types'

export type SlotSource = 'live' | 'demo'

interface UseSlotsResult {
  slots: Slot[]
  loading: boolean
  error: string | null
  source: SlotSource
}

/**
 * Streams one day's availability.
 *
 * Live mode: a single `onSnapshot` on slotDays/{date}. One document per
 * day means one listener and one read per change, rather than 24 — and
 * confirmed bookings appear in the grid without a refresh.
 *
 * Demo mode (no Firebase env): deterministic seed data, so the grid stays
 * fully interactive for review.
 */
export function useSlots(dateISO: string): UseSlotsResult {
  const [stored, setStored] = useState<Record<string, StoredSlot>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<SlotSource>(isDemoMode ? 'demo' : 'live')
  /** Re-tick so `past` recomputes as the current hour rolls over. */
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const db = getDb()

    if (isDemoMode || !db) {
      // Brief delay so the skeleton loader is exercised, not skipped.
      const t = setTimeout(() => {
        if (cancelled) return
        setStored(seedSlotsForDate(dateISO))
        setSource('demo')
        setLoading(false)
      }, 320)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }

    const unsub = onSnapshot(
      doc(db, 'slotDays', dateISO),
      (snap) => {
        if (cancelled) return
        const data = snap.data() as SlotDayDoc | undefined
        // A missing day document simply means nothing is booked yet.
        setStored(data?.slots ?? {})
        setSource('live')
        setLoading(false)
      },
      (err) => {
        if (cancelled) return
        console.error('[slots] snapshot failed', err)
        // Never leave the customer staring at an empty grid.
        setStored(seedSlotsForDate(dateISO))
        setSource('demo')
        setError('Live availability is temporarily unavailable. Showing indicative times.')
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [dateISO])

  // Keep `past` honest without re-rendering every second.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const slots = useMemo(
    () => buildSlotGrid(dateISO, stored, new Date()),
    // `tick` is a deliberate dependency: it re-evaluates which hours have
    // passed without changing any other input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateISO, stored, tick],
  )

  return { slots, loading, error, source }
}
