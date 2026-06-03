// The single in-memory app-state object + store singleton. Stateless by default:
// nothing here is persisted unless the optional persistence layer is switched on.

import { createStore } from './store'
import type { Fix } from '../sources/types'
import type { GateId, CompassPoint } from '../data/gates'
import type { ConnStatus } from '../sources/positionService'
import type { WxSnapshot } from '../sources/wx'
import type { ShareState } from '../sources/shareTrack'

export type Tab = 'plan' | 'track' | 'tides' | 'ref'
export type Theme = 'day' | 'night'

export interface AppState {
  tab: Tab
  theme: Theme
  now: Date
  fix: Fix | null
  conn: ConnStatus
  manualLegOverride: number | null
  expandedLeg: string | null
  gateId: GateId // gate selected in the Tides tab
  gateDate: string // 'YYYY-MM-DD' selected in the gate calculator
  windDir: CompassPoint // wind direction the crew observes/forecasts (blows FROM)
  windForce: number // Beaufort
  windSource: 'manual' | 'live' // 'live' = auto-fill from Open-Meteo; any manual edit pins 'manual'
  wx: WxSnapshot | null // last-known live forecast snapshot (null until first fetch)
  razPassageH: number | null // optional passage time to the Raz (no published lead)
  // Optional, local-only (persisted only when persistOn):
  markedDone: string[] // leg ids manually marked done
  notes: Record<string, string> // leg id -> free-text log
  checklist: Record<string, Record<string, boolean>> // leg id -> item index -> checked
  persistOn: boolean
  shareStatus: ShareState // live-track sharing status (Tier 1b), reflected in the Reference tab
}

export const store = createStore<AppState>({
  tab: 'plan',
  theme: 'day',
  now: new Date(),
  fix: null,
  conn: { label: '○ Core only', tone: 'offline' },
  manualLegOverride: null,
  expandedLeg: null,
  gateId: 'four',
  gateDate: '2026-06-08',
  windDir: 'NW',
  windForce: 3,
  windSource: 'live',
  wx: null,
  razPassageH: null,
  markedDone: [],
  notes: {},
  checklist: {},
  persistOn: false,
  shareStatus: 'off',
})
