'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

interface ToastApi {
  toast: (t: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const TONE_STYLES: Record<ToastTone, { icon: typeof Info; ring: string; accent: string }> = {
  success: { icon: CheckCircle2, ring: 'border-neon/40', accent: 'text-neon' },
  error: { icon: XCircle, ring: 'border-red-500/45', accent: 'text-red-400' },
  warning: { icon: AlertTriangle, ring: 'border-amber/45', accent: 'text-amber' },
  info: { icon: Info, ring: 'border-chalk/20', accent: 'text-chalk/80' },
}

const AUTO_DISMISS_MS = 5200

/**
 * Toasts for booking and payment feedback.
 *
 * Deliberately hand-rolled rather than pulling a library: we need exactly
 * four tones, one position, and an aria-live region — about 90 lines
 * against another dependency in the bundle.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++seq.current
      // Cap the stack — three is the most anyone reads.
      setToasts((prev) => [...prev.slice(-2), { ...t, id }])
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
      warning: (title, description) => toast({ tone: 'warning', title, description }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[150] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end sm:p-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map(({ id, tone, title, description }) => {
            const { icon: Icon, ring, accent } = TONE_STYLES[tone]
            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border',
                  'bg-night-800/95 p-4 shadow-lift backdrop-blur-md',
                  ring,
                )}
              >
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', accent)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[0.82rem] uppercase tracking-[0.1em] text-chalk">
                    {title}
                  </p>
                  {description ? (
                    <p className="mt-1 text-[0.82rem] leading-relaxed text-chalk/65">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(id)}
                  aria-label="Dismiss notification"
                  className="rounded-md p-1 text-chalk/40 transition-colors hover:text-chalk"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
