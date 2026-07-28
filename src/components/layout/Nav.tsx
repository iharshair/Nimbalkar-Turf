'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Menu, Phone, X } from 'lucide-react'
import { BUSINESS, NAV_LINKS } from '@/lib/business'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useSmoothScroll } from '@/components/motion/SmoothScrollProvider'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { useBooking } from '@/context/BookingContext'
import { Logo } from '@/components/layout/Logo'
import { cn } from '@/lib/utils'

const SECTION_IDS = NAV_LINKS.map((l) => l.id)

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)
  const { scrollTo, stop, start } = useSmoothScroll()
  const { open: openBooking } = useBooking()

  // Transparent over the hero, solid once you've left it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock the page behind the mobile menu, and close it on Escape.
  useEffect(() => {
    if (!menuOpen) return
    stop()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      start()
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, stop, start])

  const go = useCallback(
    (id: string) => {
      setMenuOpen(false)
      // Let the overlay finish closing before Lenis takes the scroll.
      window.setTimeout(() => scrollTo(id), 120)
    },
    [scrollTo],
  )

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[120] transition-[background-color,backdrop-filter,box-shadow] duration-500 ease-turf',
          scrolled ? 'bg-night/80 backdrop-blur-xl' : 'bg-transparent',
        )}
        style={{ height: 'var(--nav-h)' }}
      >
        <div className="shell flex h-full items-center justify-between gap-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault()
              scrollTo('top', 0)
            }}
            aria-label={`${BUSINESS.name} — back to top`}
            data-magnetic
          >
            <Logo />
          </a>

          {/* Desktop links with a sliding active indicator. */}
          <nav aria-label="Sections" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = active === link.id
                return (
                  <li key={link.id}>
                    <a
                      href={`#${link.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        go(link.id)
                      }}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'relative block px-3.5 py-2 font-display text-[0.72rem] uppercase tracking-[0.18em] transition-colors duration-300',
                        isActive ? 'text-neon' : 'text-chalk/60 hover:text-chalk',
                      )}
                    >
                      {link.label}
                      {/*
                        One shared layoutId means Framer Motion slides the
                        same underline element between links instead of
                        cross-fading two of them.
                      */}
                      {isActive ? (
                        <motion.span
                          layoutId="nav-underline"
                          className="absolute inset-x-2.5 -bottom-0.5 h-px bg-neon"
                          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        />
                      ) : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={`tel:${BUSINESS.phoneTel}`}
              data-cursor="call"
              data-magnetic
              aria-label={`Call ${BUSINESS.name} on ${BUSINESS.phone}`}
              className="hidden items-center gap-2 rounded-full border border-chalk/15 px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.16em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon sm:inline-flex"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {BUSINESS.phone}
            </a>

            <MagneticButton size="md" cursorLabel="book" onClick={() => openBooking()}>
              Book Slot
            </MagneticButton>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="grid h-11 w-11 place-items-center rounded-full border border-chalk/15 text-chalk/80 transition-colors hover:border-neon/50 hover:text-neon lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Pitch-line border, drawn rather than bordered so it can fade. */}
        <div
          aria-hidden
          className={cn(
            'pitch-line absolute inset-x-0 bottom-0 transition-opacity duration-500',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={go} />
    </>
  )
}

/* ── Mobile full-screen menu ─────────────────────────────────────────── */

// Annotated as `Variants` so the cubic-bezier arrays are contextually
// typed as 4-tuples rather than widening to number[].
const overlayVariants: Variants = {
  hidden: { opacity: 0, x: '100%' },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.055,
      delayChildren: 0.12,
    },
  },
  exit: { opacity: 0, x: '100%', transition: { duration: 0.34, ease: [0.4, 0, 1, 1] } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: 12 },
}

function MobileMenu({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  const { open: openBooking } = useBooking()

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[130] flex flex-col bg-night lg:hidden"
          data-lenis-prevent
        >
          <div className="turf-noise pointer-events-none absolute inset-0" aria-hidden />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-floodlight blur-2xl"
          />

          <div className="shell relative flex items-center justify-between" style={{ height: 'var(--nav-h)' }}>
            <Logo compact />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="grid h-11 w-11 place-items-center rounded-full border border-chalk/15 text-chalk/80"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav aria-label="Sections" className="shell relative flex flex-1 flex-col justify-center">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link, i) => (
                <motion.li key={link.id} variants={itemVariants}>
                  <a
                    href={`#${link.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      onNavigate(link.id)
                    }}
                    className="flex items-baseline gap-4 py-2.5 font-display text-display-sm uppercase text-chalk transition-colors active:text-neon"
                  >
                    <span className="w-8 text-[0.7rem] tracking-[0.2em] text-neon/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {link.label}
                  </a>
                </motion.li>
              ))}
            </ul>
          </nav>

          <motion.div variants={itemVariants} className="shell relative space-y-3 pb-10">
            <MagneticButton
              fullWidth
              onClick={() => {
                onClose()
                window.setTimeout(() => openBooking(), 260)
              }}
            >
              Book Your Slot
            </MagneticButton>
            <a
              href={`tel:${BUSINESS.phoneTel}`}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-chalk/15 font-display text-[0.85rem] uppercase tracking-[0.14em] text-chalk/80"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {BUSINESS.phone}
            </a>
            <p className="pt-2 text-center font-deva text-xs text-chalk/40">
              {BUSINESS.taglineMr}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
