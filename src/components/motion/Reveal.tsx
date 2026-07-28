'use client'

import { type ElementType, type ReactNode, useRef } from 'react'
import { EASE, gsap } from '@/lib/gsap'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Animate direct children in sequence instead of the wrapper itself. */
  group?: boolean
  /** Travel distance in px. */
  y?: number
  x?: number
  delay?: number
  duration?: number
  stagger?: number
  /** Viewport position that triggers the reveal. */
  start?: string
  id?: string
}

/**
 * Scroll-triggered reveal.
 *
 * The hidden starting state lives in CSS (`[data-reveal]`, see
 * globals.css) rather than being set here in JS. Two reasons: no flash
 * of visible content before hydration, and users with
 * prefers-reduced-motion get fully visible content even if this
 * component never runs.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className,
  group = false,
  y = 34,
  x = 0,
  delay = 0,
  duration = 0.9,
  stagger = 0.08,
  start = 'top 82%',
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const targets = group ? (Array.from(el.children) as HTMLElement[]) : [el]
    if (!targets.length) return

    if (reducedMotion) {
      // Nothing to undo: the hidden starting state in globals.css is
      // scoped to `prefers-reduced-motion: no-preference`, so these
      // elements were never hidden in the first place.
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y, x },
        {
          opacity: 1,
          y: 0,
          x: 0,
          duration,
          delay,
          ease: EASE,
          stagger: group ? stagger : 0,
          scrollTrigger: { trigger: el, start, once: true },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [group, y, x, delay, duration, stagger, start, reducedMotion])

  // Polymorphic `as` + a forwarded ref is more than TS's ElementType
  // union can narrow, and the cast is contained to this one line.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = Tag as any

  return (
    <Component
      ref={ref}
      id={id}
      className={cn(className)}
      {...(group ? { 'data-reveal-group': '' } : { 'data-reveal': '' })}
    >
      {children}
    </Component>
  )
}
