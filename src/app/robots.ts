import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nimbalkarsportsclub.com'

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin is also noindex via its layout metadata; this stops
    // crawlers requesting it at all.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
