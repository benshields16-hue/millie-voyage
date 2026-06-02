// Coefficient timeline data for the neap→spring strip. Bands are calibrated to
// THIS voyage's window (coeffs 47–93): a generic ">100 = red" scale would paint
// every day green. Lower coefficient = weaker streams = gentler gate.

import { HW_BREST, type Regime } from '../data/tides'
import { dateKey } from './timeMin'

export type Band = 'gentle' | 'moderate' | 'strong'
export type BandColor = 'green' | 'amber' | 'red'

export interface CoeffBand {
  max: number
  key: Band
  label: string
  color: BandColor
}

export const COEFF_BANDS: readonly CoeffBand[] = [
  { max: 55, key: 'gentle', label: 'Gentle', color: 'green' },
  { max: 74, key: 'moderate', label: 'Moderate', color: 'amber' },
  { max: Infinity, key: 'strong', label: 'Strong', color: 'red' },
]

export function coeffBand(c: number): CoeffBand {
  for (const b of COEFF_BANDS) if (c <= b.max) return b
  return COEFF_BANDS[COEFF_BANDS.length - 1]!
}

export interface TimelineCell {
  date: string
  coeffMin: number
  coeffMax: number
  coeffs: number[]
  band: Band
  color: BandColor
  label: string
  regime: Regime
  isGentlest: boolean
}

/** One cell per calendar day; the lowest-coefficient day(s) are flagged gentlest. */
export function coeffTimeline(): TimelineCell[] {
  const byDay = new Map<string, { date: string; coeffs: number[]; regime: Regime }>()
  for (const e of HW_BREST) {
    const d = byDay.get(e.date) ?? { date: e.date, coeffs: [], regime: e.regime }
    d.coeffs.push(e.coeff)
    byDay.set(e.date, d)
  }
  const rows = [...byDay.values()]
    .sort((a, b) => dateKey(a.date) - dateKey(b.date))
    .map((d): TimelineCell => {
      const coeffMax = Math.max(...d.coeffs)
      const b = coeffBand(coeffMax)
      return {
        date: d.date,
        coeffMin: Math.min(...d.coeffs),
        coeffMax,
        coeffs: d.coeffs,
        band: b.key,
        color: b.color,
        label: b.label,
        regime: d.regime,
        isGentlest: false,
      }
    })
  const lo = Math.min(...rows.map((r) => r.coeffMax))
  return rows.map((r) => ({ ...r, isGentlest: r.coeffMax === lo }))
}
