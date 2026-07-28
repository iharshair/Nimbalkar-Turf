import { z } from 'zod'
import { BOOKING_WINDOW_DAYS } from '@/lib/slots'
import { addDays, clubToday } from '@/lib/utils'

/** Indian mobile numbers: 10 digits starting 6–9, tolerant of +91/0/spaces. */
const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .transform((v) => v.replace(/[^\d]/g, ''))
  .refine((v) => /^(?:91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number')
  .transform((v) => (v.length === 12 ? v.slice(2) : v))

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
  .refine((v) => {
    const today = clubToday()
    // BOOKING_WINDOW_DAYS counts today, so the last bookable day is
    // today + (N - 1) — exactly what DateStrip renders.
    return v >= today && v <= addDays(today, BOOKING_WINDOW_DAYS - 1)
  }, `Pick a date within the next ${BOOKING_WINDOW_DAYS} days`)

const slotIdSchema = z.string().regex(/^([01]\d|2[0-3]):00$/, 'Invalid slot')

/** The details step of the booking flow. */
export const bookingDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name')
    .max(60, 'That name is too long')
    .regex(/^[\p{L}\s.'-]+$/u, 'Letters, spaces, apostrophes and hyphens only'),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email('Enter a valid email, or leave this blank')
    .optional()
    .or(z.literal('')),
  sport: z.enum(['football', 'cricket', 'other']),
  // Not `.default(true)` on purpose: a schema whose input and output
  // types differ makes zodResolver's generics fight useForm's.
  whatsappOptIn: z.boolean(),
  notes: z.string().trim().max(280, 'Keep notes under 280 characters').optional().or(z.literal('')),
  policyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm you have read the overtime policy' }),
  }),
})

export type BookingDetails = z.infer<typeof bookingDetailsSchema>

/** POST /api/razorpay/order */
export const createOrderSchema = z.object({
  date: isoDateSchema,
  slotIds: z.array(slotIdSchema).min(1, 'Select at least one slot').max(6, 'Maximum 6 hours per booking'),
  details: bookingDetailsSchema,
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

/** POST /api/razorpay/verify */
export const verifyPaymentSchema = z.object({
  bookingId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
})

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>
