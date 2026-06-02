// Minutes-based time core. Safari-safe: NEVER parse a string into a Date
// (old iOS Safari returns Invalid Date for "2026-06-08 11:12" and historically
// mis-parses the bare-T no-offset form as UTC). All gate math is wall-clock
// arithmetic in integer minutes, so the timezone offset cancels and never enters
// the computation.

/** 'HH:MM' -> minutes since local midnight. */
export function hmToMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) throw new Error(`bad time: ${hhmm}`)
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) throw new Error(`time out of range: ${hhmm}`)
  return h * 60 + mi
}

/**
 * minutes -> 'HH:MM', tagging any day rollover, e.g. '00:10 (+1d)' / '23:40 (-1d)'.
 * The tag matters: a depart/arrive computed by subtracting a lead can cross
 * midnight, and showing it as a bare same-day time is the off-by-a-day briefing bug.
 */
export function minToHm(min: number): string {
  const day = Math.floor(min / 1440)
  const r = ((min % 1440) + 1440) % 1440
  const hh = String(Math.floor(r / 60)).padStart(2, '0')
  const mm = String(r % 60).padStart(2, '0')
  const s = `${hh}:${mm}`
  if (day === 0) return s
  return `${s} (${day > 0 ? '+' : ''}${day}d)`
}

/** Round minutes to the nearest `step` (half-up). */
export function roundToMin(min: number, step: number): number {
  return Math.round(min / step) * step
}

/** 'YYYY-MM-DD' -> 20260608 (an orderable integer key; no Date involved). */
export function dateKey(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error(`bad date: ${ymd}`)
  return Number(`${m[1]}${m[2]}${m[3]}`)
}
