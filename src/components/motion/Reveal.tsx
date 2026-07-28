'use client'

import {
  Children,
  isValidElement,
  type ComponentType,
  type ElementType,
  type ReactNode,
  type Ref,
  useRef,
} from 'react'
import { EASE, gsap } from '@/lib/gsap'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'

/**
 * The props Reveal actually renders onto its wrapper element.
 *
 * Naming them lets the polymorphic `as` be cast to a concrete component
 * type instead of `any`. TypeScript can't narrow `ElementType`'s union
 * down to something that provably accepts a ref — but it doesn't need to,
 * because this describes precisely what gets passed and nothing more.
 */
interface RevealElementProps {
  ref?: Ref<HTMLElement>
  id?: string
  className?: string
  children?: ReactNode
  'data-reveal'?: string
  'data-reveal-group'?: string
}

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

  /**
   * A stable fingerprint of the children's keys.
   *
   * `children` itself is a new object every render, so depending on it
   * would rebuild the timeline constantly. But the effect MUST re-run when
   * the set of children actually changes: the reveal is `once: true` and
   * the hidden starting state lives in CSS, so freshly mounted nodes that
   * GSAP never sees stay invisible forever. That's what happened when the
   * gallery filter swapped the grid's contents.
   */
  const childKeys = group
    ? Children.toArray(children)
        .map((c) => (isValidElement(c) ? String(c.key) : ''))
        .join('|')
    : ''

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
  }, [group, childKeys, y, x, delay, duration, stagger, start, reducedMotion])

  // Two-step cast because `ElementType` and `ComponentType<P>` don't
  // overlap enough for a direct assertion. Contained to this one line, and
  // typed rather than `any`, so the props below are still checked.
  const Component = Tag as unknown as ComponentType<RevealElementProps>

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
