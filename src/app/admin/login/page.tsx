'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, ShieldAlert } from 'lucide-react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/services'
import { isFirebaseConfigured } from '@/lib/firebase/client'
import { Logo } from '@/components/layout/Logo'
import { cn } from '@/lib/utils'

/**
 * Staff sign-in.
 *
 * Two steps, and the second is the one that matters:
 *   1. Firebase Auth verifies the password in the browser.
 *   2. The resulting ID token goes to /api/admin/session, which checks the
 *      `admin` custom claim server-side and mints an httpOnly cookie.
 *
 * Step 1 alone proves nothing about authorisation — anyone can create an
 * account in a Firebase project. If step 2 returns 403 we sign straight
 * back out, so a non-admin is never left holding a Firebase session.
 */
export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const configured = isFirebaseConfigured

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    setError(null)
    setBusy(true)

    const auth = getFirebaseAuth()
    if (!auth) {
      setError('Firebase is not configured on this deployment.')
      setBusy(false)
      return
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const idToken = await credential.user.getIdToken()

      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        // Don't leave a non-admin signed in to Firebase.
        await signOut(auth).catch(() => {})
        setError(body.error ?? 'Could not sign you in.')
        setBusy(false)
        return
      }

      // Read the return path from the URL rather than useSearchParams, which
      // would force a Suspense boundary for no benefit here.
      const next = new URLSearchParams(window.location.search).get('next')
      // Only allow same-site paths — never redirect to an arbitrary URL.
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
      router.replace(target)
    } catch (err) {
      // Firebase error codes are deliberately not surfaced verbatim: they
      // distinguish "wrong password" from "no such user", which is an
      // account-enumeration gift.
      console.warn('[admin] sign-in error', err)
      setError('That email and password combination did not work.')
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>

        <div className="card p-6 sm:p-7">
          <h1 className="font-display text-display-sm uppercase text-chalk">Staff sign-in</h1>
          <p className="mt-2 text-[0.85rem] text-chalk/55">
            For club staff only. Customers don&apos;t need an account to book.
          </p>

          {!configured ? (
            <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/[0.06] p-3.5 text-[0.8rem] leading-relaxed text-amber/90">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Firebase isn&apos;t configured on this deployment, so sign-in is unavailable. Add the
              <code className="mx-1">NEXT_PUBLIC_FIREBASE_*</code> variables and redeploy.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-2 block font-display text-[0.66rem] uppercase tracking-[0.16em] text-chalk/55">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!configured || busy}
                className="h-12 w-full rounded-xl border border-chalk/12 bg-night-700/60 px-4 text-[0.9rem] text-chalk outline-none transition-colors placeholder:text-chalk/30 focus:border-neon/60 disabled:opacity-50"
                placeholder="you@nimbalkarsportsclub.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-display text-[0.66rem] uppercase tracking-[0.16em] text-chalk/55">
                Password
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!configured || busy}
                className="h-12 w-full rounded-xl border border-chalk/12 bg-night-700/60 px-4 text-[0.9rem] text-chalk outline-none transition-colors placeholder:text-chalk/30 focus:border-neon/60 disabled:opacity-50"
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <p role="alert" className="text-[0.8rem] leading-relaxed text-red-400">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!configured || busy}
              className={cn(
                'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full',
                'bg-neon font-display text-[0.8rem] uppercase tracking-[0.14em] text-night',
                'transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[0.75rem] leading-relaxed text-chalk/40">
          Admin access is granted by the <code>admin</code> claim, not by having an account. See
          <code className="mx-1">scripts/grant-admin.ts</code>.
        </p>
      </div>
    </main>
  )
}
