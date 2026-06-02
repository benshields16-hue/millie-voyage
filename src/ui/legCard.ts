import { el } from './dom'
import { chip } from './components'
import type { Leg } from '../data/legs'
import { store } from '../state/appState'

export type LegStatus = 'done' | 'current' | 'upcoming' | 'hold'

export function legStatus(leg: Leg, currentIndex: number, doneIds?: Set<string>): LegStatus {
  if (doneIds?.has(leg.id)) return 'done'
  const i = leg.num - 1
  if (i < currentIndex) return 'done'
  if (i === currentIndex) return 'current'
  return 'upcoming'
}

const STATUS_LABEL: Record<LegStatus, string> = {
  done: 'Done',
  current: 'Current',
  upcoming: 'Upcoming',
  hold: 'Weather hold',
}

function fmtHours(leg: Leg): string {
  const f = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return leg.estHoursMin === leg.estHoursMax
    ? `~${f(leg.estHoursMin)} h`
    : `~${f(leg.estHoursMin)}–${f(leg.estHoursMax)} h`
}

export function legCard(leg: Leg, status: LegStatus, expanded: boolean): HTMLElement {
  const head = el(
    'button',
    {
      class: 'leg-card__head',
      'aria-expanded': String(expanded),
      onClick: () =>
        store.set((s) => ({ expandedLeg: s.expandedLeg === leg.id ? null : leg.id })),
    },
    el('span', { class: 'leg-card__num' }, String(leg.num)),
    el(
      'span',
      { class: 'leg-card__body' },
      el('span', { class: 'leg-card__route' }, el('strong', null, leg.from), ' → ', el('strong', null, leg.to)),
      el('span', { class: 'leg-card__meta' }, `${leg.distanceNm} NM · ${fmtHours(leg)}`),
      el(
        'span',
        { class: 'leg-card__chips' },
        chip(STATUS_LABEL[status], status),
        leg.gate ? chip('Tidal gate', 'gate') : null,
      ),
    ),
    el('span', { class: 'leg-card__chev', 'aria-hidden': 'true' }, expanded ? '▾' : '▸'),
  )

  const card = el('article', { class: `leg-card leg-card--${status}` }, head)
  if (expanded) card.append(legDetail(leg))
  return card
}

function legDetail(leg: Leg): HTMLElement {
  const d = el('div', { class: 'leg-card__detail' })
  d.append(el('p', { class: 'kv' }, el('span', { class: 'kv__k' }, 'Constraint'), el('span', null, leg.constraint)))

  if (leg.marina) {
    const m = leg.marina
    d.append(
      el(
        'p',
        { class: 'kv' },
        el('span', { class: 'kv__k' }, 'Marina'),
        el(
          'span',
          null,
          m.name,
          m.vhf ? el('span', { class: 'muted' }, ` · VHF ${m.vhf}`) : null,
          m.notes ? el('span', { class: 'muted small block' }, m.notes) : null,
        ),
      ),
    )
  }

  if (leg.hazards.length) {
    d.append(
      el('p', { class: 'lbl' }, 'Hazards'),
      el('ul', { class: 'hazards' }, ...leg.hazards.map((h) => el('li', null, h))),
    )
  }

  if (leg.notes) d.append(el('p', { class: 'muted note' }, leg.notes))

  if (leg.gate) {
    const gate = leg.gate
    d.append(
      el(
        'button',
        {
          class: 'btn btn--gate',
          onClick: () => store.set({ tab: 'tides', gateId: gate, expandedLeg: null }),
        },
        `Open ${gate === 'four' ? 'Chenal du Four' : 'Raz de Sein'} gate calculator →`,
      ),
    )
  }
  d.append(legLog(leg))
  return d
}

/** Per-leg mark-done + free-text log. Notes commit on blur (onChange) so typing
 *  never triggers a re-render that would steal focus. */
function legLog(leg: Leg): HTMLElement {
  const s = store.get()
  const done = s.markedDone.includes(leg.id)
  return el(
    'div',
    { class: 'leg-log' },
    el(
      'button',
      {
        class: `btn btn--ghost${done ? ' btn--ghost-on' : ''}`,
        type: 'button',
        onClick: () =>
          store.set((st) => ({
            markedDone: done ? st.markedDone.filter((x) => x !== leg.id) : [...st.markedDone, leg.id],
          })),
      },
      done ? '✓ Marked done — undo' : 'Mark leg done',
    ),
    el(
      'textarea',
      {
        class: 'notes',
        rows: '2',
        placeholder: 'Log / notes for this leg…',
        'aria-label': `notes for ${leg.from} to ${leg.to}`,
        onChange: (e: Event) => {
          const v = (e.target as HTMLTextAreaElement).value
          store.set((st) => ({ notes: { ...st.notes, [leg.id]: v } }))
        },
      },
      s.notes[leg.id] ?? '',
    ),
  )
}
