import { el } from './dom'
import { store } from '../state/appState'
import { deriveProgress, type Progress } from '../state/derive'
import { REFERENCE, CHECKLIST } from '../data/reference'
import { persist } from '../state/persist'

export function renderReference(): HTMLElement {
  const s = store.get()
  const prog = deriveProgress(s.now, s.fix, s.manualLegOverride)
  return el(
    'div',
    { class: 'view' },
    checklistCard(prog),
    ...REFERENCE.map(refSection),
    settingsCard(s.persistOn),
  )
}

function checklistCard(prog: Progress): HTMLElement {
  const legId = prog.leg.id
  const state = store.get().checklist[legId] ?? {}
  const done = Object.values(state).filter(Boolean).length
  const items = CHECKLIST.map((label, idx) => {
    const key = String(idx)
    const checked = !!state[key]
    return el(
      'label',
      { class: 'check' },
      el('input', {
        type: 'checkbox',
        checked: checked ? 'checked' : null,
        onChange: () =>
          store.set((st) => ({
            checklist: { ...st.checklist, [legId]: { ...(st.checklist[legId] ?? {}), [key]: !checked } },
          })),
      }),
      el('span', null, label),
    )
  })
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Pre-passage checklist'),
    el('p', { class: 'subhead' }, `Leg ${prog.leg.num}: ${prog.leg.from} → ${prog.leg.to} · ${done}/${CHECKLIST.length} done`),
    el('div', { class: 'checklist' }, ...items),
  )
}

function refSection(sec: (typeof REFERENCE)[number]): HTMLElement {
  return el(
    'section',
    { class: 'card' },
    el('h2', null, sec.title),
    el(
      'div',
      { class: 'reflist' },
      ...sec.entries.map((e) =>
        el(
          'div',
          { class: 'refrow' },
          el('span', { class: 'refrow__k' }, e.label),
          el('span', { class: 'refrow__v' }, e.value, e.note ? el('span', { class: 'muted small block' }, e.note) : null),
        ),
      ),
    ),
  )
}

function settingsCard(on: boolean): HTMLElement {
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'On this device'),
    el(
      'label',
      { class: 'check' },
      el('input', {
        type: 'checkbox',
        checked: on ? 'checked' : null,
        onChange: (e: Event) => {
          const v = (e.target as HTMLInputElement).checked
          persist.setEnabled(v)
          store.set({ persistOn: v })
        },
      }),
      el('span', null, 'Remember marked-done legs, notes & checklist on this device'),
    ),
    el('p', { class: 'foot' }, 'Local only — never synced. Default is stateless: progress is derived from date & position.'),
  )
}
