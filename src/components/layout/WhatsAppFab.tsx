'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WHATSAPP_ENQUIRY, whatsappLink } from '@/lib/whatsapp'

/**
 * Persistent WhatsApp button, bottom-right.
 *
 * Appears after a small scroll so it never competes with the hero CTA,
 * and sits above the toast layer's z-index but below any modal.
 */
export function WhatsAppFab() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.a
          href={whatsappLink(WHATSAPP_ENQUIRY)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          data-magnetic
          data-cursor="Chat"
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 16 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          className="group fixed bottom-5 right-5 z-[140] grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-night shadow-[0_10px_36px_-8px_rgba(37,211,102,0.75)] sm:bottom-7 sm:right-7"
        >
          {/* Gentle pulse — one ring, slow, stopped for reduced motion. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#25D366]/55 animate-pulse-ring motion-reduce:animate-none"
          />
          <WhatsAppGlyph className="relative h-7 w-7" />
          <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-full border border-chalk/15 bg-night-800/95 px-3.5 py-2 font-display text-[0.65rem] uppercase tracking-[0.14em] text-chalk opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:block">
            Chat with us
          </span>
        </motion.a>
      ) : null}
    </AnimatePresence>
  )
}

/** Inline so the FAB costs no extra request and no icon-set dependency. */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.02.07-1.75-.11-.44-.11-1.02-.3-1.76-.62-3.1-1.34-5.12-4.47-5.28-4.68-.15-.2-1.25-1.66-1.25-3.17 0-1.5.79-2.24 1.07-2.55.28-.3.61-.38.81-.38.2 0 .41 0 .58.01.19.01.44-.07.69.53.24.6.83 2.02.9 2.17.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.25 1.62 2.02 1.11.99 2.05 1.3 2.34 1.45.29.15.46.13.63-.08.17-.2.73-.85.93-1.14.2-.3.4-.25.67-.15.28.1 1.75.83 2.05.98.3.15.5.22.57.35.07.13.07.75-.17 1.43Z" />
    </svg>
  )
}
