'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import {
  GALLERY,
  GALLERY_FILTERS,
  type GalleryFilterId,
} from '@/lib/content'
import type { GalleryItem } from '@/types'
import { gsap } from '@/lib/gsap'
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { Reveal } from '@/components/motion/Reveal'
import { Lightbox } from '@/components/ui/Lightbox'
import { cn } from '@/lib/utils'

/**
 * Gallery with two layouts driven by capability, not by breakpoint alone:
 *
 *   Desktop, motion allowed → the section pins and the rail scrolls
 *                             horizontally as you scroll vertically.
 *   Everything else         → a masonry column layout that scrolls
 *                             normally. This is also what renders on the
 *                             server, so it works with no JS at all.
 */
export function Gallery() {
  const [filter, setFilter] = useState<GalleryFilterId>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const isDesktop = useIsDesktop()
  const reducedMotion = usePrefersReducedMotion()
  const horizontal = isDesktop && !reducedMotion

  const items = useMemo(
    () => (filter === 'all' ? GALLERY : GALLERY.filter((g) => g.category === filter)),
    [filter],
  )

  const openAt = useCallback((index: number) => setLightboxIndex(index), [])

  return (
    <section id="gallery" aria-label="Gallery" className="relative">
      {horizontal ? (
        <HorizontalRail items={items} filter={filter} onFilter={setFilter} onOpen={openAt} />
      ) : (
        <MasonryGrid items={items} filter={filter} onFilter={setFilter} onOpen={openAt} />
      )}

      <Lightbox
        items={items}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </section>
  )
}

/* ── Shared header ───────────────────────────────────────────────────── */

function GalleryHeader({
  filter,
  onFilter,
  className,
}: {
  filter: GalleryFilterId
  onFilter: (f: GalleryFilterId) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="space-y-4">
        <span className="eyebrow flex items-center gap-3">
          <span className="h-px w-8 bg-neon/60" aria-hidden />
          The ground, on camera
        </span>
        <h2 className="max-w-xl text-display-md text-chalk">See it before you book it</h2>
      </div>

      {/* Filter tabs — same categories as the Google listing. */}
      <div
        role="tablist"
        aria-label="Filter gallery"
        className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {GALLERY_FILTERS.map((tab) => {
          const active = filter === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onFilter(tab.id)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 font-display text-[0.68rem] uppercase tracking-[0.16em] transition-colors duration-300',
                active
                  ? 'border-neon bg-neon text-night'
                  : 'border-chalk/15 text-chalk/55 hover:border-chalk/35 hover:text-chalk',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Desktop: pinned horizontal rail ─────────────────────────────────── */

function HorizontalRail({
  items,
  filter,
  onFilter,
  onOpen,
}: {
  items: GalleryItem[]
  filter: GalleryFilterId
  onFilter: (f: GalleryFilterId) => void
  onOpen: (index: number) => void
}) {
  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    const pin = pinRef.current
    const track = trackRef.current
    if (!pin || !track) return

    const ctx = gsap.context(() => {
      // Recomputed on refresh so a resize (or a filter change) can't leave
      // the rail scrolling to a stale offset.
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 96)

      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })
    }, pin)

    return () => ctx.revert()
    // Filter changes alter the track width, so the timeline is rebuilt.
  }, [filter, items.length])

  return (
    <div ref={pinRef} className="turf-noise relative h-[100svh] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 h-[30rem] w-[30rem] rounded-full bg-floodlight blur-3xl animate-drift-b motion-reduce:animate-none"
      />

      <div className="shell absolute inset-x-0 top-0 z-10 pt-24">
        <GalleryHeader filter={filter} onFilter={onFilter} />
      </div>

      <div className="flex h-full items-center pt-32">
        <div ref={trackRef} className="flex items-center gap-5 pl-5 pr-24 sm:pl-8 lg:pl-12">
          {items.map((item, i) => (
            <GalleryCard
              key={item.id}
              item={item}
              onClick={() => onOpen(i)}
              className={cn(
                'shrink-0',
                item.span === 'tall'
                  ? 'h-[26rem] w-[19rem]'
                  : item.span === 'wide'
                    ? 'h-[22rem] w-[36rem]'
                    : 'h-[22rem] w-[22rem]',
              )}
            />
          ))}

          {/* End card — the rail should land on a call to action. */}
          <div className="flex h-[22rem] w-[20rem] shrink-0 flex-col justify-end rounded-card border border-dashed border-chalk/15 p-7">
            <p className="font-display text-display-sm uppercase text-chalk">
              Seen enough?
            </p>
            <p className="mt-2 text-sm text-chalk/50">
              Every hour of every day is bookable. Scroll on to pick a slot.
            </p>
          </div>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-7 left-0 right-0 text-center font-display text-[0.6rem] uppercase tracking-[0.22em] text-chalk/55">
        Keep scrolling to pan →
      </p>
    </div>
  )
}

/* ── Mobile / reduced motion: masonry ────────────────────────────────── */

function MasonryGrid({
  items,
  filter,
  onFilter,
  onOpen,
}: {
  items: GalleryItem[]
  filter: GalleryFilterId
  onFilter: (f: GalleryFilterId) => void
  onOpen: (index: number) => void
}) {
  return (
    <div className="shell py-section">
      <GalleryHeader filter={filter} onFilter={onFilter} />

      {/* CSS columns give true masonry without measuring anything. */}
      <Reveal group className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3" y={26} stagger={0.06}>
        {items.map((item, i) => (
          <div key={item.id} className="mb-4 break-inside-avoid">
            <GalleryCard
              item={item}
              onClick={() => onOpen(i)}
              className={
                item.span === 'tall' ? 'h-[26rem]' : item.span === 'wide' ? 'h-[15rem]' : 'h-[19rem]'
              }
            />
          </div>
        ))}
      </Reveal>
    </div>
  )
}

/* ── Card ────────────────────────────────────────────────────────────── */

function GalleryCard({
  item,
  onClick,
  className,
}: {
  item: GalleryItem
  onClick: () => void
  className?: string
}) {
  const isVideo = item.type === 'video'

  return (
    <button
      type="button"
      onClick={onClick}
      data-cursor={isVideo ? 'play' : 'view'}
      aria-label={`Open ${item.caption}`}
      className={cn(
        'group relative w-full overflow-hidden rounded-card border border-chalk/10 bg-night-800',
        'transition-transform duration-700 ease-turf hover:rotate-[0.6deg] hover:scale-[1.015]',
        'motion-reduce:hover:rotate-0 motion-reduce:hover:scale-100',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isVideo ? (item.poster ?? item.src) : item.src}
        alt={item.alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-[900ms] ease-turf group-hover:scale-[1.08] motion-reduce:group-hover:scale-100"
      />

      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-night via-night/25 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-95"
      />

      {isVideo ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-chalk/30 bg-night/50 text-chalk backdrop-blur-sm transition-transform duration-500 ease-turf group-hover:scale-110"
        >
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      ) : null}

      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-left">
        <span className="font-display text-[0.78rem] uppercase tracking-[0.1em] text-chalk">
          {item.caption}
        </span>
        <span className="shrink-0 translate-y-1 font-display text-[0.6rem] uppercase tracking-[0.16em] text-neon opacity-0 transition-all duration-500 ease-turf group-hover:translate-y-0 group-hover:opacity-100">
          {isVideo ? 'Play' : 'View'}
        </span>
      </span>
    </button>
  )
}
