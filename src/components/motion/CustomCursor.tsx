'use client'

import { useEffect, useRef, useState } from 'react'
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
 *   (any a/button)                     → boot grows slightly
 *
 * The boot is the only thing drawn. There is deliberately no tracking dot,
 * ring or halo behind it — one pointer on screen, nothing else.
 *
 * The artwork lives in `public/media/football-boot.png` rather than inline,
 * so replacing it is a one-file change with no code edit. Keep the toe tip
 * near (5, 7.5) of a 100x100 square, or update TOE_X / TOE_Y below.
 * It's preloaded in `(site)/layout.tsx` so it never arrives late.
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
/*
  Fraction of the remaining magnetic offset closed each frame.

  This is the only smoothing left in the component, and it is applied to
  the magnetic *offset* alone — never to the pointer position. The boot
  tracks the mouse 1:1; only the pull toward an element's centre eases in,
  because that offset appears the instant you cross an element's edge and
  snapping it would look like a glitch. At 0.3 it is 94% settled after 8
  frames (~130ms), which reads as a gentle attraction rather than motion
  you have to wait for.
*/
const MAGNET_EASE = 0.3

/*
  ── SWAPPING IN YOUR OWN ARTWORK ──────────────────────────────────────
  Change this one line. Nothing else needs touching.

  A square PNG of 128px or more works, as does an SVG. The current file is
  a 160x160 PNG, which is 4x the largest on-screen size.

  Upload via GitHub: repo -> public/media -> Add file -> Upload files.
  Then edit this line in the same web UI if the extension differs.

  Three things to keep in mind:
    - Use a square canvas. The <img> below is sized square, so a
      non-square file will be stretched.
    - The toe tip should sit near (5, 7.5) of that canvas, i.e. about 5%
      across and 8% down. That's the pointer hotspot. If yours differs,
      change TOE_X / TOE_Y below.
    - Crop out transparent padding. A boot sitting in a big empty square
      renders tiny at cursor size; if you can't crop it, raise
      CURSOR_SIZE below to compensate. Keep the file small — it's
      preloaded on every page, so a multi-megabyte export is not free.
*/
export const CURSOR_ART = '/media/football-boot.png'

/*
  Sized to sit alongside a normal OS pointer, which is roughly 24-32 CSS
  px tall. Much larger and it stops reading as a cursor and starts
  reading as a sticker following the mouse.
*/
const CURSOR_SIZE = 30
/**
 * Grows slightly over links and buttons, as an affordance. Only ever
 * applied as a scale ratio against CURSOR_SIZE — the rendered box stays
 * CURSOR_SIZE so hovering never triggers layout.
 */
const CURSOR_SIZE_ACTIVE = 38

/* ── Geometry ────────────────────────────────────────────────────────────
   The boot is angled up-left with its toe in the top-left corner, so the
   hotspot sits near the very start of the canvas. Measured off the actual
   artwork: the silhouette's up-left extremity is at (2.5, 5.0), and these
   values sit just inside it, on the toe rather than on its antialiased
   edge. Expressed as fractions so the hotspot survives any size change —
   it puts the toe exactly on the pointer, so the boot points at what
   you're about to click rather than hovering near it. */
const TOE_X = 5 / 100
const TOE_Y = 7.5 / 100

