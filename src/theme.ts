import type { Theme } from './state/appState'

/** Apply the theme to <html> and sync the browser theme-color meta. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'night' ? '#000000' : '#0a2540')
}

export function toggleTheme(current: Theme): Theme {
  return current === 'day' ? 'night' : 'day'
}
