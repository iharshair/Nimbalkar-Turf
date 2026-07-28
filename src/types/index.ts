/** Shared domain types. */

export type SlotStatus = 'available' | 'held' | 'booked' | 'blocked'

/**
 * Which store the server treats as authoritative for bookings.
 * 'unknown' until the client has asked — see useSlots.
 */
export type StoreBackend = 'unknown' | 'firestore' | 'local'

/** A single bookable hour, as rendered by the slot grid. */
export interface Slot {
  /** Slot start in 24h "HH:mm". Doubles as the Firestore map key. */
  id: string
  /** Start hour 0–23. */
  hour: number
  /** "6:00 AM" */
  label: string
  /** "6:00 AM – 7:00 AM" */
  rangeLabel: string
  status: SlotStatus
  price: number
  tier: RateTierId
  /** True when the slot start has already passed (today only). */
  past: boolean
}

export type RateTierId = 'night' | 'offpeak' | 'peak'

export interface RateTier {
  id: RateTierId
  label: string
  /** Inclusive start hour. */
  from: number
  /** Exclusive end hour (24 = midnight). */
  to: number
  weekday: number
  weekend: number
  note: string
}

/** Firestore: slotDays/{YYYY-MM-DD} */
export interface SlotDayDoc {
  date: string
  slots: Record<string, StoredSlot>
  updatedAt?: unknown
}

export interface StoredSlot {
  status: SlotStatus
  bookingId?: string | null
  /** Epoch ms. A `held` slot reverts to available once this passes. */
  holdExpiresAt?: number | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded'

/** Firestore: bookings/{bookingId} */
export interface Booking {
  id: string
  date: string
  slotIds: string[]
  /** Rupees. */
  amount: number
  status: BookingStatus
  name: string
  phone: string
  email?: string | null
  sport: Sport
  whatsappOptIn: boolean
  notes?: string | null
  userId?: string | null
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  /** Set when a payment succeeded but some slots were already gone. */
  needsAttention?: boolean
  conflictSlotIds?: string[]
  /** On a partial conflict, the hours the customer did secure. */
  securedSlotIds?: string[]
  createdAt?: unknown
  updatedAt?: unknown
}

export type Sport = 'football' | 'cricket' | 'other'

export interface GalleryItem {
  id: string
  type: 'image' | 'video'
  category: 'stadium' | 'football' | 'videos'
  src: string
  /** Video poster, or a blur-up still. */
  poster?: string
  alt: string
  caption: string
  /** Masonry weight on mobile / card width on the desktop rail. */
  span: 'tall' | 'wide' | 'square'
}

export interface Review {
  id: string
  author: string
  initials: string
  rating: number
  /** Paraphrased from public review themes — never copied verbatim. */
  body: string
  when: string
  sport?: string
}
