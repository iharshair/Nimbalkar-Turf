'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks which section is currently in view, for the nav's sliding
 * underline.
 *
 * IntersectionObserver rather than a scroll handler: no per-frame layout
 * reads, and it stays correct while Lenis is tweening the scroll
 * position. The rootMargin biases the "active" band to the upper third of
 * the viewport, which matches where a reader's attention actually is.
 */
export function useActiveSection(ids: readonly string[], offset = 96): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Prefer whichever intersecting section is highest on the page.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length) setActive(visible[0].target.id)
      },
      {
        rootMargin: `-${offset}px 0px -62% 0px`,
        threshold: [0, 0.15, 0.4],
      },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids, offset])

  return active
}
