'use client'

import { useRef, useState } from 'react'
import { ScrollTrigger, gsap } from '@/lib/gsap'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'

interface CounterProps {
  to: number
  /** Decimal places — 1 for the 4.3 rating, 0 for review counts. */
  decimals?: number
  duration?: number
  delay?: number
  prefix?: string
  suffix?: string
  className?: string
}

/**
 * Counts up once, when scrolled into view.
 *
 * Renders the final value in the SSR markup so the number is correct for
 * crawlers and for anyone with reduced motion — the animation only ever
 * rewinds and replays it.
 */
export function Counter({
  to,
  decimals = 0,
  duration = 1.8,
  delay = 0,
  prefix = '',
  suffix = '',
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(() => to.toFixed(decimals))
  const reducedMotion = usePrefersReducedMotion()

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // Restore explicitly: an earlier commit may have rewound `display` to
    // zero before the preference resolved, which would otherwise leave the
    // number stuck at 0 for exactly the users who can't see it animate.
    if (reducedMotion) {
      setDisplay(to.toFixed(decimals))
      return
    }

    // Rewind to zero before paint so the count-up doesn't visibly jump
    // down from the server-rendered final value.
    setDisplay((0).toFixed(decimals))

    const counter = { value: 0 }
    const ctx = gsap.context(() => {
      gsap.to(counter, {
        value: to,
        duration,
        delay,
        ease: 'power2.out',
        onUpdate: () => setDisplay(counter.value.toFixed(decimals)),
        onComplete: () => setDisplay(to.toFixed(decimals)),
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      })
    }, el)

    return () => {
      ctx.revert()
      ScrollTrigger.refresh()
    }
  }, [to, decimals, duration, delay, reducedMotion])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
