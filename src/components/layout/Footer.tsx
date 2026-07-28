'use client'

import { Clock, Instagram, MapPin, Phone, Youtube } from 'lucide-react'
import { BUSINESS, NAV_LINKS } from '@/lib/business'
import { OVERTIME_POLICY, formatINR } from '@/lib/pricing'
import { Logo } from '@/components/layout/Logo'
import { WhatsAppGlyph } from '@/components/layout/WhatsAppFab'
import { useSmoothScroll } from '@/components/motion/SmoothScrollProvider'
import { WHATSAPP_ENQUIRY, whatsappLink } from '@/lib/whatsapp'
import { clubToday } from '@/lib/utils'

export function Footer() {
  const { scrollTo } = useSmoothScroll()
  // Club time, so server and client can't disagree across a New Year
  // boundary and trip a hydration warning.
  const year = clubToday().slice(0, 4)

  return (
    <footer className="turf-noise relative overflow-hidden border-t border-chalk/10 bg-night-800/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-floodlight blur-2xl"
      />

      <div className="shell relative grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr_1fr] lg:gap-8 lg:py-20">
        {/* Identity + bilingual tagline */}
        <div className="space-y-5">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-chalk/55">{BUSINESS.description}</p>
          <p className="font-deva text-sm text-neon/70">{BUSINESS.taglineMr}</p>

          <div className="flex items-center gap-2 pt-1">
            <SocialLink href={BUSINESS.social.instagram} label="Instagram">
              <Instagram className="h-4 w-4" aria-hidden />
            </SocialLink>
            <SocialLink href={BUSINESS.social.youtube} label="YouTube">
              <Youtube className="h-4 w-4" aria-hidden />
            </SocialLink>
            <SocialLink href={whatsappLink(WHATSAPP_ENQUIRY)} label="WhatsApp">
              <WhatsAppGlyph className="h-4 w-4" />
            </SocialLink>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h3 className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-chalk/40">
            Find us
          </h3>

          <a
            href={BUSINESS.maps.directions}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="map"
            className="flex gap-3 text-sm text-chalk/70 transition-colors hover:text-neon"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon/70" aria-hidden />
            <span>
              {BUSINESS.address.line1}
              <br />
              {BUSINESS.address.line2}
              <br />
              {BUSINESS.address.city}, {BUSINESS.address.state} {BUSINESS.address.postalCode}
              <br />
              <span className="mt-1 inline-block text-chalk/40">
                Plus Code {BUSINESS.address.plusCode}
              </span>
            </span>
          </a>

          <a
            href={`tel:${BUSINESS.phoneTel}`}
            data-cursor="call"
            className="flex items-center gap-3 text-sm text-chalk/70 transition-colors hover:text-neon"
          >
            <Phone className="h-4 w-4 shrink-0 text-neon/70" aria-hidden />
            {BUSINESS.phone}
          </a>

          <p className="flex items-center gap-3 text-sm text-chalk/70">
            <Clock className="h-4 w-4 shrink-0 text-neon/70" aria-hidden />
            {BUSINESS.hours.label}
          </p>
        </div>

        {/* Sections + the policy, restated one last time */}
        <div className="space-y-4">
          <h3 className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-chalk/40">
            Explore
          </h3>
          <ul className="grid grid-cols-2 gap-y-2.5 gap-x-4 lg:grid-cols-1">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollTo(link.id)
                  }}
                  className="text-sm text-chalk/60 transition-colors hover:text-neon"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-amber/25 bg-amber/[0.06] p-3.5">
            <p className="font-display text-[0.66rem] uppercase tracking-[0.14em] text-amber">
              Overtime, plainly
            </p>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-chalk/60">
              {OVERTIME_POLICY.graceMinutes} minutes grace, free. After that{' '}
              {formatINR(OVERTIME_POLICY.blockRate)} per {OVERTIME_POLICY.blockMinutes} minutes,
              capped at one hour. Confirmed with you before it is charged.
            </p>
          </div>
        </div>
      </div>

      <div className="pitch-line" aria-hidden />

      <div className="shell flex flex-col items-center justify-between gap-3 py-6 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-chalk/35">
          © {year} {BUSINESS.name}. {BUSINESS.address.city}, {BUSINESS.address.state}.
        </p>
        <p className="text-xs text-chalk/35">
          {BUSINESS.rating.value} ★ from {BUSINESS.rating.count} Google reviews
        </p>
      </div>
    </footer>
  )
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-magnetic
      className="grid h-10 w-10 place-items-center rounded-full border border-chalk/12 text-chalk/60 transition-colors hover:border-neon/50 hover:text-neon"
    >
      {children}
    </a>
  )
}
