import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin/auth'
import { setSlotStatus } from '@/lib/admin/data'
import { describeSlotRanges } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  slotIds: z.array(z.string().regex(/^([01]\d|2[0-3]):00$/)).min(1).max(24),
  status: z.enum(['blocked', 'available']),
})

/**
 * POST /api/admin/slots — block or release slots for maintenance.
 *
 * Verified independently of middleware: middleware only checks that a
 * cookie exists (it runs on Edge and can't verify one), so this route does
 * the real check. Forging the cookie gets you a 401 here.
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
    const { changed, refused } = await setSlotStatus(input.date, input.slotIds, input.status)

    console.info('[admin] slot status changed', {
      by: session.email,
      date: input.date,
      status: input.status,
      changed: changed.length,
      refused: refused.length,
    })

    return NextResponse.json({
      ok: true,
      changed,
      refused,
      message: refused.length
        ? `${describeSlotRanges(refused).join(', ')} could not be changed — a customer holds those hours. Refund the booking first.`
        : null,
    })
  } catch (err) {
    console.error('[admin] slot update failed', err)
    return NextResponse.json({ error: 'Could not update those slots' }, { status: 500 })
  }
}
