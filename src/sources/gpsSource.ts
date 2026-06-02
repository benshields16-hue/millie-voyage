// Tier 0 device GPS. watchPosition with high accuracy; drop poor fixes; lightly
// smooth DISPLAYED sog/cog (never raw lat/lon); hold a screen Wake Lock and
// re-acquire it when the app returns to the foreground (iOS releases it on
// background). iOS suspends JS when backgrounded/screen-locked — so this is
// foreground-only by nature; we surface that honestly rather than pretend.

import type { Fix } from './types'

export type GpsState = 'off' | 'searching' | 'live' | 'denied' | 'paused'

export interface GpsCallbacks {
  onFix: (fix: Fix) => void
  onState: (state: GpsState) => void
}

const ACCURACY_GATE_M = 50 // discard WiFi/cold-start garbage worse than this
const MS_TO_KN = 1.94384

let watchId: number | null = null
// release(): the WakeLockSentinel API; typed loosely to avoid lib-version drift.
let wakeLock: { release: () => Promise<void> } | null = null

async function acquireWake(): Promise<void> {
  try {
    const w = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<typeof wakeLock> } }).wakeLock
    if (w?.request) wakeLock = await w.request('screen')
  } catch {
    /* user gesture / low battery refusal — non-fatal, screen may sleep */
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') void acquireWake()
}

export function startGps(cb: GpsCallbacks): void {
  if (!('geolocation' in navigator)) {
    cb.onState('denied')
    return
  }
  cb.onState('searching')

  // light EMA on displayed values only; COG via circular mean so it survives 360°.
  const a = 0.4
  let sog: number | null = null
  let cs: number | null = null
  let sn: number | null = null

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const c = pos.coords
      if (c.accuracy != null && c.accuracy > ACCURACY_GATE_M) return // drop, stay live/searching

      const spdKn = c.speed != null && !Number.isNaN(c.speed) ? c.speed * MS_TO_KN : null
      sog = spdKn == null ? sog : sog == null ? spdKn : sog + a * (spdKn - sog)

      let cog: number | null = null
      if (c.heading != null && !Number.isNaN(c.heading) && (c.speed ?? 0) > 0.25) {
        const r = (c.heading * Math.PI) / 180
        cs = cs == null ? Math.cos(r) : cs + a * (Math.cos(r) - cs)
        sn = sn == null ? Math.sin(r) : sn + a * (Math.sin(r) - sn)
        cog = (((Math.atan2(sn, cs) * 180) / Math.PI) + 360) % 360
      }

      cb.onFix({
        lat: c.latitude,
        lon: c.longitude,
        sog: sog == null ? null : Math.round(sog * 10) / 10,
        cog: cog == null ? null : Math.round(cog),
        heading: null, // phone has no true-heading source
        accuracy: c.accuracy ?? null,
        ts: pos.timestamp,
        source: 'gps',
      })
      cb.onState('live')
    },
    (err) => {
      cb.onState(err.code === err.PERMISSION_DENIED ? 'denied' : 'searching')
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
  )

  void acquireWake()
  document.addEventListener('visibilitychange', onVisibility)
}

export function stopGps(): void {
  if (watchId != null) navigator.geolocation.clearWatch(watchId)
  watchId = null
  document.removeEventListener('visibilitychange', onVisibility)
  void wakeLock?.release()
  wakeLock = null
}
