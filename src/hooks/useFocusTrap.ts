'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'video[controls]',
].join(',')

/**
 * Keeps Tab inside an open overlay and returns focus where it came from.
 *
 * Two WCAG requirements, both previously unmet:
 *
 *   2.1.2 No Keyboard Trap / 2.4.3 Focus Order — Tab used to walk straight
 *   out of the dialog into the page behind it. In the booking modal that
 *   was actively harmful: the inline booking engine is still mounted
 *   underneath, so a keyboard user landed in a *second* slot grid wired to
 *   the same selection state and could silently change their booking.
 *
 *   2.4.3 again — on close, focus fell to <body>, dropping a keyboard or
 *   screen-reader user back at the top of the document with no context.
 *
 * Deliberately not using the `inert` attribute: browser support is good
 * but React's typings and SSR handling of it still aren't, and a focus
 * cycle achieves the same thing with no compatibility risk.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return

    const container = ref.current
    if (!container) return

    // Remember where focus was so it can be handed back on close.
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        // offsetParent is null for display:none; also skip zero-size nodes.
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const items = focusable()
      if (!items.length) {
        // Nothing to focus inside: keep focus on the container itself
        // rather than letting it escape.
        e.preventDefault()
        container.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement

      // Focus outside the container (or on the container) — pull it back in.
      if (!container.contains(activeEl) || activeEl === container) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Hand focus back, but only if the element is still in the document
      // (the trigger may have unmounted along with the overlay).
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [ref, active])
}
