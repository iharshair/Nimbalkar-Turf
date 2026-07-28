import type { Metadata, Viewport } from 'next'
import { Anton, Manrope, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { BUSINESS } from '@/lib/business'

/**
 * Root layout — intentionally minimal.
 *
 * Only the document shell, fonts and site-wide metadata live here. The
 * marketing providers (Lenis smooth scroll, the boot cursor, the booking
 * modal) moved into `(site)/layout.tsx`, because the admin panel must not
 * inherit them: hijacked scrolling and a hidden native cursor are actively
 * hostile in a data tool someone uses for an hour at a time.
 *
 * Route groups don't affect URLs — `(site)/page.tsx` is still `/`.
 */

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
  formatDetection: { telephone: true, address: true },
}

export const viewport: Viewport = {
  themeColor: '#0A0E14',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${display.variable} ${body.variable} ${devanagari.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-night text-chalk">{children}</body>
    </html>
  )
}
