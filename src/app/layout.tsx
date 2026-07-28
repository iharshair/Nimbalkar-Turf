import type { Metadata, Viewport } from 'next'
import { Anton, Manrope, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { BUSINESS } from '@/lib/business'
import { RATE_TIERS } from '@/lib/pricing'
import { SmoothScrollProvider } from '@/components/motion/SmoothScrollProvider'
import { CustomCursor } from '@/components/motion/CustomCursor'
import { ToastProvider } from '@/components/ui/Toast'
import { BookingProvider } from '@/context/BookingContext'
import { BookingModal } from '@/components/booking/BookingModal'
import { SelectionGuard } from '@/components/booking/SelectionGuard'
import { AnalyticsBootstrap } from '@/components/AnalyticsBootstrap'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFab } from '@/components/layout/WhatsAppFab'

/* Condensed display face for scoreboard-scale headings. */
const display = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

const body = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

/* Used sparingly — the hero subline, footer tagline, and the logo lockup. */
const devanagari = Noto_Sans_Devanagari({
  weight: ['400', '600'],
  subsets: ['devanagari'],
  display: 'swap',
  variable: '--font-deva',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nimbalkarsportsclub.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BUSINESS.name} — Floodlit Turf in Lohegaon, Pune | Open 24 Hours`,
    template: `%s · ${BUSINESS.name}`,
  },
  description: BUSINESS.description,
  keywords: [
    'turf booking Pune',
    'football turf Lohegaon',
    'box cricket Pune',
    'Nimbalkar Sports Club',
    'night turf Pune',
    'turf near DY Patil Pune',
    'Viman Nagar turf',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} — Floodlit turf, open all night`,
    description: BUSINESS.description,
    images: [{ url: '/media/hero-poster.svg', width: 1600, height: 900, alt: BUSINESS.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BUSINESS.name} — Floodlit turf, open all night`,
    description: BUSINESS.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: true, address: true },
}

export const viewport: Viewport = {
  themeColor: '#0A0E14',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

/**
 * schema.org SportsActivityLocation.
 *
 * The aggregateRating mirrors the public Google listing exactly (4.3 from
 * 102 reviews) — inflating it here would be both dishonest and a
 * structured-data violation.
 */
function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    '@id': `${siteUrl}#business`,
    name: BUSINESS.name,
    alternateName: BUSINESS.nameMr,
    description: BUSINESS.description,
    url: siteUrl,
    telephone: BUSINESS.phoneTel,
    priceRange: `₹${Math.min(...RATE_TIERS.map((t) => t.weekday))}–₹${Math.max(
      ...RATE_TIERS.map((t) => t.weekend),
    )}`,
    currenciesAccepted: 'INR',
    paymentAccepted: 'UPI, Credit Card, Debit Card, Netbanking, Cash',
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${BUSINESS.address.line1}, ${BUSINESS.address.line2}`,
      addressLocality: BUSINESS.address.city,
      addressRegion: BUSINESS.address.state,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS.maps.lat,
      longitude: BUSINESS.maps.lng,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: BUSINESS.rating.value,
      reviewCount: BUSINESS.rating.count,
      bestRating: 5,
      worstRating: 1,
    },
    amenityFeature: BUSINESS.strengths.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
    sport: ['Football', 'Cricket'],
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${display.variable} ${body.variable} ${devanagari.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Razorpay Checkout is loaded on demand, but warming the
            connection shaves latency off the first payment. */}
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
        <script
          type="application/ld+json"
          // Static, server-generated object — no user input reaches this.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
        />
      </head>
      <body className="min-h-screen bg-night text-chalk">
        <a
          href="#booking"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-full focus:bg-neon focus:px-5 focus:py-3 focus:font-display focus:text-xs focus:uppercase focus:tracking-widest focus:text-night"
        >
          Skip to booking
        </a>

        <SmoothScrollProvider>
          <ToastProvider>
            <BookingProvider>
              <CustomCursor />
              <Nav />
              <main>{children}</main>
              <Footer />
              <WhatsAppFab />
              <BookingModal />
              {/* Renders nothing; owns the "drop slots others just took" rule. */}
              <SelectionGuard />
              {/* Renders nothing; starts Analytics if it's configured. */}
              <AnalyticsBootstrap />
            </BookingProvider>
          </ToastProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  )
}
