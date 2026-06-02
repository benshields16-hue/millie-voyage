// Tidal-gate definitions. Stream-turn offsets are INDICATIVE planning figures
// (see `note`) and must be labelled as such wherever a computed time appears.

export type CompassPoint =
  | 'N' | 'NNE' | 'NE' | 'ENE' | 'E' | 'ESE' | 'SE' | 'SSE'
  | 'S' | 'SSW' | 'SW' | 'WSW' | 'W' | 'WNW' | 'NW' | 'NNW'

export type GateId = 'four' | 'raz'

export interface Gate {
  id: GateId
  name: string
  /** stream turn ≈ HW Brest + this (both gates: −30 min). */
  streamTurnOffsetMin: number
  /** reach the gate this many minutes BEFORE the turn (Four: 0 = at the turn; Raz: 20). */
  arriveBeforeMin: number
  /** passage time previous port → gate. Raz: null (not published — user enters it). */
  departLeadMin: number | null
  runHours?: number
  foulWinds: CompassPoint[]
  foulForceMin: number // Beaufort force at/above which a foul wind is a no-go
  prevPort?: string
  gateMark: string
  transit: string
  hazards: string[]
  bailout?: string
  note: string
}

export const GATES: Record<GateId, Gate> = {
  four: {
    id: 'four',
    name: 'Chenal du Four',
    streamTurnOffsetMin: -30,
    arriveBeforeMin: 0, // arrive AT the turn (off Le Four lighthouse)
    departLeadMin: 150, // depart L'Aber Wrac'h ~2.5 h before the turn
    runHours: 6,
    foulWinds: ['W', 'SW'],
    foulForceMin: 5,
    prevPort: "L'Aber Wrac'h",
    gateMark: 'Le Four lighthouse',
    transit: 'Saint-Mathieu / Kermorvan lights in line',
    hazards: ['Grande Vinotière (mid-channel)', 'Les Plâtresses', 'Sea fog (brume de mer)'],
    bailout: "wait at L'Aber Wrac'h for a fair tide and a better wind",
    note: 'Indicative — verify in Bloc Marine for the actual date.',
  },
  raz: {
    id: 'raz',
    name: 'Raz de Sein',
    streamTurnOffsetMin: -30,
    arriveBeforeMin: 20, // reach La Vieille 15–30 min before the turn
    departLeadMin: null, // passage time depends on start point/speed — user enters it
    foulWinds: ['SW'],
    foulForceMin: 5,
    gateMark: 'La Vieille lighthouse',
    transit: 'La Vieille / La Plate channel',
    hazards: ['Chaussée de Sein', 'La Plate', 'Tournant (overfalls)'],
    bailout: 'wait at Camaret, or go offshore W of the Chaussée de Sein (+~20 NM)',
    note: 'Indicative — verify in Bloc Marine for the actual date.',
  },
}
