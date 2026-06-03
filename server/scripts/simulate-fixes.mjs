// Walks a fake boat down the route, POSTing fixes to /api/ingest — local end-to-end test
// without the real boat. Reads .env for INGEST_TOKEN + PORT.
//   node scripts/simulate-fixes.mjs          continuous (a fix every 2 s)
//   node scripts/simulate-fixes.mjs --once    post a single fix and exit

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const PORT = Number(process.env.PORT || 8787)
const TOKEN = process.env.INGEST_TOKEN || ''
const pts = JSON.parse(readFileSync(join(root, 'route-data.json'), 'utf8')).ports
const once = process.argv.includes('--once')

const lerp = (a, b, t) => a + (b - a) * t
function bearing(a, b) {
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180, Δλ = ((b.lon - a.lon) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return Math.round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360)
}

let seg = 0, t = 0
async function step() {
  const a = pts[seg], b = pts[seg + 1]
  const fix = { lat: lerp(a.lat, b.lat, t), lon: lerp(a.lon, b.lon, t), sog: 5, cog: bearing(a, b), ts: Date.now(), source: 'gps' }
  try {
    const res = await fetch(`http://localhost:${PORT}/api/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(fix),
    })
    console.log(res.status, `${fix.lat.toFixed(3)},${fix.lon.toFixed(3)}  cog ${fix.cog}  (${a.name} → ${b.name})`)
  } catch (e) {
    console.error('post failed:', e.message)
  }
  t += 0.1
  if (t >= 1) { t = 0; seg = (seg + 1) % (pts.length - 1) }
}

if (once) step()
else { step(); setInterval(step, 2000) }
