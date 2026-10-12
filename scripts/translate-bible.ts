// npm run translate:bible -- --file data/sources/ARA.sqlite [--code ARA] [--out data/canonical]
// Translates an OpenLP Bible database into data/canonical/bible/<code>/.
import { rmSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { validateBibleBook, validateBibleMeta } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import { translateOpenLpBible } from './lib/translate/openlp'

const args = parseArgs()
if (typeof args.file !== 'string') {
  console.error('usage: npm run translate:bible -- --file <openlp.sqlite> [--code ARA] [--out data/canonical]')
  process.exit(1)
}
const file = resolve(args.file)
const code = typeof args.code === 'string' ? args.code : 'ARA'
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:bible: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}

const db = new DatabaseSync(file, { readOnly: true })
const { meta, books, notes } = translateOpenLpBible(db, code, `${basename(file)}`)
db.close()

const problems = [...validateBibleMeta(meta), ...books.flatMap((b) => validateBibleBook(b, b.book))]
if (problems.length > 0) {
  console.error(`translate:bible: ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

const out = join(outRoot, 'bible', code.toLowerCase())
rmSync(out, { recursive: true, force: true })
writeJson(join(out, 'meta.json'), meta)
for (const b of books) writeJson(join(out, `${String(b.order).padStart(2, '0')}-${b.book}.json`), b)

const verses = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0)
const chapters = books.reduce((n, b) => n + b.chapters.length, 0)
console.log(`translate:bible: ${code} → ${out}`)
console.log(`  ${books.length} books · ${chapters} chapters · ${verses} verses`)
for (const n of notes) console.log(`  note: ${n}`)
