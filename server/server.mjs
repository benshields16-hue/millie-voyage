// Shared read-only live-track backend (Tier 1b). Dependency-free Node: built-ins only.
// The boat's phone POSTs fixes (bearer INGEST_TOKEN); family open /t/<VIEW_TOKEN> to watch.
// Storage is an in-memory trail + an append-only NDJSON log for crash recovery — robust on
// an unattended home PC with no native builds. Offline behaviour is implicit: no new fixes
// arrive, so the page just shows the last known position with its (ageing) timestamp.

import { createServer } from 'node:http'
import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeEqual, bearerToken } from './lib/auth.mjs'
import { fixesFromBody, trimTrail } from './lib/trail.mjs'
import { buildPage } from './lib/page.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Minimal .env loader (no dependency) ──
function loadEnv() {
  const p = join(__dirname, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const INGEST_TOKEN = process.env.INGEST_TOKEN || ''
const VIEW_TOKEN = process.env.VIEW_TOKEN || ''
const PORT = Number(process.env.PORT || 8787)
const RETENTION_MS = Number(process.env.RETENTION_HOURS || 36) * 3600_000
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*'
const MAX_BODY = 256 * 1024

if (!INGEST_TOKEN || !VIEW_TOKEN) {
  console.error('FATAL: set INGEST_TOKEN and VIEW_TOKEN (copy .env.example → .env).')
  process.exit(1)
}

// ── Storage: in-memory trail + append-only NDJSON for crash recovery ──
const DATA_DIR = join(__dirname, 'data')
const LOG = join(DATA_DIR, 'track.ndjson')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

function loadTrail() {
  if (!existsSync(LOG)) return []
  const rows = []
  for (const line of readFileSync(LOG, 'utf8').split('\n')) {
    if (!line) continue
    try { rows.push(JSON.parse(line)) } catch { /* skip a torn final line */ }
  }
  return trimTrail(rows, Date.now(), RETENTION_MS)
}
let trail = loadTrail()

let sinceCompaction = 0
function persist(fixes) {
  appendFileSync(LOG, fixes.map((f) => JSON.stringify(f)).join('\n') + '\n')
  if ((sinceCompaction += fixes.length) >= 200) compact()
}
function compact() {
  sinceCompaction = 0
  const tmp = LOG + '.tmp'
  writeFileSync(tmp, trail.length ? trail.map((f) => JSON.stringify(f)).join('\n') + '\n' : '')
  renameSync(tmp, LOG) // atomic replace, drops aged-out rows from disk
}

const route = JSON.parse(readFileSync(join(__dirname, 'route-data.json'), 'utf8'))

// ── HTTP helpers ──
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'cache-control': 'no-store', ...headers })
  res.end(body)
}
function sendJson(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), { 'content-type': 'application/json; charset=utf-8', ...headers })
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0
    const chunks = []
    req.on('data', (c) => {
      if ((n += c.length) > MAX_BODY) { reject(new Error('body too large')); req.destroy() } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    return send(res, 204, '', {
      'access-control-allow-origin': ALLOW_ORIGIN,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': '86400',
    })
  }

  if (req.method === 'GET' && path === '/healthz') {
    const last = trail[trail.length - 1]
    return sendJson(res, 200, { ok: true, count: trail.length, lastFixAgeSec: last ? Math.round((Date.now() - last.ts) / 1000) : null })
  }

  // Ingest (boat → server). Bearer ingest token required; CORS for the PWA origin.
  if (req.method === 'POST' && path === '/api/ingest') {
    const cors = { 'access-control-allow-origin': ALLOW_ORIGIN }
    if (!safeEqual(bearerToken(req.headers['authorization']), INGEST_TOKEN)) {
      return sendJson(res, 401, { ok: false, error: 'bad token' }, cors)
    }
    let body
    try { body = JSON.parse((await readBody(req)) || 'null') } catch { return sendJson(res, 400, { ok: false, error: 'bad json' }, cors) }
    const fixes = fixesFromBody(body)
    if (fixes.length) {
      trail.push(...fixes)
      trail = trimTrail(trail, Date.now(), RETENTION_MS)
      persist(fixes)
    }
    return sendJson(res, 200, { ok: true, accepted: fixes.length }, cors)
  }

  // Read API (page → server). View token in the path; read-only.
  const apiMatch = /^\/api\/t\/([^/]+)\/track$/.exec(path)
  if (req.method === 'GET' && apiMatch) {
    if (!safeEqual(decodeURIComponent(apiMatch[1]), VIEW_TOKEN)) return sendJson(res, 404, { error: 'not found' })
    const sinceHours = Number(url.searchParams.get('sinceHours'))
    const cutoff = Number.isFinite(sinceHours) && sinceHours > 0 ? Date.now() - sinceHours * 3600_000 : 0
    const out = cutoff ? trail.filter((r) => r.ts >= cutoff) : trail
    return sendJson(res, 200, {
      latest: out[out.length - 1] ?? null,
      trail: out,
      serverTime: Date.now(),
      retentionHours: RETENTION_MS / 3600_000,
      route,
    })
  }

  // Public read-only page. View token in the path.
  const pageMatch = /^\/t\/([^/]+)\/?$/.exec(path)
  if (req.method === 'GET' && pageMatch) {
    if (!safeEqual(decodeURIComponent(pageMatch[1]), VIEW_TOKEN)) return send(res, 404, 'Not found', { 'content-type': 'text/plain' })
    return send(res, 200, buildPage(route), { 'content-type': 'text/html; charset=utf-8' })
  }

  send(res, 404, 'Not found', { 'content-type': 'text/plain' })
})

server.listen(PORT, () => console.log(`millie-track-server on http://localhost:${PORT}  (loaded ${trail.length} points, retention ${RETENTION_MS / 3600_000}h)`))
