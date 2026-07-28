import { cn } from '@/lib/utils'
import { BUSINESS } from '@/lib/business'

/**
 * Bilingual logo lockup. The Devanagari line is the club's real name and
 * sits under the English wordmark, at a smaller optical weight so the two
 * scripts read as one mark rather than two labels.
 */
export function Logo({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      {/* Floodlight glyph: a mast with a bloom. */}
      <span
        aria-hidden
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neon/30 bg-turf-dark/60"
      >
        <span className="absolute h-4 w-4 rounded-full bg-neon/25 blur-[6px]" />
        <span className="relative h-1.5 w-4 rounded-[2px] bg-neon" />
        <span className="absolute bottom-1.5 h-2 w-[2px] bg-neon/70" />
      </span>

      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display uppercase tracking-[0.06em] text-chalk',
            compact ? 'text-base' : 'text-[1.05rem]',
          )}
        >
          Nimbalkar <span className="text-neon">Sports Club</span>
        </span>
        {!compact ? (
          <span className="mt-1 font-deva text-[0.62rem] tracking-wide text-chalk/60">
            {BUSINESS.nameMr}
          </span>
        ) : null}
      </span>
    </span>
  )
}
