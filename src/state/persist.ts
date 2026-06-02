// OPTIONAL, OFF BY DEFAULT. The app is stateless unless the user flips the
// "remember on this device" switch. Even then this is purely a local convenience
// (marked-done legs, per-leg notes, pre-passage checklist) — never synced between
// devices. The default path never touches localStorage.

const KEY = 'millie.local.v1'
const ON = KEY + '.on'

export interface Persisted {
  markedDone: string[]
  notes: Record<string, string>
  checklist: Record<string, Record<string, boolean>>
}

export const persist = {
  enabled(): boolean {
    try {
      return localStorage.getItem(ON) === '1'
    } catch {
      return false
    }
  },

  setEnabled(on: boolean): void {
    try {
      if (on) localStorage.setItem(ON, '1')
      else {
        localStorage.removeItem(ON)
        localStorage.removeItem(KEY)
      }
    } catch {
      /* private mode / quota — silently stays stateless */
    }
  },

  load(): Partial<Persisted> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Persisted>
    } catch {
      return {}
    }
  },

  save(data: Persisted): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* ignore quota errors */
    }
  },
}
