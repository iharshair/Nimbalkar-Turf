'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getDb, isFirebaseConfigured } from '@/lib/firebase/client'
import { buildSlotGrid, seedSlotsForDate } from '@/lib/slots'
import type { Slot, SlotDayDoc, StoredSlot } from '@/types'

export type SlotSource = 'live' | 'polled' | 'demo'

interface UseSlotsResult {
  slots: Slot[]
  loading: boolean
  error: string | null
  source: SlotSource
  /** Force an immediate re-read. Called after a booking completes. */
  refresh: () => void
}

/** How often the polling path re-checks availability. */
const POLL_MS = 20_000

/**
 * Broadcast after a booking completes. Firestore pushes the change on its
 * own, but the polling path would otherwise wait up to POLL_MS to notice
 * the slot the customer just paid for.
 */
export const SLOTS_REFRESH_EVENT = 'nsc:slots-refresh'

export function broadcastSlotsRefresh() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SLOTS_REFRESH_EVENT))
}

/**
 * Shares one in-flight request between concurrent callers.
 *
 * The hook is mounted more than once — the booking engine and
 * SelectionGuard both use it — and their poll timers land together. The
 * Firestore SDK dedupes identical listeners for us; fetch does not.
 */
const inFlight = new Map<string, Promise<Record<string, StoredSlot>>>()

function fetchSlotDay(dateISO: string): Promise<Record<string, StoredSlot>> {
  const existing = inFlight.get(dateISO)
  if (existing) return existing

  const request = fetch(`/api/slots/${dateISO}`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Availability request failed (${res.status})`)
      const data = (await res.json()) as { slots?: Record<string, StoredSlot> }
      return data.slots ?? {}
    })
    .finally(() => {
      inFlight.delete(dateISO)
    })

  inFlight.set(dateISO, request)
  return request
}

/**
 * Streams one day's availability.
 *
 * Two paths, because Firebase and Razorpay are configured independently:
 *
 *   Firestore configured → a single `onSnapshot` on slotDays/{date}. One
 *     document per day means one listener and one read per change, and a
 *     booking made by someone else appears without a refresh.
 *
 *   Not configured → poll `/api/slots/{date}`, which reads whichever store
 *     the server is using. Slower to notice a change, but real: a slot
 *     someone just paid for does show as taken.
 *
 * Either way the grid reflects actual bookings. Seed data is only ever a
 * last resort if both paths fail.
 */
export function useSlots(dateISO: string): UseSlotsResult {
  const [stored, setStored] = useState<Record<string, StoredSlot>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<SlotSource>(isFirebaseConfigured ? 'live' : 'polled')
  /** Bumped to re-run the fetch, and to recompute which hours have passed. */
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  /* ── Firestore push ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!isFirebaseConfigured) return
    const db = getDb()
    if (!db) return

    setLoading(true)
    setError(null)
    let cancelled = false

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

  /* ── API polling ────────────────────────────────────────────────── */
  useEffect(() => {
    if (isFirebaseConfigured) return

    let cancelled = false

    // Only show the skeleton on a date change, not on a background poll —
    // the grid shouldn't flicker every 20 seconds.
    setLoading((current) => (Object.keys(stored).length ? current : true))
    setError(null)

    const load = async () => {
      try {
        const slots = await fetchSlotDay(dateISO)
        if (cancelled) return
        setStored(slots)
        setSource('polled')
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('[slots] fetch failed', err)
        // Never leave the customer staring at an empty grid.
        setStored((current) => (Object.keys(current).length ? current : seedSlotsForDate(dateISO)))
        setSource('demo')
        setError('Could not reach live availability. Showing indicative times.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const id = setInterval(load, POLL_MS)
    // Coming back to the tab is the moment stale availability matters most.
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
    // `stored` is deliberately excluded — it's written by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, tick])

  useEffect(() => {
    window.addEventListener(SLOTS_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(SLOTS_REFRESH_EVENT, refresh)
  }, [refresh])

  // Keep `past` honest without re-rendering every second.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const slots = useMemo(
    () => buildSlotGrid(dateISO, stored, new Date()),
    // `tick` re-evaluates which hours have passed without changing inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateISO, stored, tick],
  )

  return { slots, loading, error, source, refresh }
}
