// Stateless progress derivation: current leg / miles / % computed fresh from
// (date, position, optional manual override). Nothing is stored — open the app on
// two devices and both compute the same answer with no sync.

import { LEGS, TOTAL_NM, type Leg } from '../data/legs'
import { crossTrack } from '../sources/geo'
import { dateKey } from '../tide/timeMin'
import type { Fix } from '../sources/types'

export type ProgressSource = 'override' | 'position' | 'date' | 'start'

export interface Progress {
  legIndex: number
  leg: Leg
  milesDone: number
  milesRemaining: number
  percent: number
  source: ProgressSource
}

/** Leg whose route segment the fix is nearest to (smallest cross-track), with the
 *  along-track fraction for miles-done. */
function pickLegByPosition(fix: Fix): { index: number; frac: number } {
  let best = { index: 0, frac: 0, perp: Infinity }
  LEGS.forEach((leg, i) => {
    const { t, perpNm } = crossTrack(fix, leg.fromCoord, leg.toCoord)
    if (perpNm < best.perp) best = { index: i, frac: t, perp: perpNm }
  })
  return { index: best.index, frac: best.frac }
}

/** Latest leg whose planned date is on or before `now` (only if dates are set). */
function pickLegByDate(now: Date): number {
  const today = dateKey(toYmd(now))
  let idx = -1
  LEGS.forEach((leg, i) => {
    if (leg.plannedDate && dateKey(leg.plannedDate) <= today) idx = i
  })
  return idx
}

export function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function deriveProgress(
  now: Date,
  fix: Fix | null,
  override: number | null,
): Progress {
  let legIndex: number
  let source: ProgressSource
  let frac = 0

  if (override != null && override >= 0 && override < LEGS.length) {
    legIndex = override
    source = 'override'
  } else if (fix) {
    const pick = pickLegByPosition(fix)
    legIndex = pick.index
    frac = pick.frac
    source = 'position'
  } else {
    const byDate = pickLegByDate(now)
    legIndex = byDate >= 0 ? byDate : 0
    source = byDate >= 0 ? 'date' : 'start'
  }

  const leg = LEGS[legIndex]!
  let milesDone = 0
  for (let i = 0; i < legIndex; i++) milesDone += LEGS[i]!.distanceNm
  if (source === 'position') milesDone += frac * leg.distanceNm

  milesDone = Math.min(TOTAL_NM, Math.max(0, milesDone))
  const milesRemaining = Math.max(0, TOTAL_NM - milesDone)
  const percent = TOTAL_NM > 0 ? Math.min(100, (milesDone / TOTAL_NM) * 100) : 0

  return { legIndex, leg, milesDone, milesRemaining, percent, source }
}
