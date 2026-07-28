'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Clock, TrendingUp } from 'lucide-react'
import {
  BUSYNESS_COPY,
  DAY_LABELS,
  busynessBand,
  curveForDay,
  liveStatus,
  type LiveStatus,
} from '@/lib/popularTimes'
import { CLUB_TIME_ZONE, cn, formatHourShort } from '@/lib/utils'

/**
 * Live status strip: a recreation of the Google listing's "Popular times"
 * widget, doubling as social proof and gentle urgency.
 *
 * Everything time-dependent renders only after mount. Reading the clock
 * during SSR would guarantee a hydration mismatch, since the server's
 * "now" is never the browser's "now".
 */
export function LiveStatusBar() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    // A minute is precise enough for a busyness chart.
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const status: LiveStatus | null = useMemo(() => (now ? liveStatus(now) : null), [now])
  // Day comes from `status`, not from the visitor's device, so the chart
  // and the highlighted hour always describe the same (club) day.
  const curve = useMemo(() => curveForDay(status?.day ?? 1), [status?.day])

  return (
    <section
      aria-label="Live status and popular times"
      className="relative border-y border-chalk/10 bg-night-800/50"
    >
      <div className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-14 lg:py-9">
        {/* ── Status ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-neon/35 bg-neon/[0.08] px-3 py-1.5 font-display text-[0.66rem] uppercase tracking-[0.16em] text-neon">
              <span className="relative flex h-1.5 w-1.5">
                <span className="inline-flex h-full w-full rounded-full bg-neon animate-live-blink motion-reduce:animate-none" />
              </span>
              Open now
            </span>

            {status?.busierThanUsual ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/[0.09] px-3 py-1.5 font-display text-[0.66rem] uppercase tracking-[0.16em] text-amber">
                <TrendingUp className="h-3 w-3" aria-hidden />
                Busier than usual
              </span>
            ) : null}

            {status?.quieterThanUsual ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-chalk/15 px-3 py-1.5 font-display text-[0.66rem] uppercase tracking-[0.16em] text-chalk/55">
                <Activity className="h-3 w-3" aria-hidden />
                Quieter than usual
              </span>
            ) : null}
          </div>

          <p className="flex items-center gap-2 font-display text-display-sm text-chalk">
            <Clock className="h-5 w-5 text-neon/70" aria-hidden />
            {now ? (
              <time dateTime={now.toISOString()}>
                {now.toLocaleTimeString('en-IN', {
                  timeZone: CLUB_TIME_ZONE,
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}{' '}
                <span className="text-[0.5em] uppercase tracking-[0.2em] text-chalk/55">IST</span>
              </time>
            ) : (
              // Reserve the same width so nothing jumps on hydration.
              <span className="inline-block h-[1em] w-24 animate-pulse rounded bg-chalk/10" />
            )}
          </p>

          <p className="text-sm text-chalk/55">
            {status ? (
              <>
                <span className="text-chalk/80">{BUSYNESS_COPY[status.band]}.</span>{' '}
                Peak tonight is around {formatHourShort(status.peakHour)}m.
              </>
            ) : (
              'Checking how busy we are…'
            )}
          </p>
        </div>

        {/* ── Popular times ──────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-chalk/60">
              Popular times{' '}
              <span className="text-chalk/70">
                · {status ? DAY_LABELS[status.day] : '—'}
              </span>
            </h2>
            <Legend />
          </div>

          <ol
            className="flex h-28 items-end gap-[3px] sm:gap-1"
            aria-label="Hour-by-hour busyness for today"
          >
            {curve.map((value, hour) => {
              const isNow = status?.hour === hour
              const height = Math.max(6, value)
              const band = busynessBand(value)

              return (
                <li
                  key={hour}
                  className="group relative flex h-full flex-1 items-end"
                  aria-label={`${formatHourShort(hour)} — ${band}`}
                >
                  <span
                    className={cn(
                      'w-full rounded-t-[3px] transition-[height,background-color] duration-500 ease-turf',
                      isNow
                        ? 'bg-neon'
                        : band === 'packed'
                          ? 'bg-turf-light/85'
                          : band === 'busy'
                            ? 'bg-turf/80'
                            : band === 'steady'
                              ? 'bg-turf-dark'
                              : 'bg-chalk/[0.08]',
                    )}
                    style={{ height: `${height}%` }}
                  />

                  {/* Live marker on the current hour. */}
                  {isNow ? (
                    <span
                      aria-hidden
                      className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-neon shadow-neon"
                    />
                  ) : null}

                  <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-chalk/15 bg-night-800 px-2 py-1 text-[0.6rem] uppercase tracking-wider text-chalk opacity-0 transition-opacity group-hover:opacity-100">
                    {formatHourShort(hour)} · {band}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Sparse axis labels — every four hours keeps it readable. */}
          <div className="mt-2 flex text-[0.6rem] uppercase tracking-[0.14em] text-chalk/55">
            {curve.map((_, hour) => (
              <span key={hour} className="flex-1 text-center">
                {hour % 4 === 0 ? formatHourShort(hour) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Legend() {
  return (
    <ul className="hidden items-center gap-3 text-[0.6rem] uppercase tracking-[0.14em] text-chalk/60 sm:flex">
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-turf-dark" aria-hidden />
        Steady
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-turf/80" aria-hidden />
        Busy
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-neon" aria-hidden />
        Now
      </li>
    </ul>
  )
}
