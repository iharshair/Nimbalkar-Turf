/**
 * Grants or revokes admin access.
 *
 *   npm run grant-admin -- you@example.com
 *   npm run grant-admin -- you@example.com --revoke
 *
 * Admin access is the `admin: true` custom claim, not merely having an
 * account — anyone can sign up to a Firebase project. Only the Admin SDK
 * can set a custom claim, which is why this is a script and not a page:
 * there is no bootstrap path through the UI, by design.
 *
 * The same claim is what firestore.rules and storage.rules already check,
 * so the web panel and the database rules agree on who counts as staff.
 *
 * Create the user first (Firebase console → Authentication → Add user),
 * then run this. Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/** Minimal .env.local reader so the script needs no extra dependency. */
function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), 'utf8')
      for (const line of raw.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
        if (!match) continue
        const [, key, rawValue] = match
        if (process.env[key]) continue
        process.env[key] = rawValue.replace(/^["']|["']$/g, '')
      }
    } catch {
      // File absent — fall through to the real environment.
    }
  }
}

async function main() {
  loadDotEnv()

  const args = process.argv.slice(2)
  const email = args.find((a) => a.includes('@'))
  const revoke = args.includes('--revoke')

  if (!email) {
    console.error(
      '\n  Usage: npm run grant-admin -- someone@example.com [--revoke]\n' +
        '  Create the user in the Firebase console first.\n',
    )
    process.exit(1)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      '\n  Missing Firebase Admin credentials.\n' +
        '  Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.\n',
    )
    process.exit(1)
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  }
  const auth = getAuth()

  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    console.error(
      `\n  No user with the email ${email} in project "${projectId}".\n` +
        '  Create them first: Firebase console → Authentication → Users → Add user.\n',
    )
    process.exit(1)
  }

  // Merge rather than replace: clobbering existing claims would silently
  // remove anything else set on the account.
  const claims = { ...(user.customClaims ?? {}), admin: revoke ? false : true }
  await auth.setCustomUserClaims(user.uid, claims)

  // Custom claims only reach the client on the next token refresh, which is
  // up to an hour away. Revoking forces an immediate re-auth — essential
  // when removing access, and harmless when granting it.
  await auth.revokeRefreshTokens(user.uid)

  console.log(
    `\n  ${revoke ? 'Revoked' : 'Granted'} admin for ${email} (${user.uid}).\n` +
      `  They must sign in again for it to take effect.\n` +
      `  Panel: /admin\n`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
