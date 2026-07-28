# Nimbalkar Sports Club

Website and online slot-booking system for **Nimbalkar Sports Club** (निंबालकर स्पोर्ट्स क्लब) — a floodlit football and cricket turf in Lohegaon, Pune, open 24 hours.

One scrolling page plus a modal booking flow: real-time availability from Firestore, Razorpay checkout, and an overtime policy published in full *before* the customer pays.

```
Next.js 14 (App Router) · TypeScript · Tailwind CSS
GSAP + ScrollTrigger · Lenis · Framer Motion
Firebase (Firestore + Auth) · Razorpay · React Hook Form + Zod
```

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional — see the mode table below
npm run dev                    # http://localhost:3000
```

### Payments and storage are configured independently

Razorpay and Firebase are separate switches, so you can turn on real (test)
payments without standing up a database first. The booking panel always states
which mode it's in — see `SETUP_NOTICE` in `src/lib/runtime.ts`.

| Razorpay | Firestore | Behaviour |
| --- | --- | --- |
| — | — | Checkout simulated. Grid from seed data. Dev only. |
| `rzp_test_*` | — | Real test checkout, bookings in `.data/store.json`. **Dev only.** |
| `rzp_test_*` | configured | Real test checkout, bookings in Firestore, live push updates. |
| `rzp_live_*` | configured | Production. |
| `rzp_live_*` | — | **Refused** — 503. |
| any | — | **Refused in a production build** — 503. |

Firestore is the real store. The local JSON backend survives only so a fresh
clone can run the booking flow before credentials exist; a production build
without Firestore refuses bookings outright rather than accepting money into
storage that forgets it. See `storageUnavailableReason()` in
`src/lib/store/index.ts`.

`NEXT_PUBLIC_FORCE_DEMO_MODE=true` forces the simulated path even with keys
present, which is useful for a public staging demo.

#### Test cards

In test mode use Razorpay's sandbox instruments — card `4111 1111 1111 1111`
with any future expiry and any CVV, or UPI id `success@razorpay`. Real cards are
rejected by test keys, and no money moves.

#### The local store (development only)

`src/lib/store/local.ts` is a JSON-file backend that mirrors the Firestore
semantics exactly — hold expiry, partial-conflict handling, idempotent
confirmation — serialising writes through an in-process lock that stands in for
a transaction.

It is **not production storage**: no cross-process locking, and serverless
filesystems are ephemeral. `.data/` is gitignored, since it holds customer names
and phone numbers.

#### Keeping the Admin credential server-side

Three independent layers, because leaking it would hand over write access to the
whole database:

1. The env vars carry no `NEXT_PUBLIC_` prefix, so Next.js will not inline them
   into the client bundle.
2. `src/lib/firebase/admin.ts` throws on import if `window` is defined, so an
   accidental import from a client component fails loudly at once rather than
   shipping a credential.
3. Nothing client-reachable imports it. `lib/store`, `lib/razorpay` and
   `lib/notify` are server-only too, and are reached exclusively from `/api`
   routes.

If the key is malformed, `adminConfigProblem()` reports which variable is wrong
and how — a misquoted private key otherwise surfaces as an opaque JWT signing
error from deep inside the SDK.

---

## Going live

### 1. Firebase

Create a project and enable **Firestore**. (Authentication is not wired up —
there are no customer accounts yet, and importing `firebase/auth` would cost
every visitor bundle weight for a feature nobody uses. `getFirebaseApp()` in
`src/lib/firebase/client.ts` is ready for it when accounts are built.)

Fill in the six `NEXT_PUBLIC_FIREBASE_*` values, then create a service account
(Project settings → Service accounts → Generate new private key) and set
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`.

> The private key must be on one line with literal `\n` escapes, wrapped in
> double quotes. This is the single most common setup mistake.

