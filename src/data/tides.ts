// SHOM HW Brest reference data, June 2026 (the real planning reference).
// Times are LOCAL CEST (Europe/Paris, UTC+2 in June — no DST transition in-window).
// Stored as naive { date, time } strings and treated as wall-clock.
//
// Modelled as a FLAT LIST OF HW EVENTS, not per-day [hw1, hw2]: the single-HW
// days (e.g. Tue 9 Jun) are not missing data — their partner HW falls on an
// adjacent calendar day (~12h25 apart). A flat list dissolves the single-vs-double
// problem; "HWs on date D" is just a filter.

export type Regime = 'neap' | 'neap-min' | 'building' | 'to-springs' | 'springs'

export interface HwEvent {
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM' local CEST
  coeff: number // SHOM tidal coefficient (~20–120) for this tide
  regime: Regime
}

export const HW_BREST: readonly HwEvent[] = [
  { date: '2026-06-07', time: '10:13', coeff: 50, regime: 'neap' },
  { date: '2026-06-07', time: '22:42', coeff: 48, regime: 'neap' },
  { date: '2026-06-08', time: '11:12', coeff: 47, regime: 'neap-min' },
  { date: '2026-06-08', time: '23:44', coeff: 47, regime: 'neap-min' },
  { date: '2026-06-09', time: '12:17', coeff: 47, regime: 'neap-min' },
  { date: '2026-06-10', time: '00:48', coeff: 49, regime: 'building' },
  { date: '2026-06-10', time: '13:22', coeff: 52, regime: 'building' },
  { date: '2026-06-11', time: '01:52', coeff: 55, regime: 'building' },
  { date: '2026-06-11', time: '14:24', coeff: 60, regime: 'building' },
  { date: '2026-06-12', time: '02:53', coeff: 64, regime: 'building' },
  { date: '2026-06-12', time: '15:23', coeff: 69, regime: 'building' },
  { date: '2026-06-13', time: '03:52', coeff: 74, regime: 'to-springs' },
  { date: '2026-06-13', time: '16:19', coeff: 79, regime: 'to-springs' },
  { date: '2026-06-14', time: '04:48', coeff: 83, regime: 'springs' },
  { date: '2026-06-14', time: '17:12', coeff: 87, regime: 'springs' },
  { date: '2026-06-15', time: '05:42', coeff: 90, regime: 'springs' },
  { date: '2026-06-15', time: '18:03', coeff: 93, regime: 'springs' },
]

export const TABLE_RANGE = { first: '2026-06-07', last: '2026-06-15' } as const

// Used ONLY for the live "minutes until departure" countdown (the gate math
// itself is offset-free). Valid only within this voyage window — revisit if the
// table is ever extended past the 25 Oct 2026 DST fall-back.
export const CEST_OFFSET_MIN = 120
