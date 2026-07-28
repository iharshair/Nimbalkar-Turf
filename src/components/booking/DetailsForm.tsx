'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Check, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { bookingDetailsSchema, type BookingDetails } from '@/lib/schema'
import { OVERTIME_POLICY, formatINR } from '@/lib/pricing'
import { BUSINESS } from '@/lib/business'
import { useBooking } from '@/context/BookingContext'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { describeSlotRanges, cn, fromISODate } from '@/lib/utils'
import type { Sport } from '@/types'

const SPORTS: { value: Sport; label: string }[] = [
  { value: 'football', label: 'Football' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'other', label: 'Something else' },
]

interface DetailsFormProps {
  onBack: () => void
  onSubmit: (details: BookingDetails) => Promise<void>
  submitting: boolean
}

/**
 * Contact details + the policy acknowledgement, then payment.
 *
 * Validation feedback is deliberately physical: an invalid field shakes
 * once and glows red; a valid one gets a green check. The customer should
 * never have to hunt for what's wrong.
 */
export function DetailsForm({ onBack, onSubmit, submitting }: DetailsFormProps) {
  const { date, selected, total, details, setDetails } = useBooking()
  const [shakeKey, setShakeKey] = useState(0)
  /**
   * Guards against double-submit. `submitting` arrives as a prop only
   * after the parent's async work starts, and zodResolver validation is
   * itself async — so two quick activations could both reach onSubmit and
   * POST /order twice. The second order then collides with the first
   * one's own hold and 409s, bouncing the customer out of checkout.
   */
  const inFlight = useRef(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, touchedFields, dirtyFields },
  } = useForm<BookingDetails>({
    resolver: zodResolver(bookingDetailsSchema),
    mode: 'onBlur',
    defaultValues: details ?? {
      name: '',
      phone: '',
      email: '',
      sport: 'football',
      whatsappOptIn: true,
      notes: '',
      // policyAccepted is intentionally absent — it must be ticked, never
      // pre-accepted on the customer's behalf.
    },
  })

  // Preserve what was typed if the modal closes or a payment fails, so a
  // retry doesn't mean filling the form out twice — but deliberately drop
  // `policyAccepted`. Restoring it pre-ticked would defeat the point of
  // making the customer acknowledge the overtime rule.
  useEffect(() => {
    return () => {
      const { policyAccepted: _reaffirmEachTime, ...draft } = getValues()
      setDetails(draft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ranges = describeSlotRanges(selected).join(', ')
  const longDate = fromISODate(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  /** A field is "good" once it's been touched, changed, and has no error. */
  const stateFor = (field: keyof BookingDetails) => {
    if (errors[field]) return 'error' as const
    if (touchedFields[field] && dirtyFields[field]) return 'valid' as const
    return 'idle' as const
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(
        async (data) => {
          if (inFlight.current) return
          inFlight.current = true
          try {
            setDetails(data)
            await onSubmit(data)
          } finally {
            inFlight.current = false
          }
        },
        // Invalid submit: shake the whole form once.
        () => setShakeKey((k) => k + 1),
      )}
      className="space-y-6"
    >
      {/* Order summary — never let anyone pay without seeing this again. */}
      <div className="rounded-xl border border-chalk/12 bg-chalk/[0.02] p-4">
        <dl className="grid gap-y-2 text-[0.82rem] sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-chalk/60">Date</dt>
          <dd className="text-chalk/85 sm:text-right">{longDate}</dd>
          <dt className="text-chalk/60">Time</dt>
          <dd className="text-chalk/85 sm:text-right">{ranges}</dd>
          <dt className="text-chalk/60">Payable now</dt>
          <dd className="font-display text-base text-neon sm:text-right">{formatINR(total)}</dd>
        </dl>
      </div>

      <div
        key={shakeKey}
        className={cn(shakeKey > 0 && 'animate-shake motion-reduce:animate-none', 'space-y-4')}
      >
        <Field
          label="Your name"
          error={errors.name?.message}
          state={stateFor('name')}
          required
        >
          <input
            {...register('name')}
            type="text"
            autoComplete="name"
            placeholder="Rohit Nimbalkar"
            className={inputClass(stateFor('name'))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Mobile number"
            error={errors.phone?.message}
            state={stateFor('phone')}
            hint="We'll send your confirmation here"
            required
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[0.85rem] text-chalk/60">
                +91
              </span>
              <input
                {...register('phone')}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className={cn(inputClass(stateFor('phone')), 'pl-14')}
              />
            </div>
          </Field>

          <Field
            label="Email"
            error={errors.email?.message}
            state={stateFor('email')}
            hint="Optional — for a receipt"
          >
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass(stateFor('email'))}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 font-display text-[0.66rem] uppercase tracking-[0.16em] text-chalk/60">
            What are you playing?
          </legend>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <label
                key={sport.value}
                className="cursor-pointer rounded-full border border-chalk/12 px-4 py-2 text-[0.8rem] text-chalk/60 transition-colors has-[:checked]:border-neon has-[:checked]:bg-neon has-[:checked]:text-night hover:border-chalk/30"
              >
                <input
                  {...register('sport')}
                  type="radio"
                  value={sport.value}
                  className="sr-only"
                />
                {sport.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Anything we should know?" state="idle" hint="Optional">
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Bringing 14 players, need the nets set up…"
            className={cn(inputClass(stateFor('notes')), 'h-auto resize-none py-3')}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-chalk/12 p-3.5 transition-colors hover:border-chalk/25">
          <input
            {...register('whatsappOptIn')}
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-neon"
          />
          <span className="text-[0.82rem] leading-relaxed text-chalk/65">
            Send my confirmation and reminders on WhatsApp to this number.
          </span>
        </label>

        {/* Explicit acknowledgement of the overtime policy. */}
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
            errors.policyAccepted
              ? 'border-red-500/60 bg-red-500/[0.05]'
              : 'border-amber/25 bg-amber/[0.05] hover:border-amber/45',
          )}
        >
          <input
            {...register('policyAccepted')}
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-neon"
          />
          <span className="text-[0.82rem] leading-relaxed text-chalk/70">
            I&apos;ve read the overtime policy: {OVERTIME_POLICY.graceMinutes} minutes grace, then{' '}
            {formatINR(OVERTIME_POLICY.blockRate)} per {OVERTIME_POLICY.blockMinutes} minutes, capped
            at one hour.
            {errors.policyAccepted ? (
              <span className="mt-1 block text-red-400">{errors.policyAccepted.message}</span>
            ) : null}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <MagneticButton type="submit" fullWidth disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Opening payment…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" aria-hidden />
              Pay {formatINR(total)}
            </>
          )}
        </MagneticButton>

        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-chalk/15 px-6 font-display text-[0.78rem] uppercase tracking-[0.14em] text-chalk/60 transition-colors hover:border-chalk/35 hover:text-chalk disabled:opacity-40 sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Change slots
        </button>
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-[0.72rem] text-chalk/55">
        <ShieldCheck className="h-3.5 w-3.5 text-neon/60" aria-hidden />
        Secured by Razorpay · UPI, cards and netbanking · Questions? {BUSINESS.phone}
      </p>
    </form>
  )
}

/* ── Field primitives ────────────────────────────────────────────────── */

function inputClass(state: 'idle' | 'valid' | 'error') {
  return cn(
    'h-12 w-full rounded-xl border bg-night-700/60 px-4 text-[0.9rem] text-chalk',
    'placeholder:text-chalk/30 outline-none transition-[border-color,box-shadow] duration-300',
    state === 'error'
      ? 'field-error'
      : state === 'valid'
        ? 'field-valid'
        : 'border-chalk/12 focus:border-neon/60 focus:shadow-[0_0_0_3px_rgba(57,255,110,0.1)]',
  )
}

function Field({
  label,
  hint,
  error,
  state,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  state: 'idle' | 'valid' | 'error'
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="font-display text-[0.66rem] uppercase tracking-[0.16em] text-chalk/60">
          {label}
          {required ? <span className="ml-1 text-neon">*</span> : null}
        </span>
        {state === 'valid' ? (
          <Check className="h-3.5 w-3.5 text-neon" aria-hidden />
        ) : hint && !error ? (
          <span className="text-[0.66rem] text-chalk/55">{hint}</span>
        ) : null}
      </span>

      {children}

      {error ? (
        <span role="alert" className="mt-1.5 block text-[0.74rem] text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  )
}