Deploy the rules and seed the availability grid:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
npm run seed          # next 14 days
npm run seed -- 30    # or a longer window
```

> **The web config alone is not enough.** `firestore.rules` makes `slotDays`
> server-only-write, so bookings go through the Admin SDK. Without
> `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` the app falls back to the
> local store in development, and refuses bookings entirely in production.
>
> The booking grid never guesses: `/api/slots/[date]` reports which backend is
> authoritative and the client follows it, so the read path and the write path
> cannot disagree.

#### Client SDK modules

`src/lib/firebase/client.ts` holds the app and Firestore only, because the
booking grid imports it and anything in there ships to every visitor.
Auth, Storage and Analytics live in `src/lib/firebase/services.ts`:

```ts
import { getFirebaseAuth, getFirebaseStorage, logAnalyticsEvent } from '@/lib/firebase/services'
```

They're accessor functions rather than bare consts for three reasons: the
module is evaluated during SSR where `getAuth()` has no browser globals; they
legitimately return `null` when Firebase isn't configured; and Analytics needs
an async `isSupported()` check, so it can't be synchronous. Each getter
memoises, and the Analytics SDK is dynamically imported so it stays out of the
main bundle.

`npm run seed` skips any day that already contains a real booking, so it is safe
to re-run against production.

### 2. Razorpay

Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (use `rzp_test_*`
while building). Then add a webhook in the dashboard:

- **URL** — `https://<your-domain>/api/razorpay/webhook`
- **Events** — `payment.captured`, `payment.failed`
- Copy the signing secret into `RAZORPAY_WEBHOOK_SECRET`

The webhook is a safety net, not the happy path: if a customer closes the tab
between paying and the browser calling `/api/razorpay/verify`, the webhook still
confirms the booking.

### 3. Receipts (optional)

`RESEND_API_KEY` + `RECEIPT_FROM_EMAIL` enable email receipts.
`MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` enable SMS. Both are skipped with a log
line when unset — a receipt failure never fails a paid booking.

---

## Deploying

Use **Firebase Hosting** or **Netlify**. Vercel's free tier prohibits commercial
use, and this is a paid client project.

```bash
# Firebase Hosting (web frameworks; firebase.json is configured for asia-south1)
npm i -g firebase-tools
firebase experiments:enable webframeworks
firebase deploy
```

```bash
# Netlify (netlify.toml is configured)
netlify deploy --build --prod
```

Set every non-`NEXT_PUBLIC_` variable as a server-side secret on whichever host
you pick.

---

## How booking works

The interesting part is concurrency: two teams must never both pay for the 9 PM
slot. Three steps, one of which is a Firestore transaction.

```
Customer picks slots
        │
        ▼
POST /api/razorpay/order ───┐  transaction:
        │                   │  · re-prices slots from the server rate card
        │                   │  · verifies every slot is free
        │                   │  · marks them `held` (10-minute TTL)
        │                   └─ · writes bookings/{id} as `pending`
        ▼                      A conflict aborts → 409 → "those slots just went"
Razorpay Checkout
        │
        ▼
POST /api/razorpay/verify ──┐  · HMAC-SHA256(order|payment) must match
        │                   └─ · flips `held` → `booked`, booking → `confirmed`
        ▼
Confirmation + receipts
```

Details worth knowing:

- **The client never sends an amount.** `/order` recomputes the total from
  `RATE_TIERS`, so a tampered price is impossible. It also rejects hours that
  have already passed, which the UI blocks but the API is the real boundary for.
- **Abandoned checkouts need no cleanup job.** A `held` slot whose TTL has
  lapsed reads as available everywhere (`effectiveStatus`). Dismissing the
  Razorpay window also calls `/api/bookings/release` to free it immediately.
  That route requires an HMAC capability token issued by `/order`, because
  `slotDays` is public-read and therefore booking ids are public — a booking id
  alone must never authorise anything.
- **`confirmBooking` is idempotent**, because `/verify` and the webhook can both
  fire for the same payment. Only `payment.captured` confirms; `payment.authorized`
  is ignored, since an authorised payment can still fail to capture.
- **A paid booking is never silently lost.** `confirmBooking` re-verifies inside
  the transaction that every slot is still ours. If a hold lapsed during a slow
  UPI collect and another customer took the hours, it throws
  `ConfirmationConflictError`: the booking is flagged `needsAttention` with the
  conflicting slot ids, and the customer is told to call us rather than shown a
  confirmation they can't use. Watch for
  `bookings where needsAttention == true`.

### Firestore schema

