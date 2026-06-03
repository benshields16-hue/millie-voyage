import { el } from './dom'
import { store, type AppState } from '../state/appState'
import { GATES, type GateId, type CompassPoint, type Gate } from '../data/gates'
import { TABLE_RANGE } from '../data/tides'
import {
  hwEventsForDate,
  gateWindow,
  suitabilityScore,
  isInTable,
  type GateWindow,
  type HwChoice,
} from '../tide/gateCalc'
import { minToHm, roundToMin } from '../tide/timeMin'
import { coeffBand, coeffTimeline } from '../tide/coeffTimeline'
import { windVerdict, VERDICT, type Verdict } from '../tide/windGate'
import { liveWindForGate, liveWaveForGate, degToPoint, speedToBeaufort, type LiveWind } from '../sources/wx'
import { CAVEATS } from '../tide/caveats'
import { disclaimer } from './components'

const POINTS: CompassPoint[] = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

function fmtDayLabel(ymd: string): { dow: string; day: string } {
  const parts = ymd.split('-')
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) // numeric args = Safari-safe
  return { dow: dt.toLocaleDateString('en-GB', { weekday: 'short' }), day: String(Number(parts[2])) }
}

export function renderTides(): HTMLElement {
  const s = store.get()
  const gate = GATES[s.gateId]
  return el(
    'div',
    { class: 'view' },
    coeffCard(s.gateDate),
    gateCalcCard(gate, s.gateDate),
    windCard(s, gate),
    swellCard(s, gate),
  )
}

/* ── Coefficient timeline ─────────────────────────────────────────────────── */
function coeffCard(selected: string): HTMLElement {
  const cells = coeffTimeline().map((c) => {
    const lbl = fmtDayLabel(c.date)
    return el(
      'button',
      {
        class: `cell cell--${c.color}${c.date === selected ? ' cell--sel' : ''}`,
        type: 'button',
        title: `${c.date} · coeff ${c.coeffMin}–${c.coeffMax} · ${c.regime}`,
        onClick: () => store.set({ gateDate: c.date }),
      },
      el('span', { class: 'cell__co' }, String(c.coeffMax)),
      el('span', { class: 'cell__bar', style: { height: `${Math.round((c.coeffMax / 100) * 46) + 6}px` } }),
      el('span', { class: 'cell__d' }, lbl.dow),
      el('span', { class: 'cell__d' }, lbl.day),
      c.isGentlest ? el('span', { class: 'cell__star', title: 'gentlest for the gates' }, '★') : null,
    )
  })
  return el(
    'section',
    { class: 'card' },
    el('h2', null, 'Tide coefficients'),
    el('p', { class: 'subhead' }, 'Daily max · neap → spring · ★ gentlest for the gates. Tap a day to load it.'),
    el('div', { class: 'cells' }, ...cells),
  )
}

/* ── Gate calculator ──────────────────────────────────────────────────────── */
function gateCalcCard(gate: (typeof GATES)[GateId], date: string): HTMLElement {
  const card = el('section', { class: 'card' }, el('h2', null, 'Gate calculator'))

  // gate selector
  card.append(
    el(
      'div',
      { class: 'segmented' },
      ...(['four', 'raz'] as GateId[]).map((id) =>
        el(
          'button',
          { class: `seg${id === gate.id ? ' seg--on' : ''}`, type: 'button', onClick: () => store.set({ gateId: id }) },
          GATES[id].name,
        ),
      ),
    ),
    el('p', { class: 'subhead' }, `Aim for ${gate.gateMark} · transit: ${gate.transit}`),
  )

  // date picker (constrained to the SHOM table window — honest about data coverage)
  card.append(
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'gate-date' }, `Date (SHOM data ${TABLE_RANGE.first} → ${TABLE_RANGE.last})`),
      el('input', {
        id: 'gate-date',
        class: 'date',
        type: 'date',
        value: date,
        min: TABLE_RANGE.first,
        max: TABLE_RANGE.last,
        onChange: (e: Event) => store.set({ gateDate: (e.target as HTMLInputElement).value }),
      }),
    ),
    disclaimer(CAVEATS.streamOffset),
  )

  if (!isInTable(date)) {
    card.append(el('p', { class: 'banner' }, `No SHOM tide data for ${date}. The table covers ${TABLE_RANGE.first} to ${TABLE_RANGE.last}.`))
    return card
  }

  const choices = hwEventsForDate(date)
  if (choices.length === 0) {
    card.append(el('p', { class: 'muted' }, 'No high-water data for this date.'))
    return card
  }
  const scores = choices.map((c) => suitabilityScore(gateWindow(date, gate, c)))
  const best = Math.max(...scores)
  choices.forEach((c, i) => card.append(hwOption(gate, date, c, scores[i] === best && best > 0)))
  card.append(el('p', { class: 'foot' }, CAVEATS.rounding))
  return card
}

