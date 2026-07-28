'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2, Unlock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ALL_HOURS, slotId } from '@/lib/slots'
import { cn, formatHour } from '@/lib/utils'
import type { Slot } from '@/types'

/**
 * Takes hours off sale for maintenance, or puts them back.
 *
 * The `blocked` status has existed in the data model and the customer slot
 * grid ("Maintenance") since the beginning — nothing could set it until
 * now. The server refuses to block an hour a customer already holds, and
 * says which ones it refused, so cutting the pitch never silently
 * cancels someone's game.
 */
export function SlotBlocker({ date, slots }: { date: string; slots: Slot[] }) {
  const router = useRouter()
  const { success, error, warning } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const byId = new Map(slots.map((s) => [s.id, s]))

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  async function submit(status: 'blocked' | 'available') {
    if (busy || !selected.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, slotIds: selected, status }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string | null
        changed?: string[]
      }
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)

      if (json.message) warning('Some hours were left alone', json.message)
      else
        success(
          status === 'blocked' ? 'Hours blocked' : 'Hours released',
          `${json.changed?.length ?? 0} slot(s) updated.`,
        )

      setSelected([])
      router.refresh()
    } catch (err) {
      error('Could not update slots', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
        {ALL_HOURS.map((hour) => {
          const id = slotId(hour)
          const slot = byId.get(id)
          const isSelected = selected.includes(id)
          const taken = slot?.status === 'booked' || slot?.status === 'held'
          const blocked = slot?.status === 'blocked'

          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={busy}
              aria-pressed={isSelected}
              title={taken ? 'A customer holds this hour' : blocked ? 'Blocked' : 'Available'}
              className={cn(
                'rounded-lg border px-1 py-2 text-center font-display text-[0.62rem] uppercase tracking-[0.06em] transition-colors',
                isSelected
                  ? 'border-neon bg-neon text-night'
                  : blocked
                    ? 'border-amber/40 bg-amber/[0.08] text-amber'
                    : taken
                      ? 'border-chalk/10 bg-chalk/[0.03] text-chalk/40'
                      : 'border-chalk/12 text-chalk/70 hover:border-chalk/35',
              )}
            >
              {formatHour(hour).replace(':00', '')}
            </button>
          )
        })}
      </div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-chalk/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-amber" aria-hidden /> blocked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-chalk/25" aria-hidden /> customer booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-chalk/35" aria-hidden /> free
        </span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit('blocked')}
          disabled={busy || !selected.length}
          className="inline-flex items-center gap-2 rounded-full border border-amber/45 px-4 py-2 font-display text-[0.66rem] uppercase tracking-[0.12em] text-amber transition-colors hover:border-amber disabled:opacity-30"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
          Block {selected.length ? `(${selected.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => submit('available')}
          disabled={busy || !selected.length}
          className="inline-flex items-center gap-2 rounded-full border border-chalk/20 px-4 py-2 font-display text-[0.66rem] uppercase tracking-[0.12em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon disabled:opacity-30"
        >
          <Unlock className="h-3.5 w-3.5" />
          Release {selected.length ? `(${selected.length})` : ''}
        </button>
      </div>
    </div>
  )
}
