import { el } from './dom'
import { store } from '../state/appState'
import { deriveProgress, type Progress } from '../state/derive'
import { REFERENCE, CHECKLIST } from '../data/reference'
import { persist } from '../state/persist'
import { shareTrack, type ShareState } from '../sources/shareTrack'

export function renderReference(): HTMLElement {
  const s = store.get()
  const prog = deriveProgress(s.now, s.fix, s.manualLegOverride)
  return el(
    'div',
    { class: 'view' },
    checklistCard(prog),
    ...REFERENCE.map(refSection),
    settingsCard(s.persistOn),
    shareCard(s.shareStatus),
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

const SHARE_LABEL: Record<ShareState, string> = {
  off: 'Off',
  sharing: '● Sharing',
  paused: '⏸ Paused (offline) — will backfill on reconnect',
  error: '⚠ Send error — retrying',
}

function shareCard(status: ShareState): HTMLElement {
  const cfg = shareTrack.config()
  const queued = shareTrack.queued()
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Share live position'),
    el('p', { class: 'subhead' }, 'Send your position to your home server while online, for a read-only family link. Off by default.'),
    el(
      'label',
      { class: 'check' },
      el('input', {
        type: 'checkbox',
        checked: cfg.enabled ? 'checked' : null,
        onChange: (e: Event) => shareTrack.setConfig({ enabled: (e.target as HTMLInputElement).checked }),
      }),
      el('span', null, 'Share live position from this device'),
    ),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'share-url' }, 'Backend base URL'),
      el('input', {
        id: 'share-url',
        class: 'numin wide',
        type: 'url',
        inputmode: 'url',
        autocapitalize: 'off',
        spellcheck: 'false',
        placeholder: 'https://boat.example.com',
        value: cfg.baseUrl,
        onChange: (e: Event) => shareTrack.setConfig({ baseUrl: (e.target as HTMLInputElement).value.trim() }),
      }),
    ),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'share-tok' }, 'Ingest token'),
      el('input', {
        id: 'share-tok',
        class: 'numin wide',
        type: 'password',
        autocomplete: 'off',
        placeholder: 'paste the write token',
        value: cfg.ingestToken,
        onChange: (e: Event) => shareTrack.setConfig({ ingestToken: (e.target as HTMLInputElement).value.trim() }),
      }),
    ),
    el('p', { class: 'foot' }, `Status: ${SHARE_LABEL[status]}${queued ? ` · ${queued} queued` : ''}`),
    el(
      'p',
      { class: 'foot' },
      'The public family link is read-only and never contains this token. Keep the phone plugged in with the app open — iOS suspends background tabs.',
    ),
  )
}
