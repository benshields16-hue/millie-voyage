// Voyage legs and waypoints. Distances/times are approximate planning figures
// at 5 kn (editable). Coordinates are decimal degrees, longitude NEGATIVE for west.
//
// Coordinates are OpenStreetMap-sourced (single-source), sanity-checked against
// known light positions for the two gate marks. They are WAYPOINT-GRADE for this
// planning aid only — feeding bearing/distance, progress and the shared-track map,
// never presented as a navigational authority. Verify against the chart / Bloc
// Marine before relying on them.

import type { GateId } from './gates'

export interface Coord {
  lat: number
  lon: number
}

export interface Marina {
  name: string
  vhf?: string
  notes?: string
}

export interface Leg {
  id: string
  num: number
  from: string
  to: string
  fromCoord: Coord
  toCoord: Coord
  distanceNm: number
  estHoursMin: number
  estHoursMax: number
  constraint: string
  gate: GateId | null
  marina?: Marina
  hazards: string[]
  notes?: string
  plannedDate?: string // 'YYYY-MM-DD', optional — weather-dependent, may be unset
}

/** Each port defined once; legs reference these so a coordinate is fixed in one place. */
export const PORTS = {
  'Perros-Guirec': { lat: 48.8045, lon: -3.4406 }, // Bassin du Linkin approach
  Roscoff: { lat: 48.7217, lon: -3.9691 }, // Port de Bloscon
  "L'Aber Wrac'h": { lat: 48.5995, lon: -4.5605 },
  Brest: { lat: 48.379, lon: -4.4894 }, // Marina du Château
  Camaret: { lat: 48.2751, lon: -4.5912 }, // Port Vauban
  Audierne: { lat: 48.012, lon: -4.557 }, // Sainte-Évette moorings (not the drying town quay)
  'Bénodet': { lat: 47.874, lon: -4.104 }, // Penfoul marina, Odet mouth
  Concarneau: { lat: 47.8703, lon: -3.9149 },
  'Belle-Île': { lat: 47.3523, lon: -3.1568 }, // Le Palais
} satisfies Record<string, Coord>

/** Gate marks — the point you aim to be off at the stream turn. */
export const GATE_MARKS = {
  four: { name: 'Le Four lighthouse', lat: 48.5232, lon: -4.8052 },
  raz: { name: 'La Vieille lighthouse', lat: 48.0407, lon: -4.7564 },
} satisfies Record<GateId, { name: string } & Coord>

export const LEGS: Leg[] = [
  {
    id: '1', num: 1, from: 'Perros-Guirec', to: 'Roscoff',
    fromCoord: PORTS['Perros-Guirec'], toCoord: PORTS.Roscoff,
    distanceNm: 25, estHoursMin: 5, estHoursMax: 5,
    constraint: 'Coastal stream; weather-dependent', gate: null,
    marina: { name: 'Roscoff — Port de Bloscon', vhf: 'Ch 9', notes: 'Deep-water marina E of the old town' },
    hazards: ['Plateau de la Méloine', 'Les Sept-Îles approaches', 'Rock-strewn coast — keep to buoyed channels'],
  },
  {
    id: '2', num: 2, from: 'Roscoff', to: "L'Aber Wrac'h",
    fromCoord: PORTS.Roscoff, toCoord: PORTS["L'Aber Wrac'h"],
    distanceNm: 38, estHoursMin: 6, estHoursMax: 7.5,
    constraint: 'W-going stream from ~HW Brest +0530', gate: null,
    marina: { name: "L'Aber Wrac'h marina", vhf: 'Ch 9', notes: 'Visitor pontoons; staging port for the Four' },
    hazards: ['Île de Batz', 'Roches de Portsall', 'Libenter shoal at the Aber entrance'],
  },
  {
    id: '3', num: 3, from: "L'Aber Wrac'h", to: 'Brest',
    fromCoord: PORTS["L'Aber Wrac'h"], toCoord: PORTS.Brest,
    distanceNm: 30, estHoursMin: 8, estHoursMax: 8,
    constraint: 'Chenal du Four — tide-critical', gate: 'four',
    marina: { name: 'Marina du Château, Brest', vhf: 'Ch 9', notes: 'City centre; port of entry' },
    hazards: ['Grande Vinotière (mid-channel)', 'Les Plâtresses', 'Sea fog (brume de mer)'],
    notes: 'Transit on Saint-Mathieu / Kermorvan in line. Carry the south-going stream from the turn.',
  },
  {
    id: '4', num: 4, from: 'Brest', to: 'Camaret',
    fromCoord: PORTS.Brest, toCoord: PORTS.Camaret,
    distanceNm: 12, estHoursMin: 2.5, estHoursMax: 2.5,
    constraint: 'Goulet de Brest streams to ~4–5 kn', gate: null,
    marina: { name: 'Camaret — Port Vauban', vhf: 'Ch 9', notes: 'Marina under the Tour Vauban' },
    hazards: ['Goulet de Brest tidal streams', 'Pointe du Petit Minou', 'Roches du Mengant'],
  },
  {
    id: '5', num: 5, from: 'Camaret', to: 'Audierne',
    fromCoord: PORTS.Camaret, toCoord: PORTS.Audierne,
    distanceNm: 25, estHoursMin: 5, estHoursMax: 5,
    constraint: 'Raz de Sein — tide-critical', gate: 'raz',
    marina: { name: 'Audierne — Sainte-Évette', vhf: 'Ch 9', notes: 'Moorings/anchorage outside the drying river' },
    hazards: ['Chaussée de Sein', 'La Plate', 'Tournant overfalls at the Raz'],
    notes: 'Aim to reach La Vieille 15–30 min before the turn, via the La Vieille / La Plate channel.',
  },
  {
    id: '6', num: 6, from: 'Audierne', to: 'Bénodet',
    fromCoord: PORTS.Audierne, toCoord: PORTS['Bénodet'],
    distanceNm: 30, estHoursMin: 6, estHoursMax: 6,
    constraint: 'Penmarch swell; give 2–3 NM offing', gate: null,
    marina: { name: 'Bénodet marina (Odet)', vhf: 'Ch 9', notes: 'At the mouth of the Odet' },
    hazards: ["Pointe de Penmarc'h swell", 'Les Étocs', 'Inshore rocks off the Pays Bigouden'],
  },
  {
    id: '7', num: 7, from: 'Bénodet', to: 'Concarneau',
    fromCoord: PORTS['Bénodet'], toCoord: PORTS.Concarneau,
    distanceNm: 20, estHoursMin: 4, estHoursMax: 4,
    constraint: 'Via Glénan — ZMEL, no anchoring on seagrass', gate: null,
    marina: { name: 'Concarneau — Port de plaisance', vhf: 'Ch 9', notes: 'Marina by the Ville Close' },
    hazards: ['Les Glénan reefs', 'Seagrass ZMEL (use mooring buoys)', 'Îles de Glénan approaches'],
  },
  {
    id: '8', num: 8, from: 'Concarneau', to: 'Belle-Île',
    fromCoord: PORTS.Concarneau, toCoord: PORTS['Belle-Île'],
    distanceNm: 30, estHoursMin: 6, estHoursMax: 6,
    constraint: 'Open-water passage', gate: null,
    marina: { name: 'Belle-Île — Le Palais', vhf: 'Ch 9', notes: 'Main harbour; can be busy in season' },
    hazards: ['Open-water passage — exposure to swell', 'Plateau des Birvideaux', 'Le Palais entrance in fresh onshore winds'],
  },
]

export const TOTAL_NM = LEGS.reduce((s, l) => s + l.distanceNm, 0)
