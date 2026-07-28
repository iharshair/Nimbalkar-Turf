import { Hero } from '@/components/sections/Hero'
import { LiveStatusBar } from '@/components/sections/LiveStatusBar'
import { About } from '@/components/sections/About'
import { Amenities } from '@/components/sections/Amenities'
import { Gallery } from '@/components/sections/Gallery'
import { Pricing } from '@/components/sections/Pricing'
import { BookingSection } from '@/components/sections/BookingSection'
import { Reviews } from '@/components/sections/Reviews'
import { Location } from '@/components/sections/Location'
import { PitchDivider } from '@/components/ui/Section'

/**
 * One scrolling page, ordered as a funnel:
 * see it → trust it → understand the cost → book it → verify → visit.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <LiveStatusBar />
      <About />
      <PitchDivider />
      <Amenities />
      <Gallery />
      <Pricing />
      <BookingSection />
      <PitchDivider />
      <Reviews />
      <PitchDivider />
      <Location />
    </>
  )
}