function hwOption(gate: (typeof GATES)[GateId], date: string, choice: HwChoice, recommended: boolean): HTMLElement {
  const w = gateWindow(date, gate, choice)
  const band = coeffBand(choice.coeff)
  const daylightTurn = w.turnMin >= 6 * 60 && w.turnMin <= 21 * 60 + 30
  return el(
    'div',
    { class: `gate-opt gate-opt--${band.color}` },
    el(
      'div',
      { class: 'gate-opt__head' },
      el('strong', null, `HW Brest ${choice.time}`),
      el('span', { class: `chip chip--${band.color}` }, `Coeff ${choice.coeff} · ${band.label}`),
      recommended ? el('span', { class: 'chip chip--current' }, 'Recommended') : null,
      !daylightTurn ? el('span', { class: 'chip' }, 'Night transit') : null,
    ),
    timeRow('Stream turn', minToHm(w.turnMin)),
    // For the Four you arrive AT the turn (arriveBeforeMin 0) — the turn row says it.
    // Only the Raz, with its 15–30 min lead, needs a distinct arrival row.
    gate.arriveBeforeMin > 0 ? timeRow('Arrive gate', minToHm(roundToMin(w.arriveMin, 5))) : null,
    w.departMin != null
      ? timeRow(`Depart ${gate.prevPort ?? 'previous port'}`, minToHm(roundToMin(w.departMin, 5)))
      : razDepartRow(w),
  )
}

function timeRow(k: string, v: string): HTMLElement {
  return el('div', { class: 'timerow' }, el('span', { class: 'timerow__k' }, k), el('span', { class: 'timerow__v' }, v))
}

function razDepartRow(w: GateWindow): HTMLElement {
  const h = store.get().razPassageH
  return el(
    'div',
    { class: 'timerow' },
    el('span', { class: 'timerow__k' }, 'Depart prev. port'),
    el(
      'span',
      { class: 'timerow__v' },
      el('input', {
        class: 'numin',
        type: 'number',
        min: '0',
        max: '12',
        step: '0.5',
        value: h == null ? '' : String(h),
        placeholder: 'h',
        'aria-label': 'passage time hours',
        onChange: (e: Event) => {
          const v = (e.target as HTMLInputElement).value
          store.set({ razPassageH: v === '' ? null : Number(v) })
        },
      }),
      h != null
        ? el('strong', null, ' → ' + minToHm(roundToMin(w.arriveMin - h * 60, 5)))
        : el('span', { class: 'muted small' }, ' enter passage time (not published for the Raz)'),
    ),
  )
}

/* ── Wind go/no-go ────────────────────────────────────────────────────────── */
const VERDICT_UI: Record<Verdict, { cls: string; label: string }> = {
  [VERDICT.CLEAR]: { cls: 'go', label: 'No flag' },
  [VERDICT.CAUTION]: { cls: 'caution', label: 'Caution' },
  [VERDICT.NOGO]: { cls: 'nogo', label: 'No-go' },
}

const WX_STALE_MS = 3 * 60 * 60_000

function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type WxTone = 'live' | 'stale' | 'offline'
function wxTone(wx: AppState['wx'], fetchedTs: number): WxTone {
  if (wx?.offline) return 'offline'
  if (Date.now() - fetchedTs > WX_STALE_MS) return 'stale'
  return 'live'
}
const TONE_DOT: Record<WxTone, string> = { live: '●', stale: '◐', offline: '○' }

/** Honest provenance line, e.g. "● Live · Open-Meteo · Le Four lighthouse · for Mon 8 ~10:42 · updated 09:14". */
function feedLine(label: string, gate: Gate, targetYmd: string, targetMin: number, wx: AppState['wx'], fetchedTs: number): HTMLElement {
  const tone = wxTone(wx, fetchedTs)
  const d = fmtDayLabel(targetYmd)
  const note = tone === 'offline' ? 'last forecast' : tone === 'stale' ? 'updated (stale)' : 'updated'
  return el(
    'p',
    { class: `src src--${tone}` },
    `${TONE_DOT[tone]} ${label} · ${gate.gateMark} · for ${d.dow} ${d.day} ~${minToHm(targetMin)} · ${note} ${fmtClock(fetchedTs)}`,
  )
}

