// Pure helpers for the Open-Meteo (Tier 1) wind/sea feed: unit conversions and
// forecast lookups. DETERMINISTIC — no fetch, no DOM, no Date.now — so it unit-tests
// exactly like the gate math. The only Date used is the NUMERIC constructor in
// addDaysYmd (Safari-safe); we never parse a date STRING (see timeMin.ts for why).

import type { CompassPoint, GateId } from '../data/gates'
import { GATES } from '../data/gates'
import { hwEventsForDate, gateWindow, suitabilityScore } from '../tide/gateCalc'

/* ── Unit conversions ─────────────────────────────────────────────────────── */

// Beaufort force from sustained wind in KNOTS. F0 is < 1 kn; the rest by WMO upper
// bounds (F1 ≤3, F2 ≤6 … F11 ≤63, F12 ≥64). We request wind in kn from Open-Meteo so
// the verdict (which thinks in Beaufort) needs no further conversion.
const BFT_UPPER_KN = [3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63] // F1..F11 inclusive upper

export function speedToBeaufort(kn: number): number {
  if (!Number.isFinite(kn) || kn < 1) return 0
  for (let b = 0; b < BFT_UPPER_KN.length; b++) if (kn <= BFT_UPPER_KN[b]!) return b + 1
  return 12
}

const POINTS16: CompassPoint[] = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

/** Degrees (direction the wind blows FROM) → nearest 16-point compass, wrap-safe. */
export function degToPoint(deg: number): CompassPoint {
  if (!Number.isFinite(deg)) return 'N'
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16
  return POINTS16[i]!
}

/** 'YYYY-MM-DD' + whole days → 'YYYY-MM-DD'. Numeric Date constructor only (Safari-safe). */
export function addDaysYmd(ymd: string, days: number): string {
  const p = ymd.split('-')
  const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

/* ── Hourly forecast series ───────────────────────────────────────────────── */

/** Index-aligned hourly series at one gate location (one Open-Meteo fetch pair). */
export interface GateWx {
  windTimes: string[] // local ISO "YYYY-MM-DDTHH:00" (we request timezone=Europe/Paris)
  windKn: (number | null)[]
  gustKn: (number | null)[]
  windDirFromDeg: (number | null)[]
  waveTimes: string[] // marine horizon can be shorter → its own time axis
  waveM: (number | null)[]
  wavePeriodS: (number | null)[]
  waveDirFromDeg: (number | null)[]
  fetchedTs: number // epoch ms when fetched — drives "updated HH:MM" + staleness
}

export interface WxSnapshot {
  gates: Record<GateId, GateWx | null>
  offline: boolean
  lastOkTs: number | null
}

function hourlyOf(j: unknown): Record<string, unknown> | undefined {
  if (j && typeof j === 'object' && 'hourly' in j) {
    const h = (j as { hourly?: unknown }).hourly
    if (h && typeof h === 'object') return h as Record<string, unknown>
  }
  return undefined
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : []
}
function numArr(v: unknown): (number | null)[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : null)) : []
}

/** Build a GateWx from the (loosely-typed) Open-Meteo forecast + marine responses. */
export function parseGateWx(forecast: unknown, marine: unknown, fetchedTs: number): GateWx {
  const f = hourlyOf(forecast)
  const m = hourlyOf(marine)
  return {
    windTimes: strArr(f?.['time']),
    windKn: numArr(f?.['wind_speed_10m']),
    gustKn: numArr(f?.['wind_gusts_10m']),
    windDirFromDeg: numArr(f?.['wind_direction_10m']),
    waveTimes: strArr(m?.['time']),
    waveM: numArr(m?.['wave_height']),
    wavePeriodS: numArr(m?.['wave_period']),
    waveDirFromDeg: numArr(m?.['wave_direction']),
    fetchedTs,
  }
}