```
slotDays/{YYYY-MM-DD}
  date: "2026-07-28"
  slots: {
    "19:00": { status: "booked", bookingId: "abc123", holdExpiresAt: null }
    "20:00": { status: "held",   bookingId: "def456", holdExpiresAt: 1769… }
    "21:00": { status: "available", bookingId: null, holdExpiresAt: null }
  }
  updatedAt: <serverTimestamp>

bookings/{bookingId}
  date, slotIds[], amount, status: pending|confirmed|failed|cancelled|refunded
  name, phone, email, sport, whatsappOptIn, notes
  razorpayOrderId, razorpayPaymentId, userId, createdAt, updatedAt
```

One document per day rather than one per slot: the booking grid needs a single
`onSnapshot` listener and costs one read per change instead of 24.

### Everything runs on club time

Dates and hours are computed in `Asia/Kolkata` (`CLUB_TIME_ZONE` in
`src/lib/utils.ts`), never in the visitor's local timezone. Use `clubToday()`
and `clubNow()` rather than `new Date()` for anything date-related.

Two reasons: a server in UTC and a browser in IST disagree about what "today" is
for five and a half hours out of every day, which is a hydration mismatch and a
wrong default date; and a customer travelling should still see the club's
calendar, not their own.

Per `firestore.rules`, `slotDays` is **public read, server-only write**, and a
customer can only ever read their own `bookings` document. Availability is not
something a browser is allowed to edit.

---

## The overtime policy

Public reviews of the club repeatedly mention disputes over extra minutes. The
fix here is transparency rather than fine print, so the rule is defined once in
`OVERTIME_POLICY` (`src/lib/pricing.ts`) and shown **four times**:

1. the Pricing section, with worked examples,
2. immediately above the pay button,
3. as a mandatory tick-box before payment can proceed,
4. on the confirmation screen and in the WhatsApp/email receipt.

The examples table isn't hand-written — each row calls `overtimeCharge()`, the
same function the ground tablet should use. The published table and the billing
logic cannot drift apart.

Current rule: **10 minutes grace, free. Then ₹250 per 15 minutes, capped at one
hour, always confirmed with the customer first.**

---

## Rates

Defined in `RATE_TIERS`. Changing them here updates the pricing table, the slot
grid, and the amount charged — all three read the same source.

| Slot | Window | Mon–Fri | Sat–Sun |
| --- | --- | --- | --- |
| Night Owl | 12 AM – 6 AM | ₹700 | ₹700 |
| Off-Peak | 6 AM – 5 PM | ₹800 | ₹800 |
| Prime Floodlight | 5 PM – 12 AM | ₹1,200 | ₹1,400 |

Booking window is 14 days (`BOOKING_WINDOW_DAYS`), maximum 6 hours per booking
(`MAX_SLOTS_PER_BOOKING`).

---

## Motion system

| Piece | File | Notes |
| --- | --- | --- |
| Smooth scroll | `motion/SmoothScrollProvider.tsx` | Lenis driven by GSAP's ticker with `lagSmoothing(0)`, so ScrollTrigger never desyncs from the scroll position |
| Custom cursor | `motion/CustomCursor.tsx` | Ring + dot, `mix-blend-mode: difference`, magnetic pull toward `[data-magnetic]`, contextual labels via `data-cursor` |
| Scroll reveals | `motion/Reveal.tsx` | `<Reveal>` / `<Reveal group>`; the hidden starting state lives in CSS, not JS |
| Count-ups | `motion/Counter.tsx` | Renders the final value server-side, then rewinds before paint |
| Buttons | `motion/MagneticButton.tsx` | Drift toward pointer, click ripple from the exact click point, press scale |
| Pinned gallery | `sections/Gallery.tsx` | Desktop pins the section and scrolls the rail horizontally; mobile gets CSS-column masonry |

### Markup conventions

```html
<button data-magnetic>            <!-- cursor is pulled to this element -->
<button data-cursor="book">       <!-- cursor grows and shows "Book" -->
<div data-cursor="hidden">        <!-- cursor hides over this region -->
<div data-reveal>                 <!-- fades/slides up on scroll -->
<div data-reveal-group>           <!-- its direct children stagger in -->
```

