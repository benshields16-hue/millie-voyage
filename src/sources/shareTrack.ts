// Opt-in live-position sharing (Tier 1b). Mirrors persist.ts: OFF by default, localStorage-
// backed, every call try/caught so it can NEVER throw into the position pipeline or block the
// offline core. POSTs the latest fix to the home-PC backend on a slow cadence; buffers fixes
// while offline and backfills them as a batch on reconnect, so the family trail has no gaps.

import type { Fix } from './types'
import { positionService } from './positionService'

const CFG_KEY = 'millie.share.cfg.v1'
const QUEUE_KEY = 'millie.share.queue.v1'
const SEND_INTERVAL_MS = 30_000 // light on a cellular link; independent of the 3 s position tick
const MIN_MOVE_M = 15 // skip near-duplicate fixes
const QUEUE_CAP = 2000 // bounded ring buffer — a long blackout can't grow it without limit
const BATCH_MAX = 500 // matches the server's per-request cap

export interface ShareConfig {
  baseUrl: string
  ingestToken: string
  enabled: boolean
}
export type ShareState = 'off' | 'sharing' | 'paused' | 'error'

/* ── Pure helpers (unit-tested) ─────────────────────────────────────────────── */

/** Rough metres between two fixes (equirectangular; plenty accurate at these scales). */
export function roughMetres(a: Fix, b: Fix): number {
  const R = 6_371_000
  const x = (((b.lon - a.lon) * Math.PI) / 180) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const y = ((b.lat - a.lat) * Math.PI) / 180
  return Math.sqrt(x * x + y * y) * R
}

/** Is `fix` due to be enqueued, given the last one we took and the cadence? Pure. */
export function shouldSend(last: Fix | null, fix: Fix | null, now: number, minIntervalMs: number): boolean {
  if (!fix) return false
  if (!last) return true
  if (now - last.ts < minIntervalMs) return false
  // Moved enough, OR a long stationary gap (a keepalive so "last updated" doesn't rot).
  return roughMetres(last, fix) >= MIN_MOVE_M || now - last.ts >= minIntervalMs * 4
}

/** Append to a bounded ring buffer, dropping the oldest on overflow. Pure (returns a new array). */
export function enqueue(buf: Fix[], fix: Fix, cap = QUEUE_CAP): Fix[] {
  const next = buf.length >= cap ? buf.slice(buf.length - cap + 1) : buf.slice()
  next.push(fix)
  return next
}

/** Take up to `max` from the front for a batch POST. Pure → { batch, rest }. */
export function drainBatch(buf: Fix[], max = BATCH_MAX): { batch: Fix[]; rest: Fix[] } {
  return { batch: buf.slice(0, max), rest: buf.slice(max) }
}

/* ── Stateful module (browser-only) ─────────────────────────────────────────── */

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* private mode / quota — sharing simply stays in-memory this session */
  }
}

let cfg: ShareConfig = { baseUrl: '', ingestToken: '', enabled: false, ...readJson<Partial<ShareConfig>>(CFG_KEY, {}) }
let queue: Fix[] = readJson<Fix[]>(QUEUE_KEY, [])
let latestFix: Fix | null = null
let lastTaken: Fix | null = null
let state: ShareState = cfg.enabled ? 'sharing' : 'off'
let lastError = ''
let started = false
let flushing = false

const stateSubs = new Set<(s: ShareState) => void>()
function setState(s: ShareState): void {
  if (s === state) return
  state = s
  for (const fn of stateSubs) fn(s)
}
function idleState(): ShareState {
  return !cfg.enabled ? 'off' : navigator.onLine ? 'sharing' : 'paused'
}
function persistQueue(): void {
  queue = queue.slice(-QUEUE_CAP)
  writeJson(QUEUE_KEY, queue)
}

async function flush(): Promise<void> {
  if (flushing || !cfg.enabled) return
  // Enqueue the latest fix if the cadence says it's due.
  if (latestFix && shouldSend(lastTaken, latestFix, Date.now(), SEND_INTERVAL_MS)) {
    queue = enqueue(queue, latestFix)
    lastTaken = latestFix
    persistQueue()
  }
  if (!queue.length || !cfg.baseUrl || !cfg.ingestToken) {
    setState(idleState())
    return
  }
  if (!navigator.onLine) {
    setState('paused')
    return
  }

  flushing = true
  try {
    const { batch, rest } = drainBatch(queue)
    const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.ingestToken}` },
      body: JSON.stringify({ fixes: batch }),
    })
    if (!res.ok) throw new Error('http ' + res.status)
    queue = rest // only drop what the server accepted
    persistQueue()
    lastError = ''
    setState('sharing')
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'send failed'
    setState('error') // keep the queue and retry next tick — never throw
  } finally {
    flushing = false
  }
}

export const shareTrack = {
  config(): ShareConfig {
    return { ...cfg }
  },
  setConfig(patch: Partial<ShareConfig>): void {
    cfg = { ...cfg, ...patch }
    writeJson(CFG_KEY, cfg)
    if (cfg.enabled && !started) shareTrack.start()
    setState(idleState())
    if (cfg.enabled) void flush()
  },
  status(): ShareState {
    return state
  },
  queued(): number {
    return queue.length
  },
  errorText(): string {
    return lastError
  },
  subscribeStatus(fn: (s: ShareState) => void): () => void {
    stateSubs.add(fn)
    fn(state)
    return () => {
      stateSubs.delete(fn)
    }
  },
  start(): void {
    if (started) return
    started = true
    positionService.subscribe((snap) => {
      if (snap.fix) latestFix = snap.fix
    })
    setInterval(() => void flush(), SEND_INTERVAL_MS)
    window.addEventListener('online', () => void flush())
    window.addEventListener('offline', () => setState('paused'))
  },
}
