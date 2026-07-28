'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getFirebaseAuth } from '@/lib/firebase/services'
import { signOut } from 'firebase/auth'

/**
 * Signs out of both halves: the httpOnly session cookie (server, which also
 * revokes refresh tokens) and the Firebase client session. Missing the
 * second would leave the browser able to mint a fresh ID token and walk
 * straight back in.
 */
export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onSignOut() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/admin/session', { method: 'DELETE' })
    } catch {
      // Clearing the client session below still gets them out.
    }
    const auth = getFirebaseAuth()
    if (auth) await signOut(auth).catch(() => {})
    router.replace('/admin/login')
  }

  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full border border-chalk/15 px-3.5 py-2 font-display text-[0.66rem] uppercase tracking-[0.14em] text-chalk/60 transition-colors hover:border-chalk/35 hover:text-chalk disabled:opacity-40"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
