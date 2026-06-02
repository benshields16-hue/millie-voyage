import { el } from './dom'
import { LEGS } from '../data/legs'
import { store } from '../state/appState'
import { deriveProgress, type Progress, type ProgressSource } from '../state/derive'
import { legCard, legStatus } from './legCard'

export function renderPlanner(): HTMLElement {
  const s = store.get()
  const prog = deriveProgress(s.now, s.fix, s.manualLegOverride)
  return el('div', { class: 'view' }, whereAreWe(prog), legList(prog.legIndex, s.expandedLeg))
}

function whereAreWe(prog: Progress): HTMLElement {
  const leg = prog.leg
  const arrived = prog.percent >= 100
  return el(
    'section',
    { class: 'summary' },
    el('div', { class: 'summary__label' }, 'Where are we'),
    el('div', { class: 'summary__leg' }, el('strong', null, leg.from), ' → ', el('strong', null, leg.to)),
    el('div', { class: 'summary__next' }, arrived ? 'Voyage complete' : `Next port: ${leg.to}`),
    progressBar(prog.percent),
    el(
      'div',
      { class: 'summary__stats' },
      stat(prog.milesDone.toFixed(0), 'NM done'),
      stat(prog.milesRemaining.toFixed(0), 'NM to go'),
      stat(`${prog.percent.toFixed(0)}%`, 'complete'),
    ),
    el('div', { class: 'summary__src muted small' }, sourceNote(prog.source)),
  )
}

function stat(value: string, label: string): HTMLElement {
  return el('div', { class: 'stat' }, el('div', { class: 'stat__v' }, value), el('div', { class: 'stat__l' }, label))
}

function progressBar(pct: number): HTMLElement {
  return el(
    'div',
    { class: 'progress', role: 'progressbar', 'aria-valuenow': String(Math.round(pct)) },
    el('div', { class: 'progress__bar', style: { width: `${pct}%` } }),
  )
}

function sourceNote(src: ProgressSource): string {
  switch (src) {
    case 'position':
      return 'Current leg from GPS position'
    case 'override':
      return 'Current leg set manually'
    case 'date':
      return 'Estimated from today’s date'
    case 'start':
      return 'Start of voyage — set your leg in Track'
  }
}

function legList(currentIndex: number, expandedId: string | null): HTMLElement {
  const done = new Set(store.get().markedDone)
  const list = el('div', { class: 'legs' })
  for (const leg of LEGS) list.append(legCard(leg, legStatus(leg, currentIndex, done), expandedId === leg.id))
  return list
}
