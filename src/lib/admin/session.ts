/**
 * Session-cookie constants, with NO dependencies.
 *
 * Deliberately separate from `./auth.ts`. Middleware runs on the Edge
 * runtime, and `auth.ts` imports `next/headers` and `firebase-admin` —
 * neither of which works there. Importing even a single constant from it
 * would pull that whole graph into the Edge bundle and break the build.
 *
 * Anything Edge code needs belongs here.
 */

export const ADMIN_SESSION_COOKIE = 'nsc_admin_session'

/** Two weeks — Firebase caps session cookies at 14 days. */
export const ADMIN_SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
