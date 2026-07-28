import { cookies } from 'next/headers'
import { getAdminAuth } from '@/lib/firebase/admin'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session'

/**
 * Staff authentication for /admin.
 *
 * WHY A SESSION COOKIE AND NOT THE ID TOKEN
 * A Firebase ID token lives an hour and is only available to client JS,
 * which would force every admin page to be a client component that fetches
 * after mount — slow, and it flashes unauthenticated content. Firebase's
 * session cookies are httpOnly, last as long as we choose, and can be read
 * during server rendering, so an admin page can be a server component that
 * is *never* sent to an unauthorised browser at all.
 *
 * WHY BEING A SIGNED-IN USER ISN'T ENOUGH
 * Anyone can create an account in a Firebase project. Authorisation comes
 * from the `admin: true` custom claim, which only the Admin SDK can set —
 * see scripts/grant-admin.ts. That's the same claim `firestore.rules` and
 * `storage.rules` already check, so the web panel and the security rules
 * agree on who counts as staff.
 *
 * This module is server-only by construction: importing `next/headers`
 * from a client component is a build error, so there's no need for the
 * `server-only` package (which isn't a declared dependency).
 */

export interface AdminSession {
  uid: string
  email: string | null
}

/**
 * Verifies the session cookie and the admin claim.
 *
 * `checkRevoked: true` costs a round trip but means signing a compromised
 * account out actually takes effect immediately, rather than whenever the
 * cookie happens to expire.
 *
 * Returns null for every failure — missing cookie, expired, revoked, not an
 * admin — because callers should treat them identically.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value
  if (!cookie) return null

  const auth = getAdminAuth()
  if (!auth) return null

  try {
    const decoded = await auth.verifySessionCookie(cookie, true)
    if (decoded.admin !== true) return null
    return { uid: decoded.uid, email: decoded.email ?? null }
  } catch {
    // Expired, revoked, malformed, or signed by a different project.
    return null
  }
}
