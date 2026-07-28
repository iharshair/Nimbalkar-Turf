'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { MotionConfig } from 'framer-motion'
import { ScrollTrigger, gsap } from '@/lib/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface SmoothScrollApi {
  /** Scrolls to a section id or element. No-op before Lenis mounts. */
  scrollTo: (target: string | HTMLElement, offset?: number) => void
  stop: () => void
  start: () => void
}

const SmoothScrollContext = createContext<SmoothScrollApi>({
  scrollTo: () => {},
  stop: () => {},
  start: () => {},
})

export const useSmoothScroll = () => useContext(SmoothScrollContext)

/**
 * Lenis, driven by GSAP's ticker.
 *
 * The ordering here matters. Lenis must push its scroll position into
 * ScrollTrigger on every frame, and GSAP must own the RAF loop — running
 * two independent loops makes pinned sections jitter by a frame. We also
 * kill lagSmoothing so a slow frame doesn't desync the two.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  /**
   * Nested overlays (lightbox inside a modal, say) each ask for a lock.
   * Counting them means the last one to close is the one that restores
   * scrolling — a plain boolean would unlock too early, or never.
   */
  const lockCount = useRef(0)
  const [, setReady] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    // Reduced motion: hand scrolling back to the browser entirely.
    if (reducedMotion) {
      document.documentElement.classList.remove('lenis-active')
      return
    }

    const lenis = new Lenis({
      duration: 1.05,
      // Slightly front-loaded exponential — quick to respond, long tail.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      // Native momentum on touch is better than anything we'd emulate.
      syncTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
    })

    lenisRef.current = lenis
    document.documentElement.classList.add('lenis-active')

    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // Pinned sections change document height; let ScrollTrigger recompute.
    ScrollTrigger.refresh()
    setReady(true)

    /*
      next/font uses `display: swap`, so the real faces land after first
      paint and reflow the page. Every ScrollTrigger start/end measured
      before that is then wrong — reveals fire at the wrong scroll position
      and the pinned gallery mis-measures its rail. document.fonts.ready
      is the precise signal for "layout has settled".
    */
    let fontsSettled = false
    const refreshAfterFonts = () => {
      if (fontsSettled) return
      fontsSettled = true
      ScrollTrigger.refresh()
    }
    if (document.fonts?.status === 'loaded') refreshAfterFonts()
    else void document.fonts?.ready.then(refreshAfterFonts)

    return () => {
      lenis.off('scroll', ScrollTrigger.update)
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
      lenisRef.current = null
      document.documentElement.classList.remove('lenis-active')
    }
  }, [reducedMotion])

  const scrollTo = useCallback(
    (target: string | HTMLElement, offset = -72) => {
      const el = typeof target === 'string' ? document.getElementById(target.replace('#', '')) : target
      if (!el) return

      if (lenisRef.current) {
        lenisRef.current.scrollTo(el, { offset, duration: 1.2 })
      } else {
        // Reduced-motion / pre-mount path.
        const top = el.getBoundingClientRect().top + window.scrollY + offset
        window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
      }
    },
    [reducedMotion],
  )

  const stop = useCallback(() => {
    lockCount.current += 1
    if (lockCount.current > 1) return
    lenisRef.current?.stop()
    // Reduced-motion fallback: Lenis isn't running, so lock natively.
    if (!lenisRef.current) document.body.style.overflow = 'hidden'
  }, [])

  const start = useCallback(() => {
    lockCount.current = Math.max(0, lockCount.current - 1)
    if (lockCount.current > 0) return
    lenisRef.current?.start()
    if (!lenisRef.current) document.body.style.overflow = ''
  }, [])

  return (
    <SmoothScrollContext.Provider value={{ scrollTo, stop, start }}>
      {/*
        Framer Motion does not read prefers-reduced-motion by itself, and
        the CSS @media override in globals.css cannot touch JS-driven
        transforms. Without this, the modal, lightbox, toasts, mobile menu
        and FAB all kept animating for users who asked them not to.
        `reducedMotion="user"` keeps opacity fades and drops movement.
      */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </SmoothScrollContext.Provider>
  )
}
