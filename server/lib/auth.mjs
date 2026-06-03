// Token helpers — constant-time compare so a token can't be recovered by timing.

import { timingSafeEqual } from 'node:crypto'

/** Constant-time string equality (false on type/length mismatch, without leaking length via timing of the compare itself). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Pull the token out of an "Authorization: Bearer <token>" header. */
export function bearerToken(header) {
  if (typeof header !== 'string') return ''
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1] : ''
}
