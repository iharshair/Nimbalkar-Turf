import { redirect } from 'next/navigation'
import { AlertTriangle, CalendarDays, Phone, Search } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/auth'
import {
  findBookingsByPhone,
  listBookingsForDate,
  listNeedsAttention,
  listUpcomingBookings,
} from '@/lib/admin/data'
import { bookingReference, getSlotDay } from '@/lib/store'
import { buildSlotGrid } from '@/lib/slots'
import { formatINR } from '@/lib/pricing'
import { clubToday, cn, describeSlotRanges, fromISODate } from '@/lib/utils'
import { SignOutButton } from '@/components/admin/SignOutButton'
import { BookingActions } from '@/components/admin/BookingActions'
import { SlotBlocker } from '@/components/admin/SlotBlocker'
import { Logo } from '@/components/layout/Logo'
import type { Booking } from '@/types'

/** Never cache: staff are looking at this to make decisions right now. */
export const dynamic = 'force-dynamic'

function longDate(iso: string) {
  return fromISODate(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { phone?: string; date?: string }
}) {
  /*
    The real authorisation check. Middleware only confirmed a cookie
    exists — it runs on Edge and can't verify one. This is a server
    component, so an unauthorised visitor never receives the markup at all,
    let alone the data.
  */
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const today = clubToday()
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date
    : today
  const phone = searchParams.phone?.trim() ?? ''

  const [attention, dayBookings, upcoming, searchResults, storedSlots] = await Promise.all([
    listNeedsAttention(),
    listBookingsForDate(date),
    listUpcomingBookings(40),
    phone ? findBookingsByPhone(phone) : Promise.resolve([]),
    getSlotDay(date),
  ])

  const slots = buildSlotGrid(date, storedSlots, new Date())

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-chalk/10 pb-6">
        <div className="flex items-center gap-4">
          <Logo compact />
          <span className="hidden font-display text-[0.62rem] uppercase tracking-[0.2em] text-neon sm:inline">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[0.75rem] text-chalk/50 sm:inline">{session.email}</span>
          <SignOutButton />
        </div>
      </header>

      {/* ── Needs attention ─────────────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="attention-heading">
        <h2
          id="attention-heading"
          className="flex items-center gap-2 font-display text-[0.72rem] uppercase tracking-[0.2em] text-amber"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Needs attention
          {attention.length ? (
            <span className="rounded-full bg-amber px-2 py-0.5 text-[0.62rem] text-night">
              {attention.length}
            </span>
          ) : null}
        </h2>

        {attention.length === 0 ? (
          <p className="mt-3 rounded-xl border border-chalk/10 bg-chalk/[0.02] p-4 text-[0.85rem] text-chalk/55">
            Nothing outstanding. Bookings appear here when a payment was captured but the hours were
            already gone — someone has paid without getting what they paid for.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {attention.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} highlight />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Find a booking ──────────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="search-heading">
        <h2
          id="search-heading"
          className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-chalk/45"
        >
          Find a booking
        </h2>

        {/* A plain GET form — no client JS needed for search. */}
        <form method="GET" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="date" value={date} />
          <label className="sr-only" htmlFor="phone">
            Customer phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            defaultValue={phone}
            placeholder="Customer's 10-digit number"
            className="h-11 min-w-0 flex-1 rounded-xl border border-chalk/12 bg-night-700/60 px-4 text-[0.88rem] text-chalk outline-none placeholder:text-chalk/30 focus:border-neon/60 sm:max-w-xs"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-chalk/20 px-5 font-display text-[0.66rem] uppercase tracking-[0.12em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            Search
          </button>
        </form>

        {phone ? (
          searchResults.length ? (
            <ul className="mt-4 space-y-3">
              {searchResults.map((b) => (
                <li key={b.id}>
                  <BookingRow booking={b} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[0.85rem] text-chalk/55">
              No bookings found for {phone}. Check the number, or the booking may have been made
              under a different one.
            </p>
          )
        ) : null}
      </section>

      {/* ── One day ─────────────────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="day-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="day-heading"
            className="flex items-center gap-2 font-display text-[0.72rem] uppercase tracking-[0.2em] text-chalk/45"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {date === today ? 'Today' : longDate(date)}
          </h2>

          <form method="GET" className="flex items-center gap-2">
            {phone ? <input type="hidden" name="phone" value={phone} /> : null}
            <label className="sr-only" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={date}
              className="h-10 rounded-xl border border-chalk/12 bg-night-700/60 px-3 text-[0.82rem] text-chalk outline-none focus:border-neon/60"
            />
            <button
              type="submit"
              className="h-10 rounded-full border border-chalk/20 px-4 font-display text-[0.62rem] uppercase tracking-[0.12em] text-chalk/70 transition-colors hover:border-neon/50 hover:text-neon"
            >
              Go
            </button>
          </form>
        </div>

        {dayBookings.length === 0 ? (
          <p className="mt-3 rounded-xl border border-chalk/10 bg-chalk/[0.02] p-4 text-[0.85rem] text-chalk/55">
            No bookings for this day yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {dayBookings.map((b) => (
              <li key={b.id}>
                <BookingRow booking={b} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 rounded-card border border-chalk/10 bg-night-800/40 p-5">
          <h3 className="font-display text-[0.68rem] uppercase tracking-[0.18em] text-chalk/45">
            Block hours for maintenance
          </h3>
          <p className="mb-4 mt-1.5 text-[0.8rem] text-chalk/50">
            Select hours, then block or release them. Hours a customer already holds can&apos;t be
            blocked — refund the booking first.
          </p>
          <SlotBlocker date={date} slots={slots} />
        </div>
      </section>

      {/* ── Upcoming ────────────────────────────────────────────────── */}
      <section className="mt-10 pb-16" aria-labelledby="upcoming-heading">
        <h2
          id="upcoming-heading"
          className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-chalk/45"
        >
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-[0.85rem] text-chalk/55">No confirmed bookings ahead.</p>
        ) : (
          <ul className="mt-3 divide-y divide-chalk/[0.07] rounded-card border border-chalk/10">
            {upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-24 shrink-0 font-display text-[0.7rem] uppercase tracking-[0.1em] text-chalk/50">
                  {longDate(b.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.85rem] text-chalk/85">
                  {describeSlotRanges(b.slotIds).join(', ')}
                </span>
                <span className="text-[0.82rem] text-chalk/70">{b.name}</span>
                <a
                  href={`tel:+91${b.phone}`}
                  className="inline-flex items-center gap-1.5 text-[0.8rem] text-neon/80 hover:text-neon"
                >
                  <Phone className="h-3 w-3" aria-hidden />
                  {b.phone}
                </a>
                <span className="font-display text-[0.8rem] text-chalk/60">
                  {formatINR(b.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ── Booking row ─────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'border-neon/40 text-neon',
  pending: 'border-amber/45 text-amber',
  failed: 'border-red-500/40 text-red-300',
  cancelled: 'border-chalk/20 text-chalk/50',
  refunded: 'border-chalk/25 text-chalk/60',
}

function BookingRow({ booking, highlight = false }: { booking: Booking; highlight?: boolean }) {
  const lost = booking.conflictSlotIds ?? []
  const secured = booking.securedSlotIds ?? []

  return (
    <div
      className={cn(
        'rounded-card border p-4 sm:p-5',
        highlight ? 'border-amber/35 bg-amber/[0.04]' : 'border-chalk/10 bg-chalk/[0.02]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.78rem] tracking-wider text-neon">
              {bookingReference(booking.id)}
            </span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 font-display text-[0.58rem] uppercase tracking-[0.12em]',
                STATUS_STYLES[booking.status] ?? 'border-chalk/20 text-chalk/50',
              )}
            >
              {booking.status}
            </span>
          </p>

          <p className="mt-2 font-display text-[0.95rem] uppercase tracking-[0.04em] text-chalk">
            {longDate(booking.date)} · {describeSlotRanges(booking.slotIds).join(', ')}
          </p>

          <p className="mt-1.5 text-[0.85rem] text-chalk/70">
            {booking.name} ·{' '}
            <a href={`tel:+91${booking.phone}`} className="text-neon/80 hover:text-neon">
              {booking.phone}
            </a>
            {booking.email ? <span className="text-chalk/50"> · {booking.email}</span> : null}
          </p>

          <p className="mt-1 text-[0.78rem] text-chalk/50">
            {formatINR(booking.amount)} · {booking.sport}
            {booking.razorpayPaymentId ? (
              <span className="ml-1 font-mono text-[0.72rem] text-chalk/40">
                {booking.razorpayPaymentId}
              </span>
            ) : (
              <span className="ml-1 text-amber/80">no payment captured</span>
            )}
          </p>

          {booking.notes ? (
            <p className="mt-2 max-w-prose text-[0.8rem] italic text-chalk/55">
              &ldquo;{booking.notes}&rdquo;
            </p>
          ) : null}

          {lost.length ? (
            <p className="mt-3 rounded-lg border border-amber/25 bg-amber/[0.06] p-2.5 text-[0.78rem] leading-relaxed text-amber/90">
              Paid, but <strong>{describeSlotRanges(lost).join(', ')}</strong> was taken while the
              payment was processing.
              {secured.length
                ? ` They did keep ${describeSlotRanges(secured).join(', ')}.`
                : ' They kept nothing.'}{' '}
              Move them to another hour or refund.
            </p>
          ) : null}

          {booking.refundId ? (
            <p className="mt-2 text-[0.76rem] text-chalk/45">
              Refunded {booking.refundedAmount ? formatINR(booking.refundedAmount) : ''} ·{' '}
              <span className="font-mono">{booking.refundId}</span>
              {booking.refundedBy ? ` · by ${booking.refundedBy}` : ''}
            </p>
          ) : null}
        </div>

        <BookingActions
          bookingId={booking.id}
          amount={booking.amount}
          hasPayment={Boolean(booking.razorpayPaymentId) && booking.status !== 'refunded'}
          needsAttention={Boolean(booking.needsAttention)}
        />
      </div>
    </div>
  )
}
