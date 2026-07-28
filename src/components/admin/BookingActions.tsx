'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, IndianRupee, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatINR } from '@/lib/pricing'

/**
 * Refund and resolve actions for one booking.
 *
 * Refunding asks for confirmation, because it moves real money and cannot
 * be undone from here. "Resolve" is the escape hatch for cases settled off
 * the system — moved to another slot, paid at the gate, credited.
 */
export function BookingActions({
  bookingId,
  amount,
  hasPayment,
  needsAttention,
}: {
  bookingId: string
  amount: number
  hasPayment: boolean
  needsAttention: boolean
}) {
  const router = useRouter()
  const { success, error, info } = useToast()
  const [busy, setBusy] = useState<'refund' | 'resolve' | null>(null)

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
    return json
  }

  async function onRefund() {
    if (busy) return
    const ok = window.confirm(
      `Refund ${formatINR(amount)} for this booking?\n\n` +
        `This returns the money to the customer and frees the slots. It cannot be undone here.`,
    )
    if (!ok) return

    setBusy('refund')
    try {
      const json = await post('/api/admin/refund', { bookingId })
      success('Refund issued', json.message ?? undefined)
      // Re-render the server component so the list reflects the new status.
      router.refresh()
    } catch (err) {
      error('Refund failed', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function onResolve() {
    if (busy) return
    setBusy('resolve')
    try {
      await post('/api/admin/resolve', { bookingId })
      info('Marked as handled', 'It will drop off the attention list.')
      router.refresh()
    } catch (err) {
      error('Could not update', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {hasPayment ? (
        <button
          type="button"
          onClick={onRefund}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1.5 font-display text-[0.62rem] uppercase tracking-[0.12em] text-red-300 transition-colors hover:border-red-500/70 hover:text-red-200 disabled:opacity-40"
        >
          {busy === 'refund' ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <IndianRupee className="h-3 w-3" aria-hidden />
          )}
          Refund {formatINR(amount)}
        </button>
      ) : null}

      {needsAttention ? (
        <button
          type="button"
          onClick={onResolve}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-chalk/20 px-3 py-1.5 font-display text-[0.62rem] uppercase tracking-[0.12em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon disabled:opacity-40"
        >
          {busy === 'resolve' ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3 w-3" aria-hidden />
          )}
          Handled
        </button>
      ) : null}
    </div>
  )
}
