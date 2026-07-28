'use client'

import {
  Armchair,
  Clock,
  Droplets,
  HeartPulse,
  Lightbulb,
  ParkingCircle,
  ShowerHead,
  Sprout,
} from 'lucide-react'
import { AMENITIES, type AmenityIcon } from '@/lib/content'
import { Reveal } from '@/components/motion/Reveal'
import { Section, SectionHeading } from '@/components/ui/Section'

const ICONS: Record<AmenityIcon, typeof Lightbulb> = {
  floodlight: Lightbulb,
  turf: Sprout,
  parking: ParkingCircle,
  changing: ShowerHead,
  water: Droplets,
  firstaid: HeartPulse,
  clock: Clock,
  seating: Armchair,
}

export function Amenities() {
  return (
    <Section id="amenities" label="Facilities">
      <div className="shell">
        <SectionHeading
          eyebrow="Facilities"
          title={
            <>
              Everything you need,
              <br />
              nothing you&apos;ll pay extra for
            </>
          }
          lead="The basics, done properly and included in the slot price. No add-on charges for lights, water or the changing room."
        />

        <Reveal
          group
          as="ul"
          className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          y={30}
          stagger={0.07}
        >
          {AMENITIES.map((amenity) => {
            const Icon = ICONS[amenity.icon]
            return (
              <li
                key={amenity.label}
                className="card group h-full p-6 transition-[border-color,transform] duration-500 ease-turf hover:-translate-y-1 hover:border-neon/30"
              >
                {/* Icon micro-animation: a small nudge and tilt on hover. */}
                <span className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-neon/20 bg-turf-dark/40 text-neon transition-transform duration-500 ease-turf group-hover:-translate-y-0.5 group-hover:rotate-[-8deg] group-hover:scale-105 motion-reduce:group-hover:transform-none">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>

                <h3 className="font-display text-[0.95rem] uppercase tracking-[0.06em] text-chalk">
                  {amenity.label}
                </h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-chalk/55">
                  {amenity.detail}
                </p>

                {/* Hairline that draws in on hover — the pitch-line motif. */}
                <span
                  aria-hidden
                  className="mt-5 block h-px w-0 bg-neon/60 transition-all duration-500 ease-turf group-hover:w-10"
                />
              </li>
            )
          })}
        </Reveal>
      </div>
    </Section>
  )
}
