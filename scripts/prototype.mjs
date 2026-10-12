// Carrega a lógica do protótipo (design_handoff_gutenberg/design/Gutenberg.dc.html) num sandbox,
// para servir de oráculo: tudo entre o início do <script data-dc-script> e `class Component`.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const HTML = fileURLToPath(new URL('../design_handoff_gutenberg/design/Gutenberg.dc.html', import.meta.url))

export function loadPrototype() {
  const html = readFileSync(HTML, 'utf8')
  const start = html.indexOf('>', html.indexOf('<script type="text/x-dc" data-dc-script')) + 1
  const end = html.indexOf('class Component', start)
  if (start <= 0 || end < 0) throw new Error('Não achei o script do protótipo em Gutenberg.dc.html')
  const src = html.slice(start, end) + '\n;({ autobreak, split, BOOKS, COLS, LIB0 })'
  return vm.runInNewContext(src, {})
}