function windCard(s: AppState, gate: Gate): HTMLElement {
  const live = s.windSource === 'live' ? liveWindForGate(s.wx, s.gateId, s.gateDate) : null
  const effDir: CompassPoint = live ? degToPoint(live.dirFromDeg) : s.windDir
  const effForce = live ? speedToBeaufort(live.kn) : s.windForce
  const r = windVerdict(gate, { dir: effDir, forceBft: effForce })
  const ui = VERDICT_UI[r.state]

  // Editing either control pins manual and snapshots the OTHER current value, so the
  // skipper's override starts from exactly what was on screen (live forecast or not).
  const dirSel = el(
    'select',
    {
      class: 'sel',
      'aria-label': 'wind direction',
      onChange: (e: Event) =>
        store.set({ windDir: (e.target as HTMLSelectElement).value as CompassPoint, windForce: effForce, windSource: 'manual' }),
    },
    ...POINTS.map((p) => el('option', { value: p, selected: p === effDir ? 'selected' : null }, p)),
  )
  const forceSel = el(
    'select',
    {
      class: 'sel',
      'aria-label': 'wind force',
      onChange: (e: Event) =>
        store.set({ windForce: Number((e.target as HTMLSelectElement).value), windDir: effDir, windSource: 'manual' }),
    },
    ...Array.from({ length: 13 }, (_, n) => el('option', { value: String(n), selected: n === effForce ? 'selected' : null }, `F${n}`)),
  )

  return el(
    'section',
    { class: 'card' },
    el('h2', null, `Wind go / no-go — ${gate.name}`),
    windProvenance(s, gate, live),
    el(
      'div',
      { class: 'wind-inputs' },
      el('div', { class: 'field' }, el('label', null, 'Wind from'), dirSel),
      el('div', { class: 'field' }, el('label', null, 'Force'), forceSel),
    ),
    el(
      'div',
      { class: `verdict verdict--${ui.cls}` },
      el('div', { class: 'verdict__state' }, ui.label),
      el('p', { class: 'verdict__head' }, r.headline),
      el('p', { class: 'verdict__rule' }, r.rule),
      el('p', { class: 'verdict__inputs' }, `Input: ${r.inputs.direction} F${effForce} · ${r.inputs.degFromFoul}° from ${r.inputs.nearestFoul}`),
      live
        ? el('p', { class: 'verdict__inputs' }, `Forecast: ${Math.round(live.kn)} kn${live.gustKn != null ? ` · gusts ${Math.round(live.gustKn)} kn` : ''}`)
        : null,
      el('p', { class: 'verdict__rule' }, '⚠︎ ' + r.caveat),
    ),
  )
}

function windProvenance(s: AppState, gate: Gate, live: LiveWind | null): HTMLElement {
  if (s.windSource === 'manual') {
    return el(
      'p',
      { class: 'src src--manual' },
      '⌖ Manual entry — ',
      el('button', { class: 'linkbtn', type: 'button', onClick: () => store.set({ windSource: 'live' }) }, 'use live forecast'),
    )
  }
  if (live) return feedLine('Live · Open-Meteo', gate, live.targetYmd, live.targetMin, s.wx, live.fetchedTs)
  const reason = s.wx == null ? 'loading…' : s.wx.offline ? 'offline — using last inputs' : 'beyond the forecast horizon'
  return el('p', { class: 'src src--offline' }, `○ Live forecast ${reason}. Edit below to assess manually.`)
}

function swellCard(s: AppState, gate: Gate): HTMLElement {
  const live = liveWaveForGate(s.wx, s.gateId, s.gateDate)
  let body: HTMLElement
  if (live) {
    body = el(
      'div',
      null,
      timeRow('Wave height', `${live.m.toFixed(1)} m`),
      live.periodS != null ? timeRow('Period', `${Math.round(live.periodS)} s`) : null,
      live.dirFromDeg != null ? timeRow('From', `${degToPoint(live.dirFromDeg)} · ${Math.round(live.dirFromDeg)}°`) : null,
    )
  } else {
    const reason = s.wx == null ? 'Loading…' : s.wx.offline ? 'Offline — no cached sea state yet.' : `No marine forecast for ${s.gateDate} (beyond horizon).`
    body = el('p', { class: 'muted small' }, reason)
  }
  return el(
    'section',
    { class: 'card' },
    el('h2', null, `Sea state — ${gate.name}`),
    live ? feedLine('Live · Open-Meteo Marine', gate, live.targetYmd, live.targetMin, s.wx, live.fetchedTs) : null,
    body,
    disclaimer(CAVEATS.forecast),
  )
}