/**
 * Index of the hourly sample nearest `targetMinOfDay` on date `targetYmd`. Times are
 * local ISO strings; we string-slice HH:MM (never Date-parse). Returns -1 if the date
 * isn't covered (e.g. beyond the forecast horizon).
 */
export function pickHourIndex(times: readonly string[], targetMinOfDay: number, targetYmd: string): number {
  let best = -1
  let bestDelta = Infinity
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!
    if (t.slice(0, 10) !== targetYmd) continue
    const hh = Number(t.slice(11, 13))
    const mm = Number(t.slice(14, 16))
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue
    const delta = Math.abs(hh * 60 + mm - targetMinOfDay)
    if (delta < bestDelta) {
      bestDelta = delta
      best = i
    }
  }
  return best
}

export interface WindSample { dirFromDeg: number; kn: number; gustKn: number | null }
export interface WaveSample { m: number; periodS: number | null; dirFromDeg: number | null }

export function windAt(wx: GateWx, ymd: string, minOfDay: number): WindSample | null {
  const i = pickHourIndex(wx.windTimes, minOfDay, ymd)
  if (i < 0) return null
  const dir = wx.windDirFromDeg[i]
  const kn = wx.windKn[i]
  if (dir == null || kn == null) return null
  return { dirFromDeg: dir, kn, gustKn: wx.gustKn[i] ?? null }
}

export function waveAt(wx: GateWx, ymd: string, minOfDay: number): WaveSample | null {
  const i = pickHourIndex(wx.waveTimes, minOfDay, ymd)
  if (i < 0) return null
  const m = wx.waveM[i]
  if (m == null) return null
  return { m, periodS: wx.wavePeriodS[i] ?? null, dirFromDeg: wx.waveDirFromDeg[i] ?? null }
}

/* ── Gate-transit lookup ──────────────────────────────────────────────────── */

/** Recommended gate-transit moment (date + minute-of-day) for the selected gate/date. */
export function gateTargetTime(gateId: GateId, gateDate: string): { ymd: string; minOfDay: number } | null {
  const choices = hwEventsForDate(gateDate)
  if (choices.length === 0) return null
  const gate = GATES[gateId]
  let best = choices[0]!
  let bestScore = -1
  for (const c of choices) {
    const sc = suitabilityScore(gateWindow(gateDate, gate, c))
    if (sc > bestScore) {
      bestScore = sc
      best = c
    }
  }
  const turnMin = gateWindow(gateDate, gate, best).turnMin
  const day = Math.floor(turnMin / 1440)
  const minOfDay = ((turnMin % 1440) + 1440) % 1440
  return { ymd: day === 0 ? gateDate : addDaysYmd(gateDate, day), minOfDay }
}

export interface LiveWind extends WindSample { targetYmd: string; targetMin: number; fetchedTs: number }
export interface LiveWave extends WaveSample { targetYmd: string; targetMin: number; fetchedTs: number }

/** Live forecast wind at the selected gate, at its recommended transit hour. */
export function liveWindForGate(snap: WxSnapshot | null, gateId: GateId, gateDate: string): LiveWind | null {
  const wx = snap?.gates[gateId]
  if (!wx) return null
  const tgt = gateTargetTime(gateId, gateDate)
  if (!tgt) return null
  const s = windAt(wx, tgt.ymd, tgt.minOfDay)
  return s ? { ...s, targetYmd: tgt.ymd, targetMin: tgt.minOfDay, fetchedTs: wx.fetchedTs } : null
}

/** Live forecast sea state at the selected gate, at its recommended transit hour. */
export function liveWaveForGate(snap: WxSnapshot | null, gateId: GateId, gateDate: string): LiveWave | null {
  const wx = snap?.gates[gateId]
  if (!wx) return null
  const tgt = gateTargetTime(gateId, gateDate)
  if (!tgt) return null
  const s = waveAt(wx, tgt.ymd, tgt.minOfDay)
  return s ? { ...s, targetYmd: tgt.ymd, targetMin: tgt.minOfDay, fetchedTs: wx.fetchedTs } : null
}
