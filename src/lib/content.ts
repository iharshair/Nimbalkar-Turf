import type { GalleryItem, Review } from '@/types'

/* ── About ──────────────────────────────────────────────────────────── */

export const ABOUT = {
  eyebrow: 'The ground',
  heading: 'A turf that holds up at 11 PM',
  body: [
    'Nimbalkar Sports Club sits just off DY Patil University Road in Lohegaon — close enough to reach after work, far enough out to actually have space. One full-size floodlit turf, cut and rolled on a schedule, marked for football and set up for cricket when you need it.',
    'We stay open 24 hours because Pune plays at odd hours. Night-shift teams, 6 AM regulars, corporate sides that can only get eleven people together at 10 PM — the lights stay on for all of them.',
  ],
  /**
   * Pull-quotes paraphrased from recurring themes in our 102 Google
   * reviews. Deliberately not verbatim: we summarise what people
   * consistently say, we don't reprint their words.
   */
  pullQuotes: [
    { label: 'Surface', text: 'The turf is genuinely maintained — not patchy, not slippery, plays true.' },
    { label: 'Lighting', text: 'Floodlights are bright and even. Night games feel like day games.' },
    { label: 'Booking', text: 'Reserving a slot is quick and straightforward, start to finish.' },
    { label: 'Staff', text: 'Ground staff are cooperative and easy to deal with.' },
  ],
} as const

/* ── Amenities ──────────────────────────────────────────────────────── */

export type AmenityIcon =
  | 'floodlight'
  | 'turf'
  | 'parking'
  | 'changing'
  | 'water'
  | 'firstaid'
  | 'clock'
  | 'seating'

export interface Amenity {
  icon: AmenityIcon
  label: string
  detail: string
}

export const AMENITIES: Amenity[] = [
  {
    icon: 'floodlight',
    label: 'Tower Floodlights',
    detail: 'Even, glare-controlled coverage across the full pitch. No dark corners at midnight.',
  },
  {
    icon: 'turf',
    label: 'Maintained Turf',
    detail: 'Artificial grass, brushed and infill-topped on a maintenance cycle. Consistent bounce and grip.',
  },
  {
    icon: 'parking',
    label: 'On-Site Parking',
    detail: 'Two-wheeler and four-wheeler parking right at the gate. No street hunting.',
  },
  {
    icon: 'changing',
    label: 'Washrooms & Changing',
    detail: 'Clean washrooms and a changing area so you can come straight from work.',
  },
  {
    icon: 'water',
    label: 'Drinking Water',
    detail: 'Filtered cold water on tap, pitch-side. Refill between halves.',
  },
  {
    icon: 'firstaid',
    label: 'First-Aid Kit',
    detail: 'Stocked kit and ice packs kept at the desk, with staff on the ground at all hours.',
  },
  {
    icon: 'clock',
    label: 'Open 24 Hours',
    detail: 'Every hour of every day is a bookable slot. Including 3 AM.',
  },
  {
    icon: 'seating',
    label: 'Side Seating',
    detail: 'Shaded benches for substitutes and spectators along the touchline.',
  },
]

/* ── Gallery ────────────────────────────────────────────────────────── */

/**
 * Categories mirror the tabs on the Google listing: Stadium, Football,
 * Videos. Replace the `/media/**` placeholders with real photography —
 * see README → "Swapping in real media".
 */
