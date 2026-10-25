// Loads the prototype's logic (design/proposals/v1/design/Gutenberg.dc.html) in a sandbox
// to serve as a test oracle: everything between <script data-dc-script> and `class Component`.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const HTML = fileURLToPath(new URL('../design/proposals/v1/design/Gutenberg.dc.html', import.meta.url))

export function loadPrototype() {
  const html = readFileSync(HTML, 'utf8')
  const start = html.indexOf('>', html.indexOf('<script type="text/x-dc" data-dc-script')) + 1
  const end = html.indexOf('class Component', start)
  if (start <= 0 || end < 0) throw new Error('Prototype script not found in Gutenberg.dc.html')
  const src = html.slice(start, end) + '\n;({ autobreak, split, BOOKS, COLS, LIB0, CH, CFW_S, CFW_T, CAT_N, booksFor, parseBible })'
  return vm.runInNewContext(src, {})
}
