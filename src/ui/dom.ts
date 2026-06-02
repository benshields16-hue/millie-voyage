// Minimal DOM helper. `el('div', { class, onClick, ... }, ...children)` returns a
// real element. We build with text nodes (not innerHTML) so user-entered notes are
// never injected as HTML.

type Props = Record<string, unknown>
type Child = Node | string | number | null | undefined | false

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue
      if (k === 'class') node.className = String(v)
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v as Record<string, string>)
      else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v as Record<string, string>)
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
      else node.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue
    node.append(c instanceof Node ? c : String(c))
  }
  return node
}

export function clear(node: HTMLElement): void {
  node.replaceChildren()
}
