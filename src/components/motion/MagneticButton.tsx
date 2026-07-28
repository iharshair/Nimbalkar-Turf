'use client'

import { type ButtonHTMLAttributes, type ReactNode, useCallback, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIsTouch } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

type Ripple = { id: number; x: number; y: number }

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'amber'
  size?: 'md' | 'lg'
  /** Renders an <a> instead of a <button>. */
  href?: string
  /** How far the button drifts toward the pointer, in px. */
  pull?: number
  cursorLabel?: string
  fullWidth?: boolean
}

const VARIANTS = {
  primary:
    'bg-neon text-night shadow-neon hover:shadow-neon-lg [--ripple:rgba(10,14,20,0.28)]',
  ghost:
    'bg-chalk/[0.04] text-chalk border border-chalk/20 hover:border-neon/60 hover:text-neon [--ripple:rgba(57,255,110,0.22)]',
  amber: 'bg-amber text-night shadow-[0_0_28px_-6px_rgba(251,191,36,0.6)] [--ripple:rgba(10,14,20,0.25)]',
} as const

const SIZES = {
  md: 'h-11 px-6 text-[0.8rem]',
  lg: 'h-14 px-8 text-[0.9rem]',
} as const

/**
 * The site's primary CTA.
 *
 * Three layers of feedback: the button drifts toward the pointer while
 * hovered (magnetic), a ripple originates from the exact click point,
 * and it scales down on press. All three are skipped under
 * prefers-reduced-motion, which leaves a perfectly ordinary button.
 */
export function MagneticButton({
  children,
  className,
  variant = 'primary',
  size = 'lg',
  href,
  pull = 9,
  cursorLabel,
  fullWidth = false,
  onClick,
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const reducedMotion = usePrefersReducedMotion()
  const isTouch = useIsTouch()
  const magneticEnabled = !reducedMotion && !isTouch

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!magneticEnabled || !ref.current) return
      const r = ref.current.getBoundingClientRect()
      // Offset from centre, normalised to -1..1, then scaled by `pull`.
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * pull
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * pull
      gsap.to(ref.current, { x: dx, y: dy, duration: 0.45, ease: 'power3.out' })
    },
    [magneticEnabled, pull],
  )

  const onPointerLeave = useCallback(() => {
    if (!ref.current) return
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!reducedMotion && ref.current) {
        const r = ref.current.getBoundingClientRect()
        const id = Date.now() + Math.random()
        setRipples((prev) => [...prev, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
        // Matches the CSS animation duration below.
        window.setTimeout(() => setRipples((prev) => prev.filter((p) => p.id !== id)), 620)
      }
      onClick?.(e as React.MouseEvent<HTMLButtonElement>)
    },
    [onClick, reducedMotion],
  )

  const classes = cn(
    'group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden',
    'rounded-full font-display uppercase tracking-[0.14em]',
    'transition-[box-shadow,border-color,color,background-color] duration-300 ease-turf',
    'outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-night',
    'active:scale-[0.97] motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  )

  const content = (
    <>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute z-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ripple)] [animation:ripple_620ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </>
  )

  const shared = {
    className: classes,
    onPointerMove,
    onPointerLeave,
    onClick: handleClick,
    'data-magnetic': '',
    ...(cursorLabel ? { 'data-cursor': cursorLabel } : {}),
  }

  if (href) {
    const isExternal = /^https?:|^tel:|^mailto:/.test(href)
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        {...(isExternal && href.startsWith('http')
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        {...shared}
      >
        {content}
      </a>
    )
  }

  return (
    <button ref={ref as React.RefObject<HTMLButtonElement>} type="button" {...shared} {...rest}>
      {content}
    </button>
  )
}
