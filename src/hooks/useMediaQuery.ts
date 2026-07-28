'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Desktop pointer with hover — gates the custom cursor and horizontal rail. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
}

/** True on touch devices, where the custom cursor must be disabled. */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none), (pointer: coarse)')
}
