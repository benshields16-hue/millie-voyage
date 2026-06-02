import { el } from './dom'
import { CAVEATS } from '../tide/caveats'

/** Persistent honesty banner — shown wherever computed/planning data appears. */
export function disclaimer(text: string = CAVEATS.notAuthority): HTMLElement {
  return el('p', { class: 'banner', role: 'note' }, '⚠︎ ', text)
}

export function chip(label: string, kind?: string): HTMLElement {
  return el('span', { class: kind ? `chip chip--${kind}` : 'chip' }, label)
}

/** Small fixed bar offering a reload when a new service worker is waiting. */
export function showUpdatePill(onReload: () => void): void {
  if (document.querySelector('.updatebar')) return
  const bar = el(
    'div',
    { class: 'updatebar' },
    el('span', null, 'Update ready'),
    el('button', { class: 'btn btn--small', onClick: onReload }, 'Reload'),
  )
  document.body.append(bar)
}
