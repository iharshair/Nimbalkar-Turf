/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Swap in your CDN / Firebase Storage bucket host when real media lands.
    remotePatterns: [
      // Legacy bucket host.
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      // Current host for buckets created as <project>.firebasestorage.app.
      { protocol: 'https', hostname: '*.firebasestorage.app' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      {
        // Long-cache immutable media. Bust by filename, not by query string.
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
