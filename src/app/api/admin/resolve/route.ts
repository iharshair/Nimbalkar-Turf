import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin/auth'
import { clearNeedsAttention } from '@/lib/admin/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ bookingId: z.string().min(1).max(64) })

/**
 * POST /api/admin/resolve — clear the needsAttention flag.
 *
 * For when the situation was settled off-system: the customer was moved to
 * another slot, or paid at the gate, or agreed to a credit. Records who
 * cleared it, because "who decided this was fine?" is the first question
 * anyone asks a week later.
 */
export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Not authorised' }, { status: 401 })

  let input: z.infer<typeof schema>
  try {
    input = schema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  try {
    await clearNeedsAttention(input.bookingId, session.email ?? session.uid)
    console.info('[admin] attention flag cleared', {
      by: session.email,
      bookingId: input.bookingId,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin] could not clear flag', err)
    return NextResponse.json({ error: 'Could not update that booking' }, { status: 500 })
  }
}
