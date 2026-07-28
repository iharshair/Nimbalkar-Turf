'use client'

import { Quote } from 'lucide-react'
import { ABOUT } from '@/lib/content'
import { BUSINESS } from '@/lib/business'
import { Reveal } from '@/components/motion/Reveal'
import { Floodlight, Section, SectionHeading } from '@/components/ui/Section'

export function About() {
  return (
    <Section id="about" grain label="About the club">
      <Floodlight className="-left-48 top-0 h-[26rem] w-[26rem] opacity-70" animation="b" />

      <div className="shell relative grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="space-y-8">
          <SectionHeading eyebrow={ABOUT.eyebrow} title={ABOUT.heading} />

          <Reveal group className="space-y-5" y={26}>
            {ABOUT.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="max-w-xl text-chalk/60">
                {paragraph}
              </p>
            ))}
          </Reveal>

          <Reveal className="flex flex-wrap gap-2 pt-1" y={20}>
            {BUSINESS.strengths.map((strength) => (
              <span
                key={strength}
                className="rounded-full border border-chalk/12 bg-chalk/[0.03] px-3.5 py-1.5 text-[0.72rem] text-chalk/60"
              >
                {strength}
              </span>
            ))}
          </Reveal>
        </div>

        {/*
          Pull-quotes summarise recurring themes across our 102 reviews.
          Paraphrased on purpose — we characterise what people say rather
          than republishing their words.
        */}
        <Reveal group className="grid gap-4 sm:grid-cols-2 lg:mt-4" y={38} stagger={0.1}>
          {ABOUT.pullQuotes.map((quote, i) => (
            <figure
              key={quote.label}
              className="card group flex flex-col gap-3.5 p-6 transition-colors duration-500 hover:border-neon/30"
              // Nudge alternate cards down for a staggered masonry feel.
              style={{ marginTop: i % 2 === 1 ? '1.5rem' : undefined }}
            >
              <Quote
                className="h-5 w-5 text-neon/50 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
                aria-hidden
              />
              <blockquote className="text-[0.95rem] leading-relaxed text-chalk/80">
                {quote.text}
              </blockquote>
              <figcaption className="mt-auto font-display text-[0.62rem] uppercase tracking-[0.2em] text-chalk/55">
                {quote.label}
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </div>
    </Section>
  )
}
