import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminAuth } from '@/lib/firebase/admin'
import { getAdminSession } from '@/lib/admin/auth'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_MS } from '@/lib/admin/session'
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const loginSchema = z.object({ idToken: z.string().min(20).max(4096) })

/** Brute-force ceiling. A real person signs in once. */
const LOGIN_LIMIT = 8
const LOGIN_WINDOW_MS = 5 * 60_000

/**
 * POST /api/admin/session — exchange a Firebase ID token for a session cookie.
 *
 * The client signs in with Firebase Auth, then hands the ID token here. We
 * verify it server-side, assert the `admin` custom claim, and only then mint
 * an httpOnly session cookie. A signed-in user without the claim gets 403 —
 * anyone can create an account in a Firebase project, so authentication
 * alone is not authorisation.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'admin-login'), LOGIN_LIMIT, LOGIN_WINDOW_MS)
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfter, 'Too many sign-in attempts. Please wait.')
  }

  const auth = getAdminAuth()
  if (!auth) {
    return NextResponse.json(
      { error: 'Admin sign-in is unavailable — the server has no Firebase credentials.' },
      { status: 503 },
    )
  }

  let idToken: string
  try {
    idToken = loginSchema.parse(await request.json()).idToken
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  try {
    // checkRevoked: true so a disabled account can't trade an old token.
    const decoded = await auth.verifyIdToken(idToken, true)

    if (decoded.admin !== true) {
      console.warn('[admin] sign-in denied — no admin claim', { uid: decoded.uid })
      return NextResponse.json(
        { error: 'This account does not have admin access.' },
        { status: 403 },
      )
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: ADMIN_SESSION_MAX_AGE_MS,
    })

    const response = NextResponse.json({ ok: true, email: decoded.email ?? null })
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionCookie,
      httpOnly: true,
      // Lax rather than Strict: Strict would drop the cookie when staff
      // arrive from an external link, which reads as a random logout.
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_MS / 1000,
    })
    return response
  } catch (err) {
    console.warn('[admin] sign-in failed', err instanceof Error ? err.message : err)
    // Deliberately vague: don't help someone enumerate valid accounts.
    return NextResponse.json({ error: 'Could not verify that sign-in.' }, { status: 401 })
  }
}

/**
 * DELETE /api/admin/session — sign out.
 *
 * Revokes refresh tokens as well as clearing the cookie, so a copied
 * cookie can't outlive the sign-out (`getAdminSession` verifies with
 * checkRevoked).
 */
export async function DELETE() {
  const session = await getAdminSession()
  const auth = getAdminAuth()

  if (session && auth) {
    try {
      await auth.revokeRefreshTokens(session.uid)
    } catch (err) {
      // Clearing the cookie still signs them out of this browser.
      console.error('[admin] token revocation failed', err)
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
