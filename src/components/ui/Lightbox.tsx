'use client'

import { useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { GalleryItem } from '@/types'
import { useSmoothScroll } from '@/components/motion/SmoothScrollProvider'
import { cn } from '@/lib/utils'

interface LightboxProps {
  items: GalleryItem[]
  /** Null = closed. */
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

/** Distance (px) a drag must travel to count as a swipe. */
const SWIPE_THRESHOLD = 70

export function Lightbox({ items, index, onClose, onNavigate }: LightboxProps) {
  const open = index !== null && index >= 0 && index < items.length
  const item = open ? items[index!] : null
  const closeRef = useRef<HTMLButtonElement>(null)
  const { stop, start } = useSmoothScroll()

  const next = useCallback(() => {
    if (index === null) return
    onNavigate((index + 1) % items.length)
  }, [index, items.length, onNavigate])

  const prev = useCallback(() => {
    if (index === null) return
    onNavigate((index - 1 + items.length) % items.length)
  }, [index, items.length, onNavigate])

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, next, prev])

  // Freeze the page behind the overlay, and park focus on the close
  // button so keyboard users aren't left behind the backdrop.
  useEffect(() => {
    if (!open) return
    stop()
    const t = window.setTimeout(() => closeRef.current?.focus(), 60)
    return () => {
      start()
      window.clearTimeout(t)
    }
  }, [open, stop, start])

  return (
    <AnimatePresence>
      {open && item ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={item.caption}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[160] flex items-center justify-center bg-night/85 p-4 backdrop-blur-xl sm:p-8"
          // Click-outside: only when the backdrop itself is the target.
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          data-lenis-prevent
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="absolute right-4 top-4 z-10 rounded-full border border-chalk/15 bg-night-800/80 p-2.5 text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon sm:right-6 sm:top-6"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          <NavButton side="left" onClick={prev} />
          <NavButton side="right" onClick={next} />

          <motion.figure
            key={item.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragEnd={(_, info) => {
              if (info.offset.x < -SWIPE_THRESHOLD) next()
              else if (info.offset.x > SWIPE_THRESHOLD) prev()
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex max-h-full w-full max-w-5xl cursor-grab flex-col gap-4 active:cursor-grabbing"
            data-cursor="drag"
          >
            <div className="overflow-hidden rounded-card border border-chalk/10 bg-night-800">
              {item.type === 'video' ? (
                <video
                  src={item.src}
                  poster={item.poster}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[74vh] w-full bg-night object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.src}
                  alt={item.alt}
                  className="max-h-[74vh] w-full bg-night object-contain"
                  draggable={false}
                />
              )}
            </div>

            <figcaption className="flex items-center justify-between gap-4 text-sm">
              <span className="text-chalk/80">{item.caption}</span>
              <span className="shrink-0 font-display text-xs uppercase tracking-[0.16em] text-chalk/40">
                {index! + 1} / {items.length}
              </span>
            </figcaption>
          </motion.figure>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous item' : 'Next item'}
      className={cn(
        'absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-chalk/15',
        'bg-night-800/80 p-3 text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon sm:block',
        side === 'left' ? 'left-4 lg:left-8' : 'right-4 lg:right-8',
      )}
    >
      <Icon className="h-6 w-6" aria-hidden />
    </button>
  )
}
