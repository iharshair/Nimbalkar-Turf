'use client'

import { Clock, Copy, MapPin, Navigation, Phone } from 'lucide-react'
import { useState } from 'react'
import { BUSINESS } from '@/lib/business'
import { Reveal } from '@/components/motion/Reveal'
import { MagneticButton } from '@/components/motion/MagneticButton'
import { Section, SectionHeading } from '@/components/ui/Section'
import { useToast } from '@/components/ui/Toast'

export function Location() {
  const { success, error } = useToast()
  const [copied, setCopied] = useState(false)

  const copyPlusCode = async () => {
    try {
      await navigator.clipboard.writeText(BUSINESS.address.plusCode)
      setCopied(true)
      success('Plus Code copied', 'Paste it into Google Maps to find us exactly.')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      error('Could not copy', BUSINESS.address.plusCode)
    }
  }

  return (
    <Section id="location" label="Location and contact">
      <div className="shell">
        <SectionHeading
          eyebrow="Getting here"
          title="Off DY Patil University Road, Lohegaon"
          lead="Ten minutes from Viman Nagar and close to the airport road. Parking is on site, so drive right up to the gate."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          {/* ── Details ──────────────────────────────────────────── */}
          <Reveal group className="flex flex-col gap-4" y={26} stagger={0.08}>
            <div className="card p-6">
              <MapPin className="mb-4 h-5 w-5 text-neon" aria-hidden />
              <h3 className="font-display text-[0.68rem] uppercase tracking-[0.2em] text-chalk/40">
                Address
              </h3>
              <address className="mt-2 not-italic leading-relaxed text-chalk/75">
                {BUSINESS.address.line1}
                <br />
                {BUSINESS.address.line2}
                <br />
                {BUSINESS.address.city}, {BUSINESS.address.state} {BUSINESS.address.postalCode}
              </address>

              <button
                type="button"
                onClick={copyPlusCode}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-chalk/15 px-3.5 py-2 font-mono text-[0.72rem] text-chalk/60 transition-colors hover:border-neon/50 hover:text-neon"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? 'Copied' : BUSINESS.address.plusCode}
              </button>
            </div>

            <div className="card p-6">
              <Clock className="mb-4 h-5 w-5 text-neon" aria-hidden />
              <h3 className="font-display text-[0.68rem] uppercase tracking-[0.2em] text-chalk/40">
                Hours
              </h3>
              <p className="mt-2 font-display text-display-sm text-chalk">24 Hours</p>
              <p className="mt-1.5 text-sm text-chalk/50">
                Every day, including public holidays. Someone is always on the ground.
              </p>
            </div>

            <div className="card p-6">
              <Phone className="mb-4 h-5 w-5 text-neon" aria-hidden />
              <h3 className="font-display text-[0.68rem] uppercase tracking-[0.2em] text-chalk/40">
                Phone
              </h3>
              {/* tel: link — taps straight into the dialler on mobile. */}
              <a
                href={`tel:${BUSINESS.phoneTel}`}
                data-cursor="call"
                data-magnetic
                className="mt-2 inline-block font-display text-display-sm text-chalk transition-colors hover:text-neon"
              >
                {BUSINESS.phone}
              </a>
              <p className="mt-1.5 text-sm text-chalk/50">
                Call for same-day slots, tournaments or group bookings.
              </p>
            </div>

            <MagneticButton
              href={BUSINESS.maps.directions}
              cursorLabel="map"
              fullWidth
              className="mt-1"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Get directions
            </MagneticButton>
          </Reveal>

          {/* ── Map ──────────────────────────────────────────────── */}
          <Reveal className="card min-h-[22rem] overflow-hidden p-0 lg:min-h-full" y={30}>
            <iframe
              title={`Map showing ${BUSINESS.name}`}
              src={BUSINESS.maps.embed}
              loading="lazy"
              // Below the fold and third-party: don't leak the full URL.
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="h-full min-h-[22rem] w-full border-0 grayscale-[0.35] contrast-[1.1] transition-all duration-700 hover:grayscale-0"
            />
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