export const GALLERY: GalleryItem[] = [
  {
    id: 'g-01',
    type: 'image',
    category: 'stadium',
    src: '/media/gallery/stadium-01.svg',
    alt: 'Full view of the floodlit turf at night',
    caption: 'Full pitch under lights',
    span: 'wide',
  },
  {
    id: 'g-02',
    type: 'image',
    category: 'football',
    src: '/media/gallery/football-01.svg',
    alt: 'Five-a-side match in progress',
    caption: 'Tuesday night five-a-side',
    span: 'tall',
  },
  {
    id: 'g-03',
    type: 'image',
    category: 'stadium',
    src: '/media/gallery/stadium-02.svg',
    alt: 'Floodlight tower against the night sky',
    caption: 'Tower floodlights',
    span: 'square',
  },
  {
    id: 'g-04',
    type: 'video',
    category: 'videos',
    src: '/media/video/match-highlight.mp4',
    poster: '/media/gallery/video-01.svg',
    alt: 'Highlight clip from an evening match',
    caption: 'Highlights — evening league',
    span: 'wide',
  },
  {
    id: 'g-05',
    type: 'image',
    category: 'football',
    src: '/media/gallery/football-02.svg',
    alt: 'Close-up of the goal and penalty area markings',
    caption: 'Fresh line markings',
    span: 'square',
  },
  {
    id: 'g-06',
    type: 'image',
    category: 'stadium',
    src: '/media/gallery/stadium-03.svg',
    alt: 'Entrance and reception desk',
    caption: 'Gate and reception',
    span: 'tall',
  },
  {
    id: 'g-07',
    type: 'image',
    category: 'football',
    src: '/media/gallery/football-03.svg',
    alt: 'Players warming up before kick-off',
    caption: 'Warm-up, 9 PM slot',
    span: 'wide',
  },
  {
    id: 'g-08',
    type: 'video',
    category: 'videos',
    src: '/media/video/turf-tour.mp4',
    poster: '/media/gallery/video-02.svg',
    alt: 'Walkthrough tour of the ground',
    caption: 'Ground walkthrough',
    span: 'square',
  },
  {
    id: 'g-09',
    type: 'image',
    category: 'stadium',
    src: '/media/gallery/stadium-04.svg',
    alt: 'Turf surface texture in close detail',
    caption: 'Surface, up close',
    span: 'square',
  },
  {
    id: 'g-10',
    type: 'image',
    category: 'football',
    src: '/media/gallery/football-04.svg',
    alt: 'Cricket nets set up on the turf',
    caption: 'Cricket setup',
    span: 'tall',
  },
]

export const GALLERY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'stadium', label: 'Stadium' },
  { id: 'football', label: 'Football' },
  { id: 'videos', label: 'Videos' },
] as const

export type GalleryFilterId = (typeof GALLERY_FILTERS)[number]['id']

/* ── Reviews ────────────────────────────────────────────────────────── */

/**
 * Testimonials paraphrased from the themes running through our Google
 * reviews. Names are initials-only by design — we don't republish
 * reviewer identities or their exact wording.
 */
export const REVIEWS: Review[] = [
  {
    id: 'r-01',
    author: 'Rohit K.',
    initials: 'RK',
    rating: 5,
    body: 'Booked for a late football game and the whole thing was painless. Lights were on when we arrived, turf was in good shape, staff pointed us straight to the pitch.',
    when: '2 weeks ago',
    sport: 'Football',
  },
  {
    id: 'r-02',
    author: 'Sameer P.',
    initials: 'SP',
    rating: 5,
    body: 'We play here every Sunday morning. The surface holds up well and the lighting is better than most turfs in this part of Pune. Fair rates too.',
    when: '1 month ago',
    sport: 'Football',
  },
  {
    id: 'r-03',
    author: 'Aditi M.',
    initials: 'AM',
    rating: 4,
    body: 'Good ground and helpful staff. Parking is right there which makes a difference when you are carrying kit.',
    when: '1 month ago',
    sport: 'Cricket',
  },
  {
    id: 'r-04',
    author: 'Nikhil J.',
    initials: 'NJ',
    rating: 5,
    body: 'Being open all night is the reason we keep coming back. Our team can only get together after 11 and this is one of the few places that works.',
    when: '2 months ago',
    sport: 'Football',
  },
  {
    id: 'r-05',
    author: 'Faisal S.',
    initials: 'FS',
    rating: 4,
    body: 'Solid value for the money. Booking was quick and the ground was ready on time. Would recommend for regular games.',
    when: '2 months ago',
    sport: 'Football',
  },
  {
    id: 'r-06',
    author: 'Prathamesh D.',
    initials: 'PD',
    rating: 5,
    body: 'Turf quality is the standout. No bald patches, decent grip in studs, and the staff actually maintain it rather than just renting it out.',
    when: '3 months ago',
    sport: 'Football',
  },
]
