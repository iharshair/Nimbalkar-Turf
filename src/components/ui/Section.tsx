import type { ReactNode } from 'react'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

/**
 * A thin chalk stroke, borrowed from pitch markings. Used to separate
 * sections instead of a heavy border.
 */
export function PitchDivider({ className }: { className?: string }) {
  return (
    <div className={cn('shell', className)} aria-hidden>
      <div className="pitch-line" />
    </div>
  )
}

interface SectionProps {
  id: string
  children: ReactNode
  className?: string
  /** Adds the turf-grain overlay. */
  grain?: boolean
  label?: string
}

export function Section({ id, children, className, grain = false, label }: SectionProps) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn('relative py-section', grain && 'turf-noise', className)}
    >
      {children}
    </section>
  )
}

interface SectionHeadingProps {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  align?: 'left' | 'center'
  className?: string
  /** Rendered to the right of the heading on desktop — usually a CTA. */
  aside?: ReactNode
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
  aside,
}: SectionHeadingProps) {
  return (
    <Reveal
      group
      className={cn(
        'flex flex-col gap-5',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      <span className="eyebrow flex items-center gap-3">
        <span className="h-px w-8 bg-neon/60" aria-hidden />
        {eyebrow}
      </span>

      <div
        className={cn(
          'flex flex-col gap-6',
          aside && 'lg:flex-row lg:items-end lg:justify-between lg:gap-12',
        )}
      >
        <h2 className="max-w-3xl text-display-md text-balance text-chalk">{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>

      {lead ? (
        <p className={cn('max-w-2xl text-chalk/60', align === 'center' && 'mx-auto')}>{lead}</p>
      ) : null}
    </Reveal>
  )
}

/** Floodlight bloom. Purely decorative background glow. */
export function Floodlight({
  className,
  animation = 'a',
}: {
  className?: string
  animation?: 'a' | 'b' | 'none'
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute rounded-full bg-floodlight blur-2xl',
        animation === 'a' && 'animate-drift-a',
        animation === 'b' && 'animate-drift-b',
        'motion-reduce:animate-none',
        className,
      )}
    />
  )
}
