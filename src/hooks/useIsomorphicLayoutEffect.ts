import { useEffect, useLayoutEffect } from 'react'

/**
 * useLayoutEffect on the client, useEffect on the server.
 *
 * GSAP setup wants to run before paint (otherwise you see one frame of
 * un-animated content), but useLayoutEffect logs a warning during SSR.
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
