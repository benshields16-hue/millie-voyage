// Comms & reference drawer — manual reference (no live feed). From the brief §6.

export interface RefEntry {
  label: string
  value: string
  note?: string
}

export interface RefSection {
  title: string
  entries: RefEntry[]
}

export const REFERENCE: RefSection[] = [
  {
    title: 'Distress & rescue',
    entries: [
      { label: 'CROSS Corsen (rescue coordination)', value: 'VHF Ch 16' },
      { label: 'From a French mobile', value: '196' },
      { label: 'General emergency', value: '112' },
    ],
  },
  {
    title: 'Broadcasts & warnings',
    entries: [
      { label: 'NAVTEX (Niton / Brest)', value: '518 kHz', note: 'Navigational + gale warnings' },
      { label: 'Météo-France — bulletin côtier', value: 'Finistère' },
      { label: 'Météo-France — bulletin large', value: 'Iroise / Manche-Ouest' },
    ],
  },
  {
    title: 'Almanac of record',
    entries: [
      { label: 'Tides, streams & pilotage', value: 'Bloc Marine Atlantique 2026' },
    ],
  },
]

/** Pre-passage checklist — resets per leg. */
export const CHECKLIST: string[] = [
  'Fresh forecast checked (Météo-France)',
  'Tide & gate timing computed',
  'Fuel & water',
  'Crew briefed',
  'Lifejackets / harnesses on',
  'Watch system set',
]
