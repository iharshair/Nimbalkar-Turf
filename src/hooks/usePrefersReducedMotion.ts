'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Read synchronously so the very first client render is already correct. */
function initialPreference(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

/**
 * Single source of truth for motion opt-out. Every animated component
 * reads this and degrades to plain fades (or nothing) when true.
 *
 * The initial value is read synchronously rather than in an effect. This
 * matters: `useIsomorphicLayoutEffect` runs *before* `useEffect`, so a
 * hook that started `false` and corrected itself afterwards handed every
 * GSAP timeline the wrong answer and built the full animation anyway.
 *
 * Components that render *differently* under reduced motion must still
 * gate on a mounted flag, since the server always sees `false` — see
 * CustomCursor.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(initialPreference)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    // Re-sync in case the preference changed between render and mount.
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