export function CustomCursor() {
  const bootRef = useRef<HTMLDivElement>(null)
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
    if (!boot) return

    /*
      Position is written straight to the element from a rAF callback with
      no tween in between — `translate3d` is set to the raw pointer
      coordinates, so the boot is exactly where the mouse is on the very
      next frame.

      Going through rAF rather than writing in the handler doesn't cost
      latency: a callback queued from inside an input handler still runs
      before that frame's paint. What it buys is one style write per frame
      instead of one per event, which matters because high-polling mice
      fire pointermove far more often than the display refreshes.
    */
    const pointer = { x: 0, y: 0 }
    /** Current and desired magnetic displacement, in px. */
    const pull = { x: 0, y: 0 }
    const wanted = { x: 0, y: 0 }
    let frame: number | null = null
    let magnetTarget: HTMLElement | null = null

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(draw)
    }

    // A hoisted declaration, so `schedule` above can refer to it.
    function draw() {
      frame = null

      const dx = wanted.x - pull.x
      const dy = wanted.y - pull.y
      // Snap when the remainder goes sub-pixel. Without this the offset
      // only ever approaches its target, so the loop would never idle.
      pull.x = Math.abs(dx) < 0.05 ? wanted.x : pull.x + dx * MAGNET_EASE
      pull.y = Math.abs(dy) < 0.05 ? wanted.y : pull.y + dy * MAGNET_EASE

      boot.style.transform = `translate3d(${pointer.x + pull.x}px, ${pointer.y + pull.y}px, 0)`

      // Only keep stepping while the pull is still settling. Once the
      // mouse stops and the offset has landed, no frames are requested.
      if (pull.x !== wanted.x || pull.y !== wanted.y) schedule()
    }

    const onMove = (e: PointerEvent) => {
      if (!visible) setVisible(true)

      pointer.x = e.clientX
      pointer.y = e.clientY

      // Magnetic pull: bend the boot toward the element's centre. This only
      // engages while the pointer is already inside the magnetic element,
      // so the displacement can never carry the boot off the thing you're
      // about to click.
      wanted.x = 0
      wanted.y = 0
      if (magnetTarget) {
        const r = magnetTarget.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const withinX = Math.abs(e.clientX - cx) < r.width / 2 + MAGNET_PADDING
        const withinY = Math.abs(e.clientY - cy) < r.height / 2 + MAGNET_PADDING
        if (withinX && withinY) {
          wanted.x = (cx - e.clientX) * MAGNET_STRENGTH
          wanted.y = (cy - e.clientY) * MAGNET_STRENGTH
        }
      }

      schedule()
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
      if (frame !== null) cancelAnimationFrame(frame)
    }
    // `visible` is intentionally excluded: including it would tear down
    // and rebuild every listener on the first mouse move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  if (!mounted || !enabled) return null

  /*
    Hover growth and the press kick are both transforms, never width or
    height. Animating the box would run layout on every frame of the
    transition, on an element that is already moving every frame; a scale
    is composited instead.

    It fixes the hotspot for free, too: the scale origin is the toe, so the
    toe stays exactly on the pointer at any size, which lets the offset
    margins below be constants.
  */
  const scale =
    (variant === 'default' ? 1 : CURSOR_SIZE_ACTIVE / CURSOR_SIZE) * (pressed ? 0.9 : 1)

  /*
    Hover state is carried by size alone. There was a neon halo here, but
    a glow around the boot is exactly the second cursor-ish shape this is
    meant to be free of.

    The one filter kept is a plain offset drop shadow. It isn't a halo and
    doesn't read as a separate element — it's what stops a white-and-red
    boot from dissolving into the light sections of the page, the same
    reason the OS arrow has one.
  */
  const shadow = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'

  // Pivots near the toe, so a press reads as a kick rather than a spin.
  const rotation = pressed ? -14 : 0

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] hidden lg:block">
      {/*
        Two nested elements on purpose: the rAF loop owns the outer
        transform (translate), React owns the inner one (rotate/scale).
        Sharing one element would mean a re-render could overwrite the
        position mid-movement, or a pointer frame could drop the scale.
      */}
      <div ref={bootRef} className="absolute left-0 top-0 will-change-transform">
        <div
          className="flex items-center gap-2.5"
          style={{
            // Put the toe of the boot on the actual pointer position.
            marginLeft: -CURSOR_SIZE * TOE_X,
            marginTop: -CURSOR_SIZE * TOE_Y,
            opacity: visible && variant !== 'hidden' ? 1 : 0,
            transition: 'opacity 220ms ease-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CURSOR_ART}
            alt=""
            aria-hidden
            draggable={false}
            className={cn('shrink-0', 'transition-transform duration-150 ease-out')}
            style={{
              width: CURSOR_SIZE,
              height: CURSOR_SIZE,
              filter: shadow,
              transform: `rotate(${rotation}deg) scale(${scale})`,
              transformOrigin: `${TOE_X * 100}% ${TOE_Y * 100}%`,
            }}
          />

          {label ? (
            <span className="whitespace-nowrap rounded-full bg-chalk px-2.5 py-1 font-display text-[0.6rem] uppercase tracking-[0.14em] text-night shadow-lift">
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
