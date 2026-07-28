import { BUSINESS } from '@/lib/business'
import { OVERTIME_POLICY, formatINR } from '@/lib/pricing'
import { describeSlotRanges, fromISODate } from '@/lib/utils'

/**
 * Receipt delivery. Both channels are optional: with no provider keys set
 * they log and return, because a missing receipt must never fail a booking
 * that has already been paid for.
 */

export interface ReceiptPayload {
  reference: string
  name: string
  phone: string
  email?: string | null
  date: string
  slotIds: string[]
  amount: number
  paymentId?: string | null
}

function longDate(dateISO: string): string {
  return fromISODate(dateISO).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function receiptText(p: ReceiptPayload): string {
  return [
    `Booking confirmed — ${BUSINESS.name}`,
    ``,
    `Reference: ${p.reference}`,
    `Name: ${p.name}`,
    `Date: ${longDate(p.date)}`,
    `Time: ${describeSlotRanges(p.slotIds).join(', ')}`,
    `Amount paid: ${formatINR(p.amount)}`,
    p.paymentId ? `Payment ID: ${p.paymentId}` : '',
    ``,
    `Overtime: ${OVERTIME_POLICY.graceMinutes} minutes grace, free. After that ${formatINR(
      OVERTIME_POLICY.blockRate,
    )} per ${OVERTIME_POLICY.blockMinutes} minutes, capped at one hour, always confirmed with you first.`,
    ``,
    `${BUSINESS.address.full}`,
    `Plus Code: ${BUSINESS.address.plusCode}`,
    `Phone: ${BUSINESS.phone}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function receiptHtml(p: ReceiptPayload): string {
  const rows: [string, string][] = [
    ['Reference', p.reference],
    ['Name', p.name],
    ['Date', longDate(p.date)],
    ['Time', describeSlotRanges(p.slotIds).join(', ')],
    ['Amount paid', formatINR(p.amount)],
  ]
  if (p.paymentId) rows.push(['Payment ID', p.paymentId])

  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#0A0E14;color:#F4F6F1;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#39FF6E">Booking confirmed</p>
    <h1 style="margin:0 0 24px;font-size:26px;line-height:1.2">${BUSINESS.name}</h1>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(244,246,241,.12);border-radius:12px;overflow:hidden">
      ${rows
        .map(
          ([label, value], i) => `<tr style="${i ? 'border-top:1px solid rgba(244,246,241,.08)' : ''}">
        <td style="padding:12px 16px;font-size:13px;color:rgba(244,246,241,.5)">${label}</td>
        <td style="padding:12px 16px;font-size:14px;text-align:right">${value}</td>
      </tr>`,
        )
        .join('')}
    </table>

    <div style="margin-top:20px;padding:14px 16px;border:1px solid rgba(251,191,36,.3);border-radius:12px;background:rgba(251,191,36,.06)">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#FBBF24">Overtime policy</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(244,246,241,.7)">
        ${OVERTIME_POLICY.graceMinutes} minutes of grace at the end of your slot, free.
        After that, ${formatINR(OVERTIME_POLICY.blockRate)} per ${OVERTIME_POLICY.blockMinutes} minutes,
        capped at one hour — and always confirmed with you before it is charged.
      </p>
    </div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:rgba(244,246,241,.55)">
      ${BUSINESS.address.full}<br>
      Plus Code ${BUSINESS.address.plusCode}<br>
      ${BUSINESS.phone} · ${BUSINESS.hours.label}
    </p>
  </div>
</body></html>`
}

/** Emails a receipt via Resend. Resolves false when not configured. */
async function sendEmailReceipt(p: ReceiptPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RECEIPT_FROM_EMAIL
  if (!apiKey || !from || !p.email) {
    if (p.email) console.info('[notify] email receipt skipped — RESEND_API_KEY not set')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [p.email],
        ...(process.env.RECEIPT_BCC_EMAIL ? { bcc: [process.env.RECEIPT_BCC_EMAIL] } : {}),
        subject: `Booking confirmed · ${p.reference} · ${BUSINESS.name}`,
        html: receiptHtml(p),
        text: receiptText(p),
      }),
    })
    if (!res.ok) {
      console.error('[notify] email receipt failed', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[notify] email receipt threw', err)
    return false
  }
}

/**
 * Sends an SMS receipt via MSG91. Any transactional provider works —
 * swap the fetch below and keep the signature.
 */
async function sendSmsReceipt(p: ReceiptPayload): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID
  if (!authKey || !templateId) {
    console.info('[notify] SMS receipt skipped — MSG91 not configured')
    return false
  }

  try {
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        short_url: '0',
        recipients: [
          {
            mobiles: `91${p.phone}`,
            REF: p.reference,
            DATE: longDate(p.date),
            TIME: describeSlotRanges(p.slotIds).join(', '),
            AMOUNT: String(p.amount),
          },
        ],
      }),
    })
    if (!res.ok) {
      console.error('[notify] SMS receipt failed', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[notify] SMS receipt threw', err)
    return false
  }
}

/**
 * Fires both channels. Always resolves — never let a receipt problem
 * surface as a booking failure.
 */
export async function sendReceipts(p: ReceiptPayload): Promise<void> {
  await Promise.allSettled([sendEmailReceipt(p), sendSmsReceipt(p)])
}
