import { el } from './dom'
import { store } from '../state/appState'
import { LEGS } from '../data/legs'
import { deriveProgress, type Progress } from '../state/derive'
import { greatCircle } from '../sources/geo'
import { positionService } from '../sources/positionService'
import type { Fix } from '../sources/types'

function fmtLatLon(lat: number, lon: number): string {
  const la = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`
  return `${la}, ${lo}`
}

export function renderTracker(): HTMLElement {
  const s = store.get()
  const prog = deriveProgress(s.now, s.fix, s.manualLegOverride)
  const view = el('div', { class: 'view' })

  view.append(progressStrip(prog))
  view.append(positionService.isStarted() ? positionCard(s.fix, prog) : startCard())
  view.append(manualLegCard(prog.legIndex))
  if (positionService.isStarted() && !s.fix) view.append(manualPosCard())

  return view
}

function progressStrip(prog: Progress): HTMLElement {
  return el(
    'section',
    { class: 'card' },
    el('div', { class: 'summary__label' }, `On leg ${prog.leg.num} of ${LEGS.length}`),
    el('div', { class: 'summary__leg' }, el('strong', null, prog.leg.from), ' → ', el('strong', null, prog.leg.to)),
    el('div', { class: 'muted small' }, `${prog.milesDone.toFixed(0)} / ${(prog.milesDone + prog.milesRemaining).toFixed(0)} NM · ${prog.percent.toFixed(0)}% complete`),
  )
}

function startCard(): HTMLElement {
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Live tracking'),
    el(
      'p',
      { class: 'muted' },
      'Uses your device GPS while the app is open with the screen on. Keep the phone plugged in on passage — iOS pauses tracking when the screen locks, so expect gaps otherwise.',
    ),
    el('button', { class: 'btn', type: 'button', onClick: () => positionService.start() }, 'Start GPS tracking'),
  )
}

function positionCard(fix: Fix | null, prog: Progress): HTMLElement {
  if (!fix) {
    return el('section', { class: 'card' }, el('h2', null, 'Live position'), el('p', { class: 'muted' }, 'Acquiring GPS fix…'))
  }
  const gc = greatCircle(fix, prog.leg.toCoord)
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Live position'),
    el('div', { class: 'bignum' }, fmtLatLon(fix.lat, fix.lon)),
    el(
      'div',
      { class: 'metrics' },
      metric(fix.sog != null ? fix.sog.toFixed(1) : '—', 'kn SOG'),
      metric(fix.cog != null ? `${fix.cog}°` : '—', 'COG'),
      metric(fix.accuracy != null ? `±${Math.round(fix.accuracy)} m` : '—', 'accuracy'),
    ),
    el('div', { class: 'wpt' }, `Next: ${prog.leg.to} — ${gc.bearing}° · ${gc.nm} NM`),
    el('p', { class: 'foot' }, `Source: ${fix.source.toUpperCase()} · fix ${new Date(fix.ts).toLocaleTimeString('en-GB')}`),
  )
}

function metric(value: string, label: string): HTMLElement {
  return el('div', { class: 'metric' }, el('div', { class: 'metric__v' }, value), el('div', { class: 'metric__l' }, label))
}

function manualLegCard(currentIndex: number): HTMLElement {
  const override = store.get().manualLegOverride
  const sel = el(
    'select',
    {
      class: 'sel',
      'aria-label': 'current leg',
      onChange: (e: Event) => {
        const v = (e.target as HTMLSelectElement).value
        store.set({ manualLegOverride: v === 'auto' ? null : Number(v) })
      },
    },
    el('option', { value: 'auto', selected: override == null ? 'selected' : null }, 'Auto (GPS / date)'),
    ...LEGS.map((l, i) =>
      el('option', { value: String(i), selected: override === i ? 'selected' : null }, `Leg ${l.num}: ${l.from} → ${l.to}`),
    ),
  )
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Current leg'),
    el('p', { class: 'subhead' }, currentIndex >= 0 ? 'Override which leg you’re on if GPS or date is wrong.' : ''),
    el('div', { class: 'field' }, sel),
  )
}

function manualPosCard(): HTMLElement {
  const latIn = el('input', { class: 'numin wide', type: 'number', step: '0.0001', placeholder: 'lat', inputmode: 'decimal' })
  const lonIn = el('input', { class: 'numin wide', type: 'number', step: '0.0001', placeholder: 'lon (W −)', inputmode: 'decimal' })
  const btn = el(
    'button',
    {
      class: 'btn',
      type: 'button',
      onClick: () => {
        const la = parseFloat(latIn.value)
        const lo = parseFloat(lonIn.value)
        if (!Number.isNaN(la) && !Number.isNaN(lo)) positionService.setManual(la, lo)
      },
    },
    'Set position',
  )
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Manual position'),
    el('p', { class: 'subhead' }, 'GPS unavailable — enter a position by hand (decimal degrees; west is negative).'),
    el('div', { class: 'wind-inputs' }, el('div', { class: 'field' }, el('label', null, 'Lat'), latIn), el('div', { class: 'field' }, el('label', null, 'Lon'), lonIn)),
    btn,
  )
}
