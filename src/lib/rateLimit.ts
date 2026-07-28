/**
 * Minimal fixed-window rate limiter.
 *
 * WHY THIS EXISTS
 * Creating an order places a 10-minute hold on real slots. Without a
 * limit, a single client can loop valid requests and hold every hour of
 * every bookable day — taking the entire online calendar offline for the
 * business at effectively no cost to the attacker. That's the highest
 * impact abuse this API has, and it needs no authentication to pull off.
 *
 * LIMITATION — READ BEFORE PRODUCTION
 * State is per-process and in-memory. On a serverless host each instance
 * keeps its own counters, so the effective limit is (limit x instances),
 * and counters reset on cold start. It meaningfully raises the cost of
 * casual abuse; it is NOT a defence against a distributed attacker.
 *
 * For production, back this with something shared — Upstash Redis
 * (`@upstash/ratelimit`) or Firestore — or put the limit in front of the
 * app at Cloudflare / the load balancer. The function signature here is
 * deliberately small so swapping the backend touches one file.
 */

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

/** Cap the map so a flood of unique keys can't grow it without bound. */
const MAX_TRACKED_KEYS = 10_000

function sweep(now: number) {
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  /** Requests still allowed in this window. */
  remaining: number
  /** Seconds until the window resets — send as Retry-After. */
  retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (buckets.size > MAX_TRACKED_KEYS) sweep(now)

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }

  existing.count += 1
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))

  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter }
  }
  return { ok: true, remaining: limit - existing.count, retryAfter }
}

/**
 * Best-effort client identity.
 *
 * x-forwarded-for is set by the platform's proxy. It is spoofable when the
 * app is reached directly, which is one more reason the real limit belongs
 * at the edge — but behind Netlify, Firebase Hosting or Cloudflare the
 * left-most entry is the actual client.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  return `${scope}:${ip}`
}

/** Shared 429 response, with the header clients actually honour. */
export function tooManyRequests(retryAfter: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  })
}
