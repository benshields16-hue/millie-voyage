import './styles.css'
import { store } from './state/appState'
import { applyTheme } from './theme'
import { mountShell } from './ui/shell'
import { showUpdatePill } from './ui/components'
import { positionService } from './sources/positionService'
import { persist } from './state/persist'

const root = document.querySelector<HTMLDivElement>('#app')
if (root) {
  applyTheme(store.get().theme)

  // Optional local persistence (OFF by default). Hydrate before first render so
  // marked-done legs / notes / checklist appear immediately if remembered.
  if (persist.enabled()) {
    const p = persist.load()
    store.set({ persistOn: true, markedDone: p.markedDone ?? [], notes: p.notes ?? {}, checklist: p.checklist ?? {} })
  }

  mountShell(root)

  // Resolved position + honest connection status flow into the store, which the
  // planner (progress) and tracker both read. Throttled to ~3 s inside the service.
  positionService.subscribe((snap) => store.set({ fix: snap.fix, conn: snap.conn }))

  // Save only the persisted slices, and only when they actually change.
  let lastSaved = ''
  store.subscribe((s) => {
    if (!s.persistOn) return
    const blob = JSON.stringify({ markedDone: s.markedDone, notes: s.notes, checklist: s.checklist })
    if (blob !== lastSaved) {
      lastSaved = blob
      persist.save({ markedDone: s.markedDone, notes: s.notes, checklist: s.checklist })
    }
  })

  // Tick "now" each minute so date-based derivation and countdowns stay current.
  setInterval(() => store.set({ now: new Date() }), 60_000)

  // Service worker: production only, with an explicit "update ready" prompt so an
  // offline skipper is never force-reloaded mid-passage.
  if (import.meta.env.PROD) {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          onNeedRefresh() {
            showUpdatePill(() => void updateSW(true))
          },
        })
      })
      .catch(() => {
        /* PWA registration unavailable — core still works */
      })
  }
}
