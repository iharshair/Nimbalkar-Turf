/**
 * Generates the SVG stand-ins under public/media.
 *
 * These exist so the gallery and hero render correctly before real
 * photography arrives — no broken images, no layout shift. Delete them
 * (and update src/lib/content.ts) once you have real assets.
 *
 *   node scripts/generate-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const PALETTE = {
  night: '#0A0E14',
  turfDark: '#0B3D24',
  turf: '#146B3A',
  neon: '#39FF6E',
  chalk: '#F4F6F1',
}

/** A floodlit-pitch abstraction: turf gradient, chalk lines, light bloom. */
function pitch({ w, h, label, sublabel, bloomX = 0.32, bloomY = 0.18, lines = 'full' }) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.13

  const markings =
    lines === 'full'
      ? `
    <rect x="${w * 0.06}" y="${h * 0.1}" width="${w * 0.88}" height="${h * 0.8}"
          fill="none" stroke="${PALETTE.chalk}" stroke-opacity="0.22" stroke-width="2"/>
    <line x1="${cx}" y1="${h * 0.1}" x2="${cx}" y2="${h * 0.9}"
          stroke="${PALETTE.chalk}" stroke-opacity="0.22" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="${PALETTE.chalk}" stroke-opacity="0.22" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="${PALETTE.chalk}" fill-opacity="0.3"/>
    <rect x="${w * 0.06}" y="${cy - h * 0.16}" width="${w * 0.09}" height="${h * 0.32}"
          fill="none" stroke="${PALETTE.chalk}" stroke-opacity="0.18" stroke-width="2"/>
    <rect x="${w * 0.85}" y="${cy - h * 0.16}" width="${w * 0.09}" height="${h * 0.32}"
          fill="none" stroke="${PALETTE.chalk}" stroke-opacity="0.18" stroke-width="2"/>`
      : lines === 'corner'
        ? `
    <path d="M ${w * 0.06} ${h * 0.9} L ${w * 0.94} ${h * 0.9}"
          stroke="${PALETTE.chalk}" stroke-opacity="0.2" stroke-width="2"/>
    <path d="M ${w * 0.06} ${h * 0.9} A ${w * 0.14} ${w * 0.14} 0 0 0 ${w * 0.2} ${h * 0.9}"
          fill="none" stroke="${PALETTE.chalk}" stroke-opacity="0.2" stroke-width="2"/>`
        : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PALETTE.turfDark}"/>
      <stop offset="55%" stop-color="#082B1A"/>
      <stop offset="100%" stop-color="${PALETTE.night}"/>
    </linearGradient>
    <radialGradient id="bloom" cx="${bloomX}" cy="${bloomY}" r="0.55">
      <stop offset="0%" stop-color="${PALETTE.neon}" stop-opacity="0.34"/>
      <stop offset="45%" stop-color="${PALETTE.turf}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${PALETTE.night}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="45%" stop-color="${PALETTE.night}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${PALETTE.night}" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#turf)"/>
  <!-- Mown stripes -->
  ${Array.from({ length: 9 }, (_, i) =>
    i % 2 === 0
      ? `<rect x="${(w / 9) * i}" y="0" width="${w / 9}" height="${h}" fill="${PALETTE.chalk}" fill-opacity="0.014"/>`
      : '',
  ).join('')}
  <rect width="${w}" height="${h}" fill="url(#bloom)"/>
  ${markings}
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.05"/>
  <rect width="${w}" height="${h}" fill="url(#scrim)"/>

  <text x="${w * 0.06}" y="${h - 54}" fill="${PALETTE.chalk}" fill-opacity="0.9"
        font-family="Impact, Haettenschweiler, sans-serif" font-size="${Math.round(h * 0.075)}"
        letter-spacing="1.5" text-transform="uppercase">${label}</text>
  <text x="${w * 0.06}" y="${h - 26}" fill="${PALETTE.neon}" fill-opacity="0.75"
        font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.032)}"
        letter-spacing="3">${sublabel}</text>
</svg>
`
}

const OUT = resolve(process.cwd(), 'public/media')

const files = [
  // Hero poster / OG image
  ['hero-poster.svg', pitch({ w: 1600, h: 900, label: 'NIMBALKAR SPORTS CLUB', sublabel: 'PLACEHOLDER — REPLACE WITH HERO STILL', bloomX: 0.28, bloomY: 0.14 })],

  ['gallery/stadium-01.svg', pitch({ w: 1600, h: 900, label: 'FULL PITCH', sublabel: 'STADIUM · PLACEHOLDER' })],
  ['gallery/stadium-02.svg', pitch({ w: 1000, h: 1000, label: 'FLOODLIGHTS', sublabel: 'STADIUM · PLACEHOLDER', bloomX: 0.5, bloomY: 0.1, lines: 'corner' })],
  ['gallery/stadium-03.svg', pitch({ w: 900, h: 1300, label: 'GATE', sublabel: 'STADIUM · PLACEHOLDER', bloomX: 0.6, bloomY: 0.3, lines: 'none' })],
  ['gallery/stadium-04.svg', pitch({ w: 1000, h: 1000, label: 'SURFACE', sublabel: 'STADIUM · PLACEHOLDER', bloomX: 0.4, bloomY: 0.6, lines: 'none' })],

  ['gallery/football-01.svg', pitch({ w: 900, h: 1300, label: 'FIVE-A-SIDE', sublabel: 'FOOTBALL · PLACEHOLDER', bloomX: 0.5, bloomY: 0.2, lines: 'corner' })],
  ['gallery/football-02.svg', pitch({ w: 1000, h: 1000, label: 'MARKINGS', sublabel: 'FOOTBALL · PLACEHOLDER', bloomX: 0.3, bloomY: 0.5 })],
  ['gallery/football-03.svg', pitch({ w: 1600, h: 900, label: 'WARM-UP', sublabel: 'FOOTBALL · PLACEHOLDER', bloomX: 0.7, bloomY: 0.2 })],
  ['gallery/football-04.svg', pitch({ w: 900, h: 1300, label: 'CRICKET NETS', sublabel: 'FOOTBALL · PLACEHOLDER', bloomX: 0.4, bloomY: 0.25, lines: 'corner' })],

  ['gallery/video-01.svg', pitch({ w: 1600, h: 900, label: 'HIGHLIGHTS', sublabel: 'VIDEO POSTER · PLACEHOLDER', bloomX: 0.5, bloomY: 0.25 })],
  ['gallery/video-02.svg', pitch({ w: 1000, h: 1000, label: 'GROUND TOUR', sublabel: 'VIDEO POSTER · PLACEHOLDER', bloomX: 0.35, bloomY: 0.3, lines: 'corner' })],
]

for (const [name, contents] of files) {
  const path = resolve(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
  console.log(`  wrote public/media/${name}`)
}

console.log(`\n  ${files.length} placeholder(s) generated.\n`)
