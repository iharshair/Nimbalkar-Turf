'use client'

import { useEffect, useState } from 'react'

/**
 * Single source of truth for motion opt-out. Every animated component
 * reads this and degrades to plain fades (or nothing) when true.
 *
 * Starts `false` so SSR markup matches; the first client effect corrects
 * it before any GSAP timeline is built.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
