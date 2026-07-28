'use client'

import { useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { BUSINESS } from '@/lib/business'
import { REVIEWS } from '@/lib/content'
import { Counter } from '@/components/motion/Counter'
import { Reveal } from '@/components/motion/Reveal'
import { Section, SectionHeading } from '@/components/ui/Section'
import { cn } from '@/lib/utils'

const STARS = [5, 4, 3, 2, 1]

export function Reviews() {
  const railRef = useRef<HTMLUListElement>(null)

  /** Scrolls by one card width. Native scroll-snap does the landing. */
  const nudge = useCallback((direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail) return
    const card = rail.querySelector('li')
    const step = card ? card.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8
    rail.scrollBy({ left: step * direction, behavior: 'smooth' })
  }, [])

  return (
    <Section id="reviews" label="Reviews">
      <div className="shell">
        <SectionHeading
          eyebrow="What players say"
          title={`${BUSINESS.rating.value} out of 5, across ${BUSINESS.rating.count} reviews`}
          lead="Summarised from public Google reviews. The themes below are the ones that come up again and again."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-16">
          {/* ── Rating summary ───────────────────────────────────── */}
          <Reveal className="space-y-6" y={26}>
            <div>
              <p className="flex items-end gap-2">
                <span className="font-display text-display-lg leading-none text-chalk">
                  <Counter to={BUSINESS.rating.value} decimals={1} />
                </span>
                <Star className="mb-2 h-7 w-7 fill-amber text-amber" aria-hidden />
              </p>
              <p className="mt-2 text-sm text-chalk/50">
                Based on{' '}
                <Counter to={BUSINESS.rating.count} className="text-chalk/80" /> Google reviews
              </p>
            </div>

            {/* Distribution bars */}
            <ul className="space-y-2">
              {STARS.map((star) => {
                const count = BUSINESS.rating.distribution[star] ?? 0
                const pct = Math.round((count / BUSINESS.rating.count) * 100)
                return (
                  <li key={star} className="flex items-center gap-3 text-[0.78rem]">
                    <span className="flex w-8 shrink-0 items-center gap-1 text-chalk/50">
                      {star}
                      <Star className="h-3 w-3 fill-chalk/40 text-chalk/40" aria-hidden />
                    </span>
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-chalk/[0.07]"
                      role="img"
                      aria-label={`${star} stars: ${count} reviews, ${pct}%`}
                    >
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          star >= 4 ? 'bg-neon' : star === 3 ? 'bg-amber' : 'bg-chalk/25',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums text-chalk/40">
                      {count}
                    </span>
                  </li>
                )
              })}
            </ul>

            <a
              href={BUSINESS.maps.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-display text-[0.66rem] uppercase tracking-[0.18em] text-neon underline decoration-neon/30 underline-offset-4 transition-colors hover:decoration-neon"
            >
              Read them on Google
            </a>
          </Reveal>

          {/* ── Testimonial carousel ─────────────────────────────── */}
          <div className="relative min-w-0">
            <div className="mb-4 flex items-center justify-end gap-2">
              <CarouselButton direction={-1} onClick={() => nudge(-1)} />
              <CarouselButton direction={1} onClick={() => nudge(1)} />
            </div>

            {/*
              Native scroll-snap rather than a JS carousel: real momentum
              swiping on touch, keyboard-scrollable, and it degrades to a
              plain scrolling list if scripting fails.
            */}
            <ul
              ref={railRef}
              tabIndex={0}
              aria-label="Player testimonials"
              className="no-scrollbar mask-fade-x flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
            >
              {REVIEWS.map((review) => (
                <li
                  key={review.id}
                  className="w-[85%] shrink-0 snap-start sm:w-[48%] lg:w-[42%]"
                >
                  <figure className="card flex h-full flex-col gap-4 p-6">
                    <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          aria-hidden
                          className={cn(
                            'h-3.5 w-3.5',
                            i < review.rating ? 'fill-amber text-amber' : 'fill-chalk/15 text-chalk/15',
                          )}
                        />
                      ))}
                    </div>

                    <blockquote className="text-[0.92rem] leading-relaxed text-chalk/75">
                      {review.body}
                    </blockquote>

                    <figcaption className="mt-auto flex items-center gap-3 border-t border-chalk/[0.08] pt-4">
                      <span
                        aria-hidden
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-neon/25 bg-turf-dark/50 font-display text-[0.7rem] text-neon"
                      >
                        {review.initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-[0.78rem] uppercase tracking-[0.08em] text-chalk">
                          {review.author}
                        </span>
                        <span className="block text-[0.72rem] text-chalk/40">
                          {review.when}
                          {review.sport ? ` · ${review.sport}` : ''}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  )
}

function CarouselButton({
  direction,
  onClick,
}: {
  direction: 1 | -1
  onClick: () => void
}) {
  const Icon = direction === -1 ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === -1 ? 'Previous reviews' : 'Next reviews'}
      className="grid h-10 w-10 place-items-center rounded-full border border-chalk/15 text-chalk/60 transition-colors hover:border-neon/50 hover:text-neon"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}
