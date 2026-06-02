// Unified position arbiter. Sources feed fixes; the highest-priority source that
// is currently FRESH wins (Signal K > GPS > manual), so a source that goes silent
// is aged out automatically and the next one takes over with no explicit
// disconnect event. The UI consumes the resolved fix + an honest status; it never
// knows which source produced the fix.

import type { Fix, PositionSourceId } from './types'
import { startGps, type GpsState } from './gpsSource'

export type Tone = 'offline' | 'online' | 'boat' | 'warn' | 'manual'
export interface ConnStatus {
  label: string
  tone: Tone
}
export interface PosSnapshot {
  fix: Fix | null
  conn: ConnStatus
}

const STALE_MS: Record<PositionSourceId, number> = { signalk: 8000, gps: 15000, manual: Infinity }
const PRIORITY: Record<PositionSourceId, number> = { signalk: 3, gps: 2, manual: 1 }

const latest: Record<PositionSourceId, Fix | null> = { signalk: null, gps: null, manual: null }
let gpsState: GpsState = 'off'
let started = false

const subs = new Set<(s: PosSnapshot) => void>()
let lastFix: Fix | null | undefined
let lastLabel = ''

function isFresh(id: PositionSourceId): boolean {
  const f = latest[id]
  return !!f && Date.now() - f.ts < STALE_MS[id]
}

function activeFix(): Fix | null {
  const ids = (Object.keys(PRIORITY) as PositionSourceId[]).filter(isFresh).sort((a, b) => PRIORITY[b] - PRIORITY[a])
  const top = ids[0]
  return top ? latest[top] : null
}

function status(): ConnStatus {
  const online = navigator.onLine
  const fix = activeFix()
  if (fix?.source === 'signalk') return { label: '● Boat data (Signal K)', tone: 'boat' }
  if (fix?.source === 'manual') return { label: '⌖ Manual position', tone: 'manual' }
  if (fix?.source === 'gps') {
    return online ? { label: '● GPS · online', tone: 'online' } : { label: '○ GPS · offline · core', tone: 'offline' }
  }
  if (gpsState === 'denied') return { label: '⚠ No GPS — enter position', tone: 'warn' }
  if (gpsState === 'searching') return { label: '◌ GPS searching…', tone: 'warn' }
  if (gpsState === 'paused') return { label: '⏸ GPS paused (screen off)', tone: 'warn' }
  return online ? { label: '○ Online · core only', tone: 'offline' } : { label: '○ Offline · core only', tone: 'offline' }
}

function emit(): void {
  const fix = activeFix()
  const conn = status()
  if (fix === lastFix && conn.label === lastLabel) return // throttle: only notify on real change
  lastFix = fix
  lastLabel = conn.label
  const snap: PosSnapshot = { fix, conn }
  for (const fn of subs) fn(snap)
}

export const positionService = {
  subscribe(fn: (s: PosSnapshot) => void): () => void {
    subs.add(fn)
    fn({ fix: activeFix(), conn: status() })
    return () => {
      subs.delete(fn)
    }
  },

  isStarted: (): boolean => started,

  /** Begin device GPS (call from a user gesture so the iOS permission prompt is expected). */
  start(): void {
    if (started) return
    started = true
    startGps({
      onFix: (f) => {
        latest.gps = f // updated silently; the 3 s tick emits, throttling UI churn
      },
      onState: (st) => {
        if (st !== gpsState) {
          gpsState = st
          emit()
        }
      },
    })
    window.addEventListener('online', emit)
    window.addEventListener('offline', emit)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && gpsState === 'live') {
        gpsState = 'paused'
        emit()
      } else if (document.visibilityState === 'visible' && gpsState === 'paused') {
        gpsState = 'searching'
        emit()
      }
    })
    setInterval(emit, 3000) // re-evaluate freshness + push latest fix at a calm cadence
  },

  setManual(lat: number, lon: number): void {
    latest.manual = { lat, lon, ts: Date.now(), source: 'manual', accuracy: null, sog: null, cog: null }
    emit()
  },

  clearManual(): void {
    latest.manual = null
    emit()
  },
}
