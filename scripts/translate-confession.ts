// npm run translate:confession -- --file data/sources/wcf.html [--id wcf] [--all-chapters] [--out data/canonical]
// Translates the Westminster Confession page (IP Aliança) into data/canonical/confessions/<id>.json.
// By default only chapters 1–33 (the IPB text); --all-chapters keeps the extra chapters some
// editions add (34 "Do Espírito Santo", 35 "Do Amor de Deus e das Missões").
import { readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { DEFAULT_COLLECTIONS } from '../src/shared/collections'
import type { Confession } from '../src/shared/data-model'
import { REQUIRED } from '../src/shared/requirements'
import { validateConfession } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import { htmlToLines, parseConfessionLines } from './lib/translate/confession'

const args = parseArgs()
if (typeof args.file !== 'string') {
  console.error('usage: npm run translate:confession -- --file <page.html> [--id wcf] [--all-chapters] [--out data/canonical]')
  process.exit(1)
}
const id = typeof args.id === 'string' ? args.id : 'wcf'
const file = resolve(args.file)
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:confession: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}
const meta = DEFAULT_COLLECTIONS.find((c) => c.kind === 'confession' && c.id === id)
if (!meta) {
  console.error(`translate:confession: unknown confession id ${id}`)
  process.exit(1)
}

const parsed = parseConfessionLines(htmlToLines(readFileSync(file, 'utf8')))
const keep = args['all-chapters'] ? parsed.chapters.length : REQUIRED.confession.sections.length
const skipped = parsed.chapters.slice(keep)
const doc: Confession = {
  format: 1,
  id,
  title: 'Confissão de Fé de Westminster',
  shortTitle: meta.shortTitle,
  prefix: meta.prefix,
  chapters: parsed.chapters.slice(0, keep),
  source: { name: 'ipalianca', id: basename(file) }
}

const problems = validateConfession(doc, id)
REQUIRED.confession.sections.forEach((n, i) => {
  const got = doc.chapters[i]?.sections.length ?? 0
  if (got !== n) problems.push(`chapter ${i + 1}: ${got} of ${n} sections`)
})
if (problems.length > 0) {
  console.error(`translate:confession: ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

const out = join(outRoot, 'confessions', `${id}.json`)
writeJson(out, doc)
const sections = doc.chapters.reduce((n, c) => n + c.sections.length, 0)
console.log(`translate:confession: ${id} → ${out} (${doc.chapters.length} chapters, ${sections} sections)`)
for (const c of skipped) console.log(`  skipped chapter ${c.id} "${c.title}" (use --all-chapters to keep it)`)
for (const n of parsed.notes.filter((n) => !skipped.some((c) => n.startsWith(`chapter ${c.id}:`)))) console.log(`  note: ${n}`)
