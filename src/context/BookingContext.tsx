'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { totalForSlots } from '@/lib/pricing'
import { clubToday } from '@/lib/utils'
import type { BookingDetails } from '@/lib/schema'

export type BookingStep = 'slots' | 'details' | 'success'

export interface ConfirmedBooking {
  bookingId: string
  reference: string
  date: string
  slotIds: string[]
  amount: number
  name: string
  phone: string
  whatsappOptIn: boolean
  paymentId?: string | null
  demo?: boolean
}

interface BookingContextValue {
  /** Selected calendar date, "YYYY-MM-DD". */
  date: string
  setDate: (date: string) => void

  /** Selected slot ids, e.g. ["19:00", "20:00"]. */
  selected: string[]
  toggleSlot: (slotId: string) => void
  /** Idempotent removal. Use this, not toggleSlot, to drop slots. */
  deselectSlots: (slotIds: string[]) => void
  clearSelection: () => void

  /** Rupees, derived from the rate card. */
  total: number

  /** Modal state. */
  isOpen: boolean
  step: BookingStep
  open: (step?: BookingStep) => void
  close: () => void
  setStep: (step: BookingStep) => void

  confirmed: ConfirmedBooking | null
  setConfirmed: (booking: ConfirmedBooking | null) => void

  /** Retained between steps so a payment retry doesn't retype the form. */
  details: BookingDetails | null
  setDetails: (details: BookingDetails | null) => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBooking must be used inside <BookingProvider>')
  return ctx
}

/** Hard cap per booking — matches createOrderSchema. */
export const MAX_SLOTS_PER_BOOKING = 6

/**
 * Booking state, lifted to the app root.
 *
 * Selections are shared between the inline engine in the Booking section
 * and the checkout modal, so a customer who picks slots on the page and
 * then hits "Book" in the nav keeps everything they chose.
 */
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [date, setDateState] = useState(clubToday)
  const [selected, setSelected] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<BookingStep>('slots')
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null)
  const [details, setDetails] = useState<BookingDetails | null>(null)

  // Slot ids are only meaningful for one date.
  const setDate = useCallback((next: string) => {
    setDateState(next)
    setSelected([])
  }, [])

  const toggleSlot = useCallback((slotId: string) => {
    setSelected((prev) => {
      if (prev.includes(slotId)) return prev.filter((id) => id !== slotId)
      if (prev.length >= MAX_SLOTS_PER_BOOKING) return prev
      return [...prev, slotId].sort()
    })
  }, [])

  /**
   * Removing a slot must be idempotent. `toggleSlot` is not: two
   * components reconciling the same stale slot would remove it and then
   * put it straight back.
   */
  const deselectSlots = useCallback((slotIds: string[]) => {
    if (!slotIds.length) return
    setSelected((prev) => {
      const next = prev.filter((id) => !slotIds.includes(id))
      // Preserve identity when nothing changed, so effects don't re-fire.
      return next.length === prev.length ? prev : next
    })
  }, [])

  const clearSelection = useCallback(() => setSelected([]), [])

  const open = useCallback((nextStep: BookingStep = 'slots') => {
    setStep(nextStep)
    setIsOpen(true)
  }, [])

  // Read `confirmed` through a ref so `close` keeps a stable identity.
  // Consumers put it in effect dependency arrays; rebuilding it on every
  // confirmation would tear those effects down at the worst moment.
  const confirmedRef = useRef<ConfirmedBooking | null>(null)
  confirmedRef.current = confirmed

  const close = useCallback(() => {
    setIsOpen(false)
    // A completed booking shouldn't leave stale slots selected behind the
    // modal. An abandoned one should — the customer may well come back.
    if (confirmedRef.current) {
      setSelected([])
      setDetails(null)
    }
    setConfirmed(null)
    setStep('slots')
  }, [])

  // Roll the default date forward if the tab is left open past midnight.
  useEffect(() => {
    const id = setInterval(() => {
      const today = clubToday()
      setDateState((current) => (current < today ? today : current))
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const total = useMemo(() => totalForSlots(date, selected), [date, selected])

  const value = useMemo<BookingContextValue>(
    () => ({
      date,
      setDate,
      selected,
      toggleSlot,
      deselectSlots,
      clearSelection,
      total,
      isOpen,
      step,
      open,
      close,
      setStep,
      confirmed,
      setConfirmed,
      details,
      setDetails,
    }),
    [
      date,
      setDate,
      selected,
      toggleSlot,
      deselectSlots,
      clearSelection,
      total,
      isOpen,
      step,
      open,
      close,
      confirmed,
      details,
    ],
  )

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}
