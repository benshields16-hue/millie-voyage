import { el, clear } from './dom'
import { store, type Tab } from '../state/appState'
import { applyTheme, toggleTheme } from '../theme'
import { renderPlanner } from './planner'
import { renderTides } from './tides'
import { renderTracker } from './tracker'
import { renderReference } from './reference'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'plan', label: 'Plan', icon: '⛵' },
  { id: 'track', label: 'Track', icon: '➤' },
  { id: 'tides', label: 'Tides', icon: '🌊' },
  { id: 'ref', label: 'Ref', icon: '☎' },
]

export function mountShell(root: HTMLElement): void {
  clear(root)

  const pill = el('button', {
    class: 'pill',
    type: 'button',
    title: 'Connection & data source — tap for the tracker',
    onClick: () => store.set({ tab: 'track' }),
  })
  const themeBtn = el('button', {
    class: 'iconbtn',
    type: 'button',
    'aria-label': 'Toggle night mode',
    onClick: () => store.set((s) => ({ theme: toggleTheme(s.theme) })),
  })

  const header = el(
    'header',
    { class: 'header' },
    el(
      'div',
      { class: 'header__title' },
      el('span', { class: 'header__boat' }, 'S/Y Millie'),
      el('span', { class: 'header__sub' }, 'Voyage planner'),
    ),
    el('div', { class: 'header__tools' }, pill, themeBtn),
  )

  const content = el('main', { class: 'content' })

  const tabbar = el(
    'nav',
    { class: 'tabbar', 'aria-label': 'Sections' },
    ...TABS.map((t) =>
      el(
        'button',
        { class: 'tab', type: 'button', dataset: { tab: t.id }, onClick: () => store.set({ tab: t.id }) },
        el('span', { class: 'tab__icon', 'aria-hidden': 'true' }, t.icon),
        el('span', { class: 'tab__label' }, t.label),
      ),
    ),
  )

  root.append(header, content, tabbar)

  let lastTab: Tab | null = null
  function render(): void {
    const s = store.get()
    applyTheme(s.theme)
    themeBtn.textContent = s.theme === 'day' ? '☾' : '☀'
    pill.textContent = s.conn.label
    pill.className = `pill pill--${s.conn.tone}`
    for (const tabEl of Array.from(tabbar.querySelectorAll('.tab'))) {
      tabEl.classList.toggle('tab--active', (tabEl as HTMLElement).dataset.tab === s.tab)
    }
    clear(content)
    content.append(viewFor(s.tab))
    if (s.tab !== lastTab) {
      content.scrollTop = 0 // reset scroll only on tab change, not on data ticks
      lastTab = s.tab
    }
  }

  store.subscribe(render)
  render()
}

function viewFor(tab: Tab): HTMLElement {
  switch (tab) {
    case 'plan':
      return renderPlanner()
    case 'tides':
      return renderTides()
    case 'track':
      return renderTracker()
    case 'ref':
      return renderReference()
  }
}
