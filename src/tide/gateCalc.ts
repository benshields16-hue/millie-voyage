// Pure gate-timing computation. "Now" never enters here — the chosen date is
// injected by the UI, keeping this module deterministic and unit-testable.

import { HW_BREST, TABLE_RANGE, type HwEvent } from '../data/tides'
import type { Gate } from '../data/gates'
import { hmToMin, dateKey } from './timeMin'

export interface HwChoice extends HwEvent {
  hwMin: number // minutes since local midnight, derived from `time`
}

export interface GateWindow {
  gateId: string
  gateName: string
  date: string
  hwTime: string
  hwMin: number
  turnMin: number // stream turn — show to the exact minute
  arriveMin: number // recommended arrival at the gate
  departMin: number | null // recommended departure from previous port (null = not published)
  coeff: number
  regime: string
  indicative: true // always — drives the "verify in Bloc Marine" caveat
}

// June Brittany daylight band, for scoring which HW gives a sane daytime transit.
const DAY_START = 6 * 60
const DAY_END = 21 * 60 + 30

/** All HW events on a given date, parsed to minutes and sorted earliest-first. */
export function hwEventsForDate(ymd: string): HwChoice[] {
  const k = dateKey(ymd)
  return HW_BREST.filter((e) => dateKey(e.date) === k)
    .map((e) => ({ ...e, hwMin: hmToMin(e.time) }))
    .sort((a, b) => a.hwMin - b.hwMin)
}

export function streamTurn(hwMin: number, gate: Gate): number {
  return hwMin + gate.streamTurnOffsetMin
}

export function gateWindow(ymd: string, gate: Gate, hwChoice: HwChoice): GateWindow {
  const turnMin = streamTurn(hwChoice.hwMin, gate)
  const arriveMin = turnMin - gate.arriveBeforeMin
  const departMin = gate.departLeadMin == null ? null : arriveMin - gate.departLeadMin
  return {
    gateId: gate.id,
    gateName: gate.name,
    date: ymd,
    hwTime: hwChoice.time,
    hwMin: hwChoice.hwMin,
    turnMin,
    arriveMin,
    departMin,
    coeff: hwChoice.coeff,
    regime: hwChoice.regime,
    indicative: true,
  }
}

/**
 * Score a window for daylight-southbound suitability (higher = better). The UI
 * uses this to flag the recommended HW but always shows BOTH options — it never
 * silently picks one.
 */
export function suitabilityScore(win: GateWindow): number {
  let s = 0
  if (win.turnMin >= DAY_START && win.turnMin <= DAY_END) s += 2
  const dep = win.departMin ?? win.arriveMin
  if (dep >= DAY_START - 60 && dep <= DAY_END) s += 1
  return s
}

export function isInTable(ymd: string): boolean {
  const k = dateKey(ymd)
  return k >= dateKey(TABLE_RANGE.first) && k <= dateKey(TABLE_RANGE.last)
}
