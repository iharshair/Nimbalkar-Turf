/**
 * Real business facts for Nimbalkar Sports Club.
 * Single source of truth — never hardcode these inline in components.
 */

export const BUSINESS = {
  name: 'Nimbalkar Sports Club',
  nameMr: 'निंबालकर स्पोर्ट्स क्लब',
  shortName: 'Nimbalkar SC',
  category: 'Turf / Sports Club',
  tagline: 'Floodlit turf. Open all night.',
  taglineMr: 'दिवसरात्र खेळत रहा',
  description:
    'Floodlit football and cricket turf in Lohegaon, Pune. Open 24 hours, booked online in under a minute.',

  address: {
    line1: 'DY Patil University Rd',
    line2: 'Nimbalkar Nagar, Lohegaon',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411047',
    country: 'IN',
    full: 'DY Patil University Rd, Nimbalkar Nagar, Lohegaon, Pune, Maharashtra 411047',
    plusCode: 'JW68+8F Pune, Maharashtra',
  },

  /** Display form, and a tel: form stripped of spaces. */
  phone: '0788 828 9896',
  phoneTel: '+917888289896',
  whatsapp: '917888289896',

  hours: {
    label: 'Open 24 hours',
    /** 24/7 — used by schema.org and the live status bar. */
    is24x7: true,
  },

  rating: {
    value: 4.3,
    count: 102,
    /** Sums to 102; weighted mean = 4.29 → displays as 4.3. */
    distribution: { 5: 62, 4: 22, 3: 9, 2: 4, 1: 5 } as Record<number, number>,
  },

  /** Recurring praise in public reviews. Drives About + Amenities copy. */
  strengths: [
    'Well-maintained playing surface',
    'Strong, even floodlighting',
    'Smooth booking process',
    'Cooperative ground staff',
    'Honest value for money',
  ],

  maps: {
    /** Plus Code search is the most reliable deep link for this listing. */
    directions: 'https://www.google.com/maps/dir/?api=1&destination=JW68%2B8F+Pune%2C+Maharashtra',
    embed:
      'https://www.google.com/maps?q=Nimbalkar+Sports+Club,+DY+Patil+University+Rd,+Nimbalkar+Nagar,+Lohegaon,+Pune,+Maharashtra+411047&output=embed',
    /** Approximate — refine from the live listing before launch. */
    lat: 18.6106,
    lng: 73.9226,
  },

  social: {
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    youtube: 'https://www.youtube.com/',
  },
} as const

export const NAV_LINKS = [
  { id: 'about', label: 'About' },
  { id: 'amenities', label: 'Facilities' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'booking', label: 'Book' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'location', label: 'Visit' },
] as const

export type NavLinkId = (typeof NAV_LINKS)[number]['id']
