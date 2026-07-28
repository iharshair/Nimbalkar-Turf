'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Registers GSAP plugins. Import `gsap`/`ScrollTrigger` from here rather
 * than from the package, so no component can forget to register — which
 * silently breaks ScrollTrigger in production builds.
 *
 * No "is it already registered?" guard: `registerPlugin` is idempotent, and
 * the only way to check (`gsap.core.globals()`) exists at runtime but is
 * absent from GSAP's type definitions, which fails `tsc`. Module bodies
 * evaluate once per module instance anyway, so there is nothing to guard.
 */
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/** Shared easing so every reveal in the site moves the same way. */
export const EASE = 'power3.out'

export { gsap, ScrollTrigger }
