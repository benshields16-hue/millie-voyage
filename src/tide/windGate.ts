// Wind go/no-go. DESIGN STANCE (per the brief's open question): never a bare
// "GO". Be firm only on the warning (a NO-GO is safe to state confidently); make
// the positive state deliberately weak ("no flag on these inputs — still verify").
// This gives safety's asymmetry: confident about stop, humble about proceed.

import type { Gate, CompassPoint } from '../data/gates'

export const VERDICT = { NOGO: 'nogo', CAUTION: 'caution', CLEAR: 'clear' } as const
export type Verdict = (typeof VERDICT)[keyof typeof VERDICT]

const DIRS: Record<CompassPoint, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
}

/** Angular distance 0..180, wraparound-safe (naive abs(350−0)≤30 wrongly says N is far). */
export function angDist(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

export function dirToDeg(d: CompassPoint | number): number {
  if (typeof d === 'number') return ((d % 360) + 360) % 360
  return DIRS[d]
}

export interface WindInput {
  dir: CompassPoint | number // direction the wind blows FROM
  forceBft: number
}

export interface WindResult {
  state: Verdict
  headline: string
  rule: string
  inputs: { direction: string; force: string; nearestFoul: string; degFromFoul: number }
  caveat: string
}

const FOUL_TOL = 22.5 // within one compass point of a foul sector = foul
const NEAR_TOL = 33.75 // just outside = "near-foul" → caution

export function windVerdict(gate: Gate, wind: WindInput): WindResult {
  const deg = dirToDeg(wind.dir)
  const f = wind.forceBft
  const nearest = gate.foulWinds
    .map((n) => ({ name: n, dist: angDist(deg, DIRS[n]) }))
    .sort((a, b) => a.dist - b.dist)[0]!
  const inFoul = nearest.dist <= FOUL_TOL
  const nearFoul = nearest.dist > FOUL_TOL && nearest.dist <= NEAR_TOL

  let state: Verdict
  let headline: string
  if (inFoul && f >= gate.foulForceMin) {
    state = VERDICT.NOGO
    headline = `Wind-against-tide risk — consider waiting.${gate.bailout ? ' ' + gate.bailout + '.' : ''}`
  } else if (inFoul && f === gate.foulForceMin - 1) {
    state = VERDICT.CAUTION
    headline = `Foul direction, force near the F${gate.foulForceMin} threshold — marginal.`
  } else if (nearFoul && f >= gate.foulForceMin) {
    state = VERDICT.CAUTION
    headline = 'Wind close to the foul sector and blowing hard — assess carefully.'
  } else {
    state = VERDICT.CLEAR
    headline = 'No wind-against-tide flag on these inputs.' // deliberately NOT "GO"
  }

  return {
    state,
    headline,
    rule: `Foul winds for ${gate.name}: ${gate.foulWinds.join('/')} at force ≥ ${gate.foulForceMin} opposing the ebb.`,
    inputs: {
      direction: typeof wind.dir === 'number' ? `${deg}°` : wind.dir,
      force: `F${f}`,
      nearestFoul: nearest.name,
      degFromFoul: Math.round(nearest.dist),
    },
    caveat: 'Suggestion only — verify the latest Météo-France forecast and assess on the water.',
  }
}
