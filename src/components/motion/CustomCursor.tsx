'use client'

import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/**
 * Site-wide cursor replacement: a football boot (stud).
 *
 * Three behaviours, all opt-in through data attributes so markup stays
 * declarative:
 *
 *   data-cursor="view|book|play|drag"  → contextual label beside the boot
 *   data-magnetic                      → boot is pulled toward the
 *                                        element's centre within a radius
 *   (any a/button)                     → boot grows and turns chalk
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

/* ── Geometry ────────────────────────────────────────────────────────────
   The artwork is drawn in a 40x30 box with the toe tip at roughly
   (1, 20). Those fractions place the toe exactly on the pointer, so the
   boot points at what you're actually about to click rather than hovering
   near it. */
const ART_W = 40
const ART_H = 30
const TOE_X = 1 / ART_W
const TOE_Y = 20 / ART_H

/** Side-profile football boot with four studs. Fills with currentColor. */
function StudGlyph({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox={`0 0 ${ART_W} ${ART_H}`}
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      {/* Upper and sole as one silhouette — bolder, and reads at ~34px. */}
      <path d="M2 19.2c0-3 3-4.8 6.8-5.8 3.5-.9 6-2.4 8-5l3-3.7c1-1.3 2.4-2 3.9-2h7.1c2.4 0 4.2 1.9 4.2 4.2v12.3h1.2c1 0 1.8.8 1.8 1.8v1.2c0 1.6-1.3 2.9-2.9 2.9H3.9C2.3 25.1 1 23.8 1 22.2V21c0-1 .8-1.8 1.8-1.8H2z" />
      {/* Studs. */}
      <rect x="4.5" y="24.9" width="3" height="3.4" rx="1.3" />
      <rect x="12" y="24.9" width="3" height="3.4" rx="1.3" />
      <rect x="21" y="24.9" width="3" height="3.4" rx="1.3" />
      <rect x="30" y="24.9" width="3" height="3.4" rx="1.3" />
      {/* Laces, punched through in the page background colour. */}
      <path
        d="M16.6 10.1l4.2 2.1M19.1 7.1l4.2 2.1"
        stroke="#0A0E14"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function CustomCursor() {
  const bootRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [variant, setVariant] = useState<Variant>('default')
  const [label, setLabel] = useState<string | null>(null)
  const [pressed, setPressed] = useState(false)
  const [visible, setVisible] = useState(false)

  const reducedMotion = usePrefersReducedMotion()
  /**
   * Gate on the same query the markup uses (`lg` + fine pointer), so
   * `cursor: none` is never applied without a replacement being visible.
   */
  const isDesktop = useIsDesktop()
  const enabled = !reducedMotion && isDesktop

  // Render nothing until mounted. The server can't know the pointer type
  // or motion preference, so committing markup on the first pass and then
  // removing it is a guaranteed hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Toggle the class that hides the native cursor.
  useEffect(() => {
    const root = document.documentElement
    if (enabled) root.classList.add('cursor-custom')
    else root.classList.remove('cursor-custom')
    return () => root.classList.remove('cursor-custom')
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const boot = bootRef.current
    const dot = dotRef.current
    if (!boot || !dot) return

    // quickTo gives us a tweened setter — the boot trails, the dot is
    // near-instant, which reads as weight without feeling laggy.
    const bootX = gsap.quickTo(boot, 'x', { duration: 0.42, ease: 'power3.out' })
    const bootY = gsap.quickTo(boot, 'y', { duration: 0.42, ease: 'power3.out' })
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power2.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power2.out' })

    let magnetTarget: HTMLElement | null = null

    const onMove = (e: PointerEvent) => {
      if (!visible) setVisible(true)

      let x = e.clientX
      let y = e.clientY

      // Magnetic pull: bend the boot toward the element's centre while the
      // real pointer keeps its true position (the dot stays honest).
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

      bootX(x)
      bootY(y)
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

  const width = variant === 'labelled' ? 46 : variant === 'interactive' ? 46 : 34
  const height = width * (ART_H / ART_W)

  // A planted boot at rest; drawn back further as you press, like a kick.
  const rotation = pressed ? -24 : variant === 'default' ? -8 : -15

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] hidden lg:block">
      {/*
        Two nested elements on purpose: GSAP owns the outer transform
        (x/y), React owns the inner one (rotate/scale). Writing both from
        React would let a re-render clobber the tween mid-flight.
      */}
      <div ref={bootRef} className="absolute left-0 top-0 will-change-transform">
        <div
          className="flex items-center gap-2"
          style={{
            // Put the toe of the boot on the actual pointer position.
            marginLeft: -width * TOE_X,
            marginTop: -height * TOE_Y,
            opacity: visible && variant !== 'hidden' ? 1 : 0,
            transition: 'opacity 220ms ease-out',
          }}
        >
          <StudGlyph
            className={cn(
              'shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]',
              'transition-[width,height,color,transform] duration-300 ease-turf',
              variant === 'default' ? 'text-neon' : 'text-chalk',
            )}
            // Inline so the size can animate between variants.
            style={{
              width,
              height,
              transform: `rotate(${rotation}deg) scale(${pressed ? 0.92 : 1})`,
              transformOrigin: '20% 80%',
            }}
          />

          {label ? (
            <span className="whitespace-nowrap rounded-full bg-chalk px-2.5 py-1 font-display text-[0.6rem] uppercase tracking-[0.14em] text-night shadow-lift">
              {label}
            </span>
          ) : null}
        </div>
      </div>

      {/* Dot — always tracks the true pointer position, so the magnetic
          pull can't cost you precision on the slot grid. */}
      <div
        ref={dotRef}
        className="absolute left-0 top-0 -ml-[2px] -mt-[2px] h-1 w-1 rounded-full bg-neon will-change-transform"
        style={{ opacity: visible && variant === 'default' ? 1 : 0 }}
      />
    </div>
  )
}
