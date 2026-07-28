import { NextResponse, type NextRequest } from 'next/server'
// Imported from ./lib/admin/session, NOT ./lib/admin/auth: the latter
// pulls in firebase-admin and next/headers, which don't run on Edge.
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session'

/**
 * Cheap gate for /admin.
 *
 * IMPORTANT: this only checks that a session cookie is *present*. It cannot
 * verify it — middleware runs on the Edge runtime, and `firebase-admin`
 * needs Node APIs it doesn't have. So this is a redirect convenience, not a
 * security boundary.
 *
 * The real check is `getAdminSession()`, called independently by every
 * admin page and every /api/admin route on the Node runtime. Forging this
 * cookie gets you a redirect you didn't need — the page itself still
 * refuses to render and the APIs still return 401.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // The login page must stay reachable without a session.
  if (pathname === '/admin/login') {
    // Already signed in? Skip the form.
    if (request.cookies.has(ADMIN_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.next()
  }

  if (!request.cookies.has(ADMIN_SESSION_COOKIE)) {
    const login = new URL('/admin/login', request.url)
    // Preserve where they were headed so sign-in can return them there.
    if (pathname !== '/admin') login.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  /*
    Admin pages only. The /api/admin routes are deliberately excluded:
    they must answer 401 as JSON, not 302 to an HTML login page, or every
    fetch from the panel would silently "succeed" with a login document.
  */
  matcher: ['/admin', '/admin/:path*'],
}
