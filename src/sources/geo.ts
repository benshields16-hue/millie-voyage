// Navigation geometry. Great-circle bearing/distance for waypoints, and a planar
// projection used to locate the boat along the route. Shared by derive.ts and the
// position service so the math lives in one place.

export interface LatLon {
  lat: number
  lon: number
}

const R_M = 6371000
const M_PER_NM = 1852
const toRad = (d: number): number => (d * Math.PI) / 180
const toDeg = (r: number): number => (r * 180) / Math.PI

/** Great-circle bearing (° true, rounded) and distance (NM, 2 dp) from a to b. */
export function greatCircle(a: LatLon, b: LatLon): { bearing: number; nm: number } {
  const p1 = toRad(a.lat)
  const p2 = toRad(b.lat)
  const dl = toRad(b.lon - a.lon)
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360
  const av =
    Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  const nm = (2 * R_M * Math.atan2(Math.sqrt(av), Math.sqrt(1 - av))) / M_PER_NM
  return { bearing: Math.round(bearing), nm: Math.round(nm * 100) / 100 }
}

export function distanceNm(a: LatLon, b: LatLon): number {
  return greatCircle(a, b).nm
}

/**
 * Project point p onto segment a→b using a local equirectangular approximation
 * (fine at coastal scale). Returns the clamped fraction along the segment [0,1]
 * and the perpendicular (cross-track) distance in NM.
 */
export function crossTrack(
  p: LatLon,
  a: LatLon,
  b: LatLon,
): { t: number; perpNm: number } {
  const latRef = toRad((a.lat + b.lat) / 2)
  const sx = (R_M / M_PER_NM) * Math.cos(latRef)
  const sy = R_M / M_PER_NM
  const ax = 0
  const ay = 0
  const bx = toRad(b.lon - a.lon) * sx
  const by = toRad(b.lat - a.lat) * sy
  const px = toRad(p.lon - a.lon) * sx
  const py = toRad(p.lat - a.lat) * sy
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2
  const t = len2 === 0 ? 0 : ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2
  const tc = Math.max(0, Math.min(1, t))
  const cx = ax + tc * (bx - ax)
  const cy = ay + tc * (by - ay)
  const perpNm = Math.hypot(px - cx, py - cy)
  return { t: tc, perpNm }
}