Label keys live in `LABELS` in `CustomCursor.tsx` (`view`, `book`, `play`,
`drag`, `call`, `map`); anything else is treated as literal label text.

### Reduced motion

`prefers-reduced-motion: reduce` is respected properly, not cosmetically:

- Lenis is never instantiated — the browser keeps native scrolling
- the custom cursor returns `null` and the native cursor is restored
- GSAP timelines, parallax and the pinned gallery are skipped (the gallery falls
  back to masonry)
- reveal starting states are scoped to `no-preference` in CSS, so content is
  visible even if no JS runs at all

---

## Swapping in real media

`public/media/**` currently holds generated SVG placeholders so nothing renders
broken. To replace them:

1. Drop real images into `public/media/gallery/`.
2. Update the `src` / `poster` paths in `GALLERY` (`src/lib/content.ts`).
3. Replace `public/media/hero-poster.svg` and update the `poster` attribute in
   `sections/Hero.tsx` plus the OG image in `app/layout.tsx`.
4. Add the videos listed in `public/media/video/README.md` (which includes an
   ffmpeg recipe for the hero loop).

Regenerate the placeholders any time with `npm run gen:placeholders`.

---

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx           Fonts, metadata, JSON-LD, provider stack
│  ├─ page.tsx             Section order
│  ├─ globals.css          Design tokens, .card/.skeleton/.pitch-line, reveal states
│  └─ api/
│     ├─ razorpay/order    Re-price, hold slots, create order
│     ├─ razorpay/verify   Verify signature, confirm booking
│     ├─ razorpay/webhook  Idempotent safety net
│     └─ bookings/release  Free a hold on dismissed checkout
├─ components/
│  ├─ booking/             DateStrip, SlotGrid, BookingEngine, DetailsForm,
│  │                       BookingModal, Confirmation
│  ├─ sections/            Hero, LiveStatusBar, About, Amenities, Gallery,
│  │                       Pricing, BookingSection, Reviews, Location
│  ├─ layout/              Nav, Footer, Logo, WhatsAppFab
│  ├─ motion/              SmoothScrollProvider, CustomCursor, Reveal,
│  │                       Counter, MagneticButton
│  └─ ui/                  Toast, Lightbox, Section, Skeleton
├─ context/BookingContext  Shared date/slot/step state
├─ hooks/                  useSlots, useRazorpay, useActiveSection, media queries
├─ lib/
│  ├─ business.ts          Real business facts — single source of truth
│  ├─ pricing.ts           Rate card + overtime policy + overtimeCharge()
│  ├─ slots.ts             Grid construction, holds, seed data
│  ├─ popularTimes.ts      Busyness curves for the live status bar
│  ├─ content.ts           Copy, amenities, gallery, testimonials
│  ├─ schema.ts            Zod schemas shared by form and API
│  ├─ firebase/            client · admin · bookings (transactions)
│  ├─ razorpay.ts          Orders + signature verification (server only)
│  ├─ notify.ts            Email/SMS receipts
│  └─ whatsapp.ts          Deep links and message templates
└─ types/
```

Business facts live **only** in `src/lib/business.ts`. Never hardcode the phone
number, address or rating in a component.

---

## Content integrity

- **Rating and review count mirror the public Google listing exactly** (4.3 from
  102 reviews), including in the `aggregateRating` structured data. Inflating
  either would be dishonest and a structured-data violation.
- **Testimonials are paraphrased, not copied.** They summarise recurring themes
  from public reviews; reviewer names are reduced to initials.
- The "Popular times" chart is a recreation of the Google listing's own widget,
  driven by hand-tuned baselines in `popularTimes.ts`. Swap `liveStatus()` for
  real occupancy (today's confirmed bookings ÷ total slots) once booking volume
  makes that meaningful.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed` | Seed the availability grid (optional day count arg) |
| `npm run gen:placeholders` | Regenerate `public/media` SVG placeholders |

---

## Deliberately not built

No dark-mode toggle (the site is dark by design), no blog, no language switcher
beyond the bilingual hero and footer, no chatbot, no e-commerce. Every feature
maps to one path: discover the turf → trust it → book a slot → pay → get
confirmed.
