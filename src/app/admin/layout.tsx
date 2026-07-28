import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'

/**
 * Admin shell.
 *
 * Deliberately spare: no Lenis, no boot cursor, no booking modal. Those
 * live in `(site)/layout.tsx`. Hijacked scrolling and a hidden native
 * cursor are pleasant for thirty seconds on a landing page and hostile in
 * a tool someone works in for an hour.
 *
 * No auth check here. The login page lives inside this layout, so gating it
 * at the layout would lock everyone out. Each page calls
 * `getAdminSession()` for itself.
 */
export const metadata: Metadata = {
  title: 'Admin',
  // Keep the panel out of search results entirely.
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-night text-chalk">{children}</div>
    </ToastProvider>
  )
}
