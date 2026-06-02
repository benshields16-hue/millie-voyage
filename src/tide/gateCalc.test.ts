import { describe, it, expect } from 'vitest'
import { hwEventsForDate, gateWindow, isInTable } from './gateCalc'
import { GATES } from '../data/gates'
import { hmToMin, minToHm, roundToMin } from './timeMin'
import { angDist, dirToDeg, windVerdict, VERDICT } from './windGate'
import { coeffBand, coeffTimeline } from './coeffTimeline'

describe('timeMin', () => {
  it('parses and formats HH:MM', () => {
    expect(hmToMin('08:12')).toBe(492)
    expect(minToHm(492)).toBe('08:12')
    expect(minToHm(642)).toBe('10:42')
  })
  it('tags day rollover (the off-by-a-day guard)', () => {
    expect(minToHm(-20)).toBe('23:40 (-1d)')
    expect(minToHm(1450)).toBe('00:10 (+1d)')
  })
  it('rounds to nearest 5 min, half-up', () => {
    expect(roundToMin(492, 5)).toBe(490) // 08:12 -> 08:10
    expect(minToHm(roundToMin(492, 5))).toBe('08:10')
  })
})

describe('Chenal du Four — Mon 8 Jun 2026 (brief worked example)', () => {
  it('reproduces turn 10:42 (exact) and depart 08:10 (rounded)', () => {
    const events = hwEventsForDate('2026-06-08')
    expect(events.length).toBe(2)
    const morning = events[0]!
    expect(morning.hwMin).toBe(hmToMin('11:12')) // 672
    const w = gateWindow('2026-06-08', GATES.four, morning)
    expect(w.turnMin).toBe(642) // 10:42, exact (672 − 30)
    expect(minToHm(w.turnMin)).toBe('10:42')
    expect(w.arriveMin).toBe(642) // Four: arrive AT the turn
    expect(w.departMin).toBe(492) // 08:12 raw (642 − 150)
    expect(minToHm(roundToMin(w.departMin!, 5))).toBe('08:10') // the brief's "08:10"
    expect(w.coeff).toBe(47)
  })
})

describe('Raz de Sein — no published passage time', () => {
  it('returns departMin null and arrival 20 min before the turn', () => {
    const morning = hwEventsForDate('2026-06-08')[0]!
    const w = gateWindow('2026-06-08', GATES.raz, morning)
    expect(w.departMin).toBeNull()
    expect(w.turnMin - w.arriveMin).toBe(20)
  })
})

describe('table range guard', () => {
  it('knows in- vs out-of-table dates', () => {
    expect(isInTable('2026-06-08')).toBe(true)
    expect(isInTable('2026-06-20')).toBe(false)
    expect(isInTable('2026-06-06')).toBe(false)
  })
})

describe('wind go/no-go', () => {
  it('angular distance is wraparound-safe at North', () => {
    expect(angDist(350, 0)).toBe(10)
    expect(angDist(10, 350)).toBe(20)
    expect(dirToDeg('N')).toBe(0)
  })
  it('SW F6 against the Four is NO-GO', () => {
    expect(windVerdict(GATES.four, { dir: 'SW', forceBft: 6 }).state).toBe(VERDICT.NOGO)
  })
  it('Raz: due S does not trip, SSW does (sector sensitivity)', () => {
    expect(windVerdict(GATES.raz, { dir: 'S', forceBft: 6 }).state).not.toBe(VERDICT.NOGO)
    expect(windVerdict(GATES.raz, { dir: 'SSW', forceBft: 6 }).state).toBe(VERDICT.NOGO)
  })
  it('F4 in a foul direction is only caution at most, not no-go', () => {
    expect(windVerdict(GATES.four, { dir: 'W', forceBft: 4 }).state).toBe(VERDICT.CAUTION)
  })
  it('never emits a bare GO — the clear state is hedged and keeps the forecast caveat', () => {
    const r = windVerdict(GATES.four, { dir: 'N', forceBft: 3 })
    expect(r.state).toBe(VERDICT.CLEAR)
    expect(r.headline.toUpperCase()).not.toContain('GO')
    expect(r.caveat).toMatch(/Météo-France/)
  })
})

describe('coefficient timeline', () => {
  it('maps bands by this voyage scale', () => {
    expect(coeffBand(47).color).toBe('green')
    expect(coeffBand(69).color).toBe('amber')
    expect(coeffBand(90).color).toBe('red')
  })
  it('spans all 9 days and flags the gentlest (coeff 47)', () => {
    const t = coeffTimeline()
    expect(t.length).toBe(9)
    const gentlest = t.filter((c) => c.isGentlest)
    expect(gentlest.length).toBeGreaterThan(0)
    expect(gentlest.every((c) => c.coeffMax === 47)).toBe(true)
  })
})
