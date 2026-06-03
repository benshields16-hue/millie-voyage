// Pure helpers for the shared-track backend — no I/O, no globals — unit-tested with node:test.

/** A usable position fix? Defensive against malformed/hostile input. */
export function isValidFix(f) {
  return (
    !!f &&
    typeof f === 'object' &&
    Number.isFinite(f.lat) && f.lat >= -90 && f.lat <= 90 &&
    Number.isFinite(f.lon) && f.lon >= -180 && f.lon <= 180 &&
    Number.isFinite(f.ts)
  )
}

const num = (v) => (Number.isFinite(v) ? v : null)
const str = (v) => (typeof v === 'string' ? v.slice(0, 16) : null)

/** Normalise an incoming fix to the stored shape, dropping unknown/oversized fields. */
export function normaliseFix(f) {
  return {
    ts: f.ts,
    lat: f.lat,
    lon: f.lon,
    sog: num(f.sog),
    cog: num(f.cog),
    hdg: num(f.heading ?? f.hdg),
    acc: num(f.accuracy ?? f.acc),
    src: str(f.source ?? f.src),
  }
}

/** Extract valid, normalised fixes from a body that is either one fix or { fixes: [...] }. */
export function fixesFromBody(body, maxBatch = 500) {
  const arr = Array.isArray(body?.fixes) ? body.fixes : body ? [body] : []
  return arr.slice(0, maxBatch).filter(isValidFix).map(normaliseFix)
}

/** Drop points older than the retention window and cap total rows (keep newest). Pure. */
export function trimTrail(rows, nowMs, retentionMs, maxRows = 5000) {
  const cutoff = nowMs - retentionMs
  const kept = rows.filter((r) => r.ts >= cutoff)
  return kept.length > maxRows ? kept.slice(kept.length - maxRows) : kept
}
