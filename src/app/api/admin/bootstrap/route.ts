import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminAuth } from '@/lib/firebase/admin'
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/bootstrap — grant the FIRST admin, once.
 *
 * WHY THIS EXISTS
 * Admin access is the `admin: true` custom claim, and only the Admin SDK can
 * set one — there is no Firebase Console UI for custom claims. Normally
 * `npm run grant-admin` does it, but that needs a terminal. This is the
 * equivalent for someone who only has a browser.
 *
 * WHY IT IS SAFE TO SHIP BRIEFLY
 * It is a privilege-escalation endpoint, so it has three independent locks:
 *
 *   1. ADMIN_BOOTSTRAP_SECRET must be set, and at least 24 characters. No
 *      secret, no endpoint — it 404s as if it doesn't exist.
 *   2. The secret is compared in constant time, and the route is rate
 *      limited to 5 attempts per 10 minutes per IP.
 *   3. It SELF-DISABLES. If any user already holds the admin claim it
 *      refuses. So it can only ever create the first admin, which means a
 *      leaked secret later is worthless.
 *
 * DELETE THIS FILE once you have signed in successfully, and remove
 * ADMIN_BOOTSTRAP_SECRET from the environment. The locks above are
 * belt-and-braces, not a reason to keep it around.
 */

const schema = z.object({ email: z.string().email() })

/** Users scanned when checking whether an admin already exists. */
const SCAN_LIMIT = 1000

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET

  // Lock 1: without a configured secret this endpoint does not exist.
  if (!expected || expected.length < 24) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Lock 2a: throttle guessing.
  const limit = rateLimit(clientKey(request, 'admin-bootstrap'), 5, 10 * 60_000)
  if (!limit.ok) return tooManyRequests(limit.retryAfter, 'Too many attempts.')

  // Lock 2b: constant-time comparison.
  const provided = request.headers.get('x-bootstrap-secret') ?? ''
  if (!secretMatches(provided, expected)) {
    console.warn('[bootstrap] rejected — bad secret')
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 })
  }

  const auth = getAdminAuth()
  if (!auth) {
    return NextResponse.json(
      { error: 'Firebase Admin is not configured on this deployment.' },
      { status: 503 },
    )
  }

  let email: string
  try {
    email = schema.parse(await request.json()).email
  } catch {
    return NextResponse.json({ error: 'Provide a valid { "email": "..." }' }, { status: 422 })
  }

  // Lock 3: self-disable once an admin exists.
  try {
    const existing = await auth.listUsers(SCAN_LIMIT)
    const admins = existing.users.filter((u) => u.customClaims?.admin === true)
    if (admins.length > 0) {
      console.warn('[bootstrap] refused — an admin already exists')
      return NextResponse.json(
        {
          error:
            'An admin already exists, so this endpoint is disabled. Use `npm run grant-admin` for further accounts, and delete this route.',
          existingAdmins: admins.map((u) => u.email ?? u.uid),
        },
        { status: 409 },
      )
    }
  } catch (err) {
    console.error('[bootstrap] could not check existing admins', err)
    // Fail closed: if we can't prove there is no admin, don't grant one.
    return NextResponse.json({ error: 'Could not verify existing admins.' }, { status: 500 })
  }

  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    return NextResponse.json(
      {
        error: `No user with the email ${email}. Create them first: Firebase Console → Authentication → Users → Add user. Enable the Email/Password provider if you haven't.`,
      },
      { status: 404 },
    )
  }

  try {
    // Merge, so nothing else set on the account is clobbered.
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true })
    // Claims only reach the client on the next token refresh — up to an hour.
    // Revoking forces an immediate re-auth so sign-in works right away.
    await auth.revokeRefreshTokens(user.uid)
  } catch (err) {
    console.error('[bootstrap] failed to set the claim', err)
    return NextResponse.json({ error: 'Could not grant admin access.' }, { status: 500 })
  }

  console.info('[bootstrap] admin granted', { email, uid: user.uid })

  return NextResponse.json({
    ok: true,
    email,
    uid: user.uid,
    next: [
      'Sign in at /admin/login',
      'Delete src/app/api/admin/bootstrap/route.ts',
      'Remove ADMIN_BOOTSTRAP_SECRET from the environment',
    ],
  })
}
