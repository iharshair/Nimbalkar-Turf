'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/**
 * Site-wide cursor replacement.
 *
 * Three behaviours, all opt-in through data attributes so markup stays
 * declarative:
 *
 *   data-cursor="view|book|play|drag"  → contextual label + grown ring
 *   data-magnetic                      → ring is pulled toward the
 *                                        element's centre within a radius
 *   (any a/button)                     → default grow + colour inversion
 *
 * Hard-disabled on touch devices and when prefers-reduced-motion is set;
 * in both cases the native cursor is restored (see globals.css, which
 * only hides it under .cursor-custom on the html element).
 */

type Variant = 'default' | 'interactive' | 'labelled' | 'hidden'

const LABELS: Record<string, string> = {
  view: 'View',
  book: 'Book',
  play: 'Play',
  drag: 'Drag',
  call: 'Call',
  map: 'Open map',
}

/** How far outside an element's centre the magnetic pull still reaches. */
const MAGNET_PADDING = 26
/** 0 = no pull, 1 = cursor snaps to centre. */
const MAGNET_STRENGTH = 0.42

export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [variant, setVariant] = useState<Variant>('default')
  const [label, setLabel] = useState<string | null>(null)
  const [pressed, setPressed] = useState(false)
  const [visible, setVisible] = useState(false)

  const reducedMotion = usePrefersReducedMotion()
  /**
   * Gate on the same query the markup uses (`lg` + fine pointer). The old
   * check was `!isTouch`, which is true for a 800px-wide laptop — so
   * `cursor: none` was applied while the replacement cursor stayed
   * `hidden lg:block`, leaving no visible cursor at all between 768px and
   * 1023px.
   */
  const isDesktop = useIsDesktop()
  const enabled = !reducedMotion && isDesktop

  // Render nothing until mounted. The server can't know the pointer type
  // or motion preference, so committing markup on the first pass and then
  // removing it is a guaranteed hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Toggle the class that hides the native cursor. Kept off the initial
  // SSR markup so a touch user never loses their cursor mid-hydration.
  useEffect(() => {
    const root = document.documentElement
    if (enabled) root.classList.add('cursor-custom')
    else root.classList.remove('cursor-custom')
    return () => root.classList.remove('cursor-custom')
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const ring = ringRef.current
    const dot = dotRef.current
    if (!ring || !dot) return

    // quickTo gives us a tweened setter — the ring trails, the dot is
    // near-instant, which reads as weight without feeling laggy.
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3.out' })
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power2.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power2.out' })

    let magnetTarget: HTMLElement | null = null

    const onMove = (e: PointerEvent) => {
      if (!visible) setVisible(true)

      let x = e.clientX
      let y = e.clientY

      // Magnetic pull: bend the ring toward the element's centre while
      // the real pointer keeps its true position (the dot stays honest).
      if (magnetTarget) {
        const r = magnetTarget.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const withinX = Math.abs(x - cx) < r.width / 2 + MAGNET_PADDING
        const withinY = Math.abs(y - cy) < r.height / 2 + MAGNET_PADDING
        if (withinX && withinY) {
          x += (cx - x) * MAGNET_STRENGTH
          y += (cy - y) * MAGNET_STRENGTH
        }
      }

      ringX(x)
      ringY(y)
      dotX(e.clientX)
      dotY(e.clientY)
    }

    const resolve = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return

      const cursorEl = target.closest<HTMLElement>('[data-cursor]')
      const magnetEl = target.closest<HTMLElement>('[data-magnetic]')
      magnetTarget = magnetEl ?? null

      if (cursorEl) {
        const key = cursorEl.dataset.cursor ?? ''
        if (key === 'hidden') {
          setVariant('hidden')
          setLabel(null)
          return
        }
        // An unknown value is treated as literal label text.
        const text = LABELS[key] ?? (key ? cursorEl.dataset.cursorLabel ?? key : null)
        setVariant(text ? 'labelled' : 'interactive')
        setLabel(text)
        return
      }

      const interactive = target.closest(
        'a, button, [role="button"], input, select, textarea, label, summary, [data-interactive]',
      )
      setVariant(interactive ? 'interactive' : 'default')
      setLabel(null)
    }

    const onOver = (e: PointerEvent) => resolve(e.target)
    const onDown = () => setPressed(true)
    const onUp = () => setPressed(false)
    const onLeaveWindow = () => setVisible(false)
    const onEnterWindow = () => setVisible(true)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    document.addEventListener('mouseleave', onLeaveWindow)
    document.addEventListener('mouseenter', onEnterWindow)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('mouseleave', onLeaveWindow)
      document.removeEventListener('mouseenter', onEnterWindow)
    }
    // `visible` is intentionally excluded: including it would tear down
    // and rebuild every listener on the first mouse move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  if (!mounted || !enabled) return null

  const size =
    variant === 'labelled' ? 74 : variant === 'interactive' ? 52 : variant === 'hidden' ? 0 : 26

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] hidden lg:block">
      {/*
        Two nested elements on purpose: GSAP owns the outer transform
        (x/y), React owns the inner one (scale/size). Writing both from
        React would let a re-render clobber the tween mid-flight.
      */}
      <div ref={ringRef} className="absolute left-0 top-0 will-change-transform">
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            'border border-chalk/70 bg-chalk/5 backdrop-blur-[1px]',
            'transition-[width,height,opacity,transform,background-color,border-color]',
            'duration-300 ease-turf mix-blend-difference',
            variant === 'labelled' && 'border-transparent bg-chalk',
          )}
          style={{
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            opacity: visible && variant !== 'hidden' ? 1 : 0,
            transform: `scale(${pressed ? 0.82 : 1})`,
          }}
        >
          {label ? (
            <span className="font-display text-[0.6rem] uppercase tracking-[0.14em] text-night">
              {label}
            </span>
          ) : null}
        </div>
      </div>

      {/* Dot — always tracks the true pointer position. */}
      <div
        ref={dotRef}
        className="absolute left-0 top-0 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-neon will-change-transform"
        style={{ opacity: visible && variant === 'default' ? 1 : 0 }}
      />
    </div>
  )
}
