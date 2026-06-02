// Contracts for the position/conditions data layer. The UI consumes the RESOLVED
// value and never knows or cares which source produced it.

export type PositionSourceId = 'signalk' | 'gps' | 'manual'

export interface Fix {
  lat: number
  lon: number
  sog?: number | null // speed over ground, knots
  cog?: number | null // course over ground, ° true
  heading?: number | null // ° (Signal K only; phone has none)
  accuracy?: number | null // metres (GPS); null = treat as good (Signal K)
  ts: number // epoch ms of the fix
  source: PositionSourceId
}

/** A Fix enriched with bearing/distance to the active waypoint. */
export interface NavFix extends Fix {
  brgToWpt: number | null
  distNmToWpt: number | null
  wptName: string | null
}

/** Live wind/sea snapshot handed to the wind go/no-go — plain data, no live-ness baked in. */
export interface Conditions {
  windDirFromDeg?: number | null
  windKn?: number | null
  gustKn?: number | null
  swellM?: number | null
  swellPeriodS?: number | null
  ts: number
  source: 'open-meteo'
}
