'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getDb, isFirebaseConfigured } from '@/lib/firebase/client'
import { buildSlotGrid, seedSlotsForDate } from '@/lib/slots'
import type { Slot, SlotDayDoc, StoreBackend, StoredSlot } from '@/types'

export type { StoreBackend }

export type SlotSource = 'live' | 'polled' | 'demo'

interface UseSlotsResult {
  slots: Slot[]
  loading: boolean
  error: string | null
  source: SlotSource
  backend: StoreBackend
  /** Force an immediate re-read. */
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

interface SlotDayResponse {
  slots?: Record<string, StoredSlot>
  source?: 'firestore' | 'local'
}

/**
 * Shares one in-flight request between concurrent callers.
 *
 * The hook is mounted more than once — the booking engine and
 * SelectionGuard both use it — and their timers land together. The
 * Firestore SDK dedupes identical listeners for us; fetch does not.
 */
const inFlight = new Map<string, Promise<SlotDayResponse>>()

function fetchSlotDay(dateISO: string): Promise<SlotDayResponse> {
  const existing = inFlight.get(dateISO)
  if (existing) return existing

  const request = fetch(`/api/slots/${dateISO}`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Availability request failed (${res.status})`)
      return (await res.json()) as SlotDayResponse
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
 * The subtlety here is that the browser cannot infer where bookings are
 * actually stored. Having the Firebase *web* config present does not mean
 * the *server* can write to Firestore — that needs an Admin service
 * account, and without one the API routes fall back to a local JSON store.
 * Subscribing to Firestore on the strength of the web config alone would
 * show an empty calendar while real bookings sat in a file somewhere else.
 *
 * So the server is asked. `/api/slots/[date]` reports which backend it
 * used, and only then do we choose:
 *
 *   firestore → attach `onSnapshot` and get push updates for free
 *   local     → keep polling, because there is nothing to subscribe to
 *
 * Cost is one request on first load. In exchange, the grid always reflects
 * the store that bookings are really written to.
 */
export function useSlots(dateISO: string): UseSlotsResult {
  const [stored, setStored] = useState<Record<string, StoredSlot>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<SlotSource>('polled')
  const [backend, setBackend] = useState<StoreBackend>('unknown')
  /** Bumped to re-probe, and to recompute which hours have passed. */
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  /* ── Probe: read once, and learn the authoritative store ────────── */
  useEffect(() => {
    let cancelled = false

    // Only show the skeleton when there's nothing to show yet — the grid
    // shouldn't flicker on a background refresh.
    setLoading((current) => (Object.keys(stored).length ? current : true))

    fetchSlotDay(dateISO)
      .then((data) => {
        if (cancelled) return
        setStored(data.slots ?? {})
        setBackend(data.source ?? 'local')
        // Firestore takes over below and will relabel this as 'live'.
        setSource(data.source === 'firestore' ? 'live' : 'polled')
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[slots] availability fetch failed', err)
        // Never leave the customer staring at an empty grid.
        setStored((current) => (Object.keys(current).length ? current : seedSlotsForDate(dateISO)))
        setSource('demo')
        setError('Could not reach live availability. Showing indicative times.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // `stored` is written by this effect, so it must not be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, tick])

  /* ── Firestore push, once the server confirms it's authoritative ── */
  useEffect(() => {
    if (backend !== 'firestore' || !isFirebaseConfigured) return
    const db = getDb()
    if (!db) return

    let cancelled = false

    const unsub = onSnapshot(
      doc(db, 'slotDays', dateISO),
      (snap) => {
        if (cancelled) return
        const data = snap.data() as SlotDayDoc | undefined
        // A missing day document simply means nothing is booked yet.
        setStored(data?.slots ?? {})
        setSource('live')
        setError(null)
        setLoading(false)
      },
      (err) => {
        if (cancelled) return
        // Most likely cause: firestore.rules not deployed yet, so the
        // public read on slotDays is being denied.
        console.error('[slots] snapshot failed — are firestore.rules deployed?', err)
        setSource('polled')
        setError('Live updates unavailable. Availability may be a few seconds behind.')
      },
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [dateISO, backend])

  /* ── Polling, only while there's nothing to subscribe to ─────────── */
  useEffect(() => {
    if (backend === 'firestore') return

    const id = setInterval(refresh, POLL_MS)
    // Coming back to the tab is when stale availability matters most.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [backend, refresh])

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

  return { slots, loading, error, source, backend, refresh }
}
