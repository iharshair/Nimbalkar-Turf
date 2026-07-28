'use client'

import { useRef, useState } from 'react'
import { ArrowDown, Star } from 'lucide-react'
import { BUSINESS } from '@/lib/business'
import { EASE, ScrollTrigger, gsap } from '@/lib/gsap'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useSmoothScroll } from '@/components/motion/SmoothScrollProvider'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { Counter } from '@/components/motion/Counter'
import { useBooking } from '@/context/BookingContext'

const STATS = [
  { value: BUSINESS.rating.value, decimals: 1, suffix: '', label: 'Google rating', star: true },
  { value: BUSINESS.rating.count, decimals: 0, suffix: '', label: 'Reviews', star: false },
  { value: 24, decimals: 0, suffix: 'h', label: 'Open every day', star: false },
]

export function Hero() {
  const rootRef = useRef<HTMLElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const { scrollTo } = useSmoothScroll()
  const { open: openBooking } = useBooking()

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      if (!reducedMotion) {
        // Entrance: headline lines, then the supporting content.
        gsap
          .timeline({ defaults: { ease: EASE } })
          .from('[data-hero-line]', { yPercent: 108, duration: 1.15, stagger: 0.1 }, 0.15)
          .from('[data-hero-sub]', { opacity: 0, y: 22, duration: 0.9 }, 0.6)
          .from('[data-hero-cta]', { opacity: 0, y: 22, duration: 0.9, stagger: 0.08 }, 0.75)
          .from('[data-hero-stat]', { opacity: 0, y: 20, duration: 0.9, stagger: 0.08 }, 0.9)
          .from('[data-hero-scroll]', { opacity: 0, duration: 0.8 }, 1.2)

        // Scroll choreography: the media bed recedes and darkens while the
        // foreground copy lifts away faster. Two speeds = depth.
        gsap
          .timeline({
            scrollTrigger: {
              trigger: root,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
          .to('[data-hero-media]', { yPercent: 16, scale: 1.08, ease: 'none' }, 0)
          .to('[data-hero-content]', { yPercent: -22, opacity: 0.15, ease: 'none' }, 0)
          .to('[data-hero-scrim]', { opacity: 1, ease: 'none' }, 0)
      }
    }, root)

    return () => {
      ctx.revert()
      ScrollTrigger.refresh()
    }
  }, [reducedMotion])

  return (
    <section ref={rootRef} id="top" className="relative isolate min-h-[100svh] overflow-hidden">
      {/* ── Media bed ─────────────────────────────────────────────── */}
      <div data-hero-media className="absolute inset-0 -z-10 will-change-transform">
        {/*
          The poster carries the design on its own. If hero.mp4 is missing
          or blocked, onError hides the video element and the poster
          remains — no black rectangle, no layout shift.
        */}
        {!videoFailed ? (
          <video
            className="h-full w-full object-cover"
            poster="/media/hero-poster.svg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            onError={() => setVideoFailed(true)}
          >
            <source src="/media/video/hero-night-turf.mp4" type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/media/hero-poster.svg"
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        )}

        {/* Legibility scrim: vertical gradient + a corner vignette. */}
        <div className="absolute inset-0 bg-gradient-to-b from-night/85 via-night/55 to-night" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_25%,rgba(10,14,20,0.85)_100%)]" />
        <div
          data-hero-scrim
          className="absolute inset-0 bg-night opacity-0"
          aria-hidden
        />
        <div className="turf-noise absolute inset-0" aria-hidden />
      </div>

      {/* Drifting floodlight blooms. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-10 -z-10 h-[34rem] w-[34rem] rounded-full bg-floodlight blur-3xl animate-drift-a motion-reduce:animate-none"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/3 -z-10 h-[28rem] w-[28rem] rounded-full bg-floodlight blur-3xl animate-drift-b motion-reduce:animate-none"
      />

      {/* ── Content ───────────────────────────────────────────────── */}
      <div
        data-hero-content
        className="shell relative flex min-h-[100svh] flex-col justify-end pb-16 pt-32 sm:pb-20 lg:pb-24"
      >
        <p
          data-hero-sub
          className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-eyebrow uppercase text-neon"
        >
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-neon animate-live-blink motion-reduce:animate-none" />
            </span>
            Open now
          </span>
          <span className="text-chalk/25">/</span>
          <span className="text-chalk/60">Lohegaon, Pune</span>
          <span className="text-chalk/25">/</span>
          <span className="text-chalk/60">Football &amp; Cricket</span>
        </p>

        <h1 className="text-display-xl text-chalk">
          {/* Each line is clipped so the entrance reads as a reveal, not a slide. */}
          <span className="block overflow-hidden pb-[0.06em]">
            <span data-hero-line className="block">
              Floodlit
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.06em]">
            <span data-hero-line className="block text-neon">
              turf.
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.06em]">
            <span data-hero-line className="block">
              Open all night.
            </span>
          </span>
        </h1>

        <p
          data-hero-sub
          className="mt-6 max-w-xl font-deva text-lg leading-relaxed text-chalk/70 sm:text-xl"
        >
          {BUSINESS.taglineMr} — {BUSINESS.nameMr}
        </p>

        <p data-hero-sub className="mt-3 max-w-xl text-chalk/55">
          One well-kept pitch, proper floodlights, and every hour of the day open for booking. Pick
          your slot, pay online, turn up and play.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <div data-hero-cta>
            <MagneticButton cursorLabel="book" onClick={() => openBooking()}>
              Book Your Slot
            </MagneticButton>
          </div>
          <div data-hero-cta>
            <MagneticButton variant="ghost" onClick={() => scrollTo('gallery')}>
              See the ground
            </MagneticButton>
          </div>
        </div>

        {/* Stat counters */}
        <dl className="mt-14 flex flex-wrap items-end gap-x-10 gap-y-6 sm:gap-x-14">
          {STATS.map((stat) => (
            <div data-hero-stat key={stat.label} className="min-w-[5.5rem]">
              <dd className="flex items-center gap-1.5 font-display text-display-sm text-chalk">
                <Counter to={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
                {stat.star ? (
                  <Star className="h-5 w-5 fill-amber text-amber" aria-hidden />
                ) : null}
              </dd>
              <dt className="mt-1.5 font-display text-[0.66rem] uppercase tracking-[0.18em] text-chalk/40">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Scroll hint */}
      <button
        data-hero-scroll
        type="button"
        onClick={() => scrollTo('about')}
        aria-label="Scroll to content"
        className="absolute bottom-6 right-5 hidden items-center gap-2 font-display text-[0.62rem] uppercase tracking-[0.2em] text-chalk/40 transition-colors hover:text-neon lg:flex"
      >
        Scroll
        <ArrowDown className="h-3.5 w-3.5 animate-bounce motion-reduce:animate-none" aria-hidden />
      </button>
    </section>
  )
}
