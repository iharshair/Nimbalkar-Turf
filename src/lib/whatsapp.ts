import { BUSINESS } from '@/lib/business'
import { OVERTIME_POLICY, formatINR } from '@/lib/pricing'
import { describeSlotRanges, fromISODate } from '@/lib/utils'

/** wa.me deep link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${BUSINESS.whatsapp}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export const WHATSAPP_ENQUIRY = `Hi ${BUSINESS.name}, I'd like to check turf availability.`

function longDate(dateISO: string): string {
  return fromISODate(dateISO).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * The confirmation message the customer sends themselves after paying.
 * It restates the grace period on purpose — the policy should be in the
 * customer's own chat history, not only on a web page they closed.
 */
export function bookingConfirmationMessage(params: {
  reference: string
  name: string
  date: string
  slotIds: string[]
  amount: number
}): string {
  const { reference, name, date, slotIds, amount } = params
  const ranges = describeSlotRanges(slotIds).join(', ')

  return [
    `Booking confirmed at ${BUSINESS.name}`,
    ``,
    `Ref: ${reference}`,
    `Name: ${name}`,
    `Date: ${longDate(date)}`,
    `Time: ${ranges}`,
    `Paid: ${formatINR(amount)}`,
    ``,
    `Grace period: ${OVERTIME_POLICY.graceMinutes} minutes free. After that, ${formatINR(
      OVERTIME_POLICY.blockRate,
    )} per ${OVERTIME_POLICY.blockMinutes} minutes.`,
    ``,
    `${BUSINESS.address.full}`,
    `Plus Code: ${BUSINESS.address.plusCode}`,
  ].join('\n')
}
