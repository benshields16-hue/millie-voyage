// Live Open-Meteo wind/sea for the two tidal gates (Tier 1). Mirrors positionService:
// sources feed in, the UI consumes a resolved snapshot + an honest fresh/offline status.
// Degrades to last-known on ANY failure (offline, timeout, bad shape) — the offline core
// never depends on this. We fetch the forecast at each GATE mark (not the phone), because
// the go/no-go is about conditions at the gate at the transit hour, which is also what
// makes this useful for planning days ahead, not just at sea.

import type { GateId } from '../data/gates'
import { GATE_MARKS } from '../data/legs'
import { parseGateWx, type GateWx, type WxSnapshot } from './wx'

const REFRESH_MS = 15 * 60_000 // hourly forecast → no need to hammer
const FETCH_TIMEOUT_MS = 8000
const FORECAST_DAYS = 7 // cover the planned gate dates within the model horizon

const latest: Record<GateId, GateWx | null> = { four: null, raz: null }
let lastOkTs: number | null = null
let started = false

const subs = new Set<(s: WxSnapshot) => void>()
let lastSig = ''

function snapshot(): WxSnapshot {
  return { gates: { four: latest.four, raz: latest.raz }, offline: !navigator.onLine, lastOkTs }
}

function emit(): void {
  const snap = snapshot()
  const sig = `${snap.offline ? 1 : 0}|${latest.four?.fetchedTs ?? 0}|${latest.raz?.fetchedTs ?? 0}`
  if (sig === lastSig) return // only notify on a real change (offline flip or a fresh fetch)
  lastSig = sig
  for (const fn of subs) fn(snap)
}

function buildUrl(host: string, path: string, lat: number, lon: number, hourly: string): string {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly,
    timezone: 'Europe/Paris', // local-time axis matches the SHOM/gate convention
    forecast_days: String(FORECAST_DAYS),
  })
  if (host.startsWith('https://api')) p.set('wind_speed_unit', 'kn') // verdict thinks in knots
  return `${host}${path}?${p.toString()}`
}

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return res.ok ? ((await res.json()) as unknown) : null
  } catch {
    return null // offline / timeout / parse error → caller keeps last-known
  } finally {
    clearTimeout(timer)
  }
}

async function refreshGate(id: GateId): Promise<void> {
  const { lat, lon } = GATE_MARKS[id]
  const [forecast, marine] = await Promise.all([
    fetchJson(buildUrl('https://api.open-meteo.com', '/v1/forecast', lat, lon, 'wind_speed_10m,wind_gusts_10m,wind_direction_10m')),
    fetchJson(buildUrl('https://marine-api.open-meteo.com', '/v1/marine', lat, lon, 'wave_height,wave_period,wave_direction')),
  ])
  if (forecast == null && marine == null) return // total failure → keep last-known untouched
  latest[id] = parseGateWx(forecast, marine, Date.now())
  lastOkTs = Date.now()
}

async function refresh(): Promise<void> {
  await Promise.all((Object.keys(latest) as GateId[]).map(refreshGate))
  emit()
}

export const weatherSource = {
  subscribe(fn: (s: WxSnapshot) => void): () => void {
    subs.add(fn)
    fn(snapshot()) // emit current (possibly empty) immediately, like positionService
    return () => {
      subs.delete(fn)
    }
  },

  start(): void {
    if (started) return
    started = true
    void refresh()
    setInterval(() => void refresh(), REFRESH_MS)
    window.addEventListener('online', () => {
      emit() // flip the offline flag promptly…
      void refresh() // …then go get fresh data
    })
    window.addEventListener('offline', emit)
  },
}
