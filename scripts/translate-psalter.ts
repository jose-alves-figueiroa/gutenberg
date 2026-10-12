// npm run translate:psalter -- --file data/sources/psalter-letras.docx [--out data/canonical]
// Translates the Saltério de Genebra em Português lyrics (salteriodegenebra.com.br, CC0) into
// data/canonical/songbooks/psalter/.
import { rmSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { DEFAULT_COLLECTIONS } from '../src/shared/collections'
import type { Songbook } from '../src/shared/data-model'
import { validateSong, validateSongbook } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import { parsePsalter, readDocxParagraphs } from './lib/translate/psalter'

const args = parseArgs()
if (typeof args.file !== 'string') {
  console.error('usage: npm run translate:psalter -- --file <letras.docx> [--out data/canonical]')
  process.exit(1)
}
const file = resolve(args.file)
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:psalter: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}

const { songs, notes } = parsePsalter(readDocxParagraphs(file))
const meta = DEFAULT_COLLECTIONS.find((c) => c.id === 'psalter')!
const songbook: Songbook = {
  format: 1,
  id: 'psalter',
  title: meta.title,
  shortTitle: meta.shortTitle,
  prefix: meta.prefix,
  itemLabel: 'Salmo',
  source: { name: 'salteriodegenebra', id: basename(file) }
}
const problems = [...validateSongbook(songbook), ...songs.flatMap((s) => validateSong(s, s.title))]
if (problems.length > 0) {
  console.error(`translate:psalter: ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

const base = join(outRoot, 'songbooks', 'psalter')
rmSync(base, { recursive: true, force: true })
writeJson(join(base, 'songbook.json'), songbook)
for (const s of songs) writeJson(join(base, 'songs', `${s.id.slice('psalter-'.length)}.json`), s)
console.log(`translate:psalter: ${songs.length} songs → ${base}`)
for (const n of notes) console.log(`  note: ${n}`)
