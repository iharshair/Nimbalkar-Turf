'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Registers GSAP plugins exactly once. Import `gsap`/`ScrollTrigger`
 * from here rather than from the package so no component can forget to
 * register, which silently breaks ScrollTrigger in production builds.
 */
if (typeof window !== 'undefined' && !gsap.core.globals().ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger)
}

/** Shared easing so every reveal in the site moves the same way. */
export const EASE = 'power3.out'

export { gsap, ScrollTrigger }
