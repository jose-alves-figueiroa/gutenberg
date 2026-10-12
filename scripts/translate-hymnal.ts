// npm run translate:hymnal [-- --dir data/sources/hnc --out data/canonical]
// Translates the Hinário Novo Cântico XML files (npm run hymnal:fetch) into data/canonical/songbooks/hnc/.
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEFAULT_COLLECTIONS } from '../src/shared/collections'
import type { Song, Songbook } from '../src/shared/data-model'
import { validateSong, validateSongbook } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import { hymnOrder, parseHymnXml } from './lib/translate/hymnal'

const args = parseArgs()
const dir = typeof args.dir === 'string' ? resolve(args.dir) : join(import.meta.dirname, '..', 'data', 'sources', 'hnc')
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:hymnal: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}

const songs: Song[] = []
const notes: string[] = []
for (const f of readdirSync(dir).filter((f) => f.endsWith('.xml'))) {
  const parsed = parseHymnXml(readFileSync(join(dir, f), 'utf8'))
  songs.push(parsed.song)
  notes.push(...parsed.notes)
}
songs.sort(hymnOrder)

const meta = DEFAULT_COLLECTIONS.find((c) => c.id === 'hnc')!
const songbook: Songbook = {
  format: 1,
  id: 'hnc',
  title: meta.title,
  shortTitle: meta.shortTitle,
  prefix: meta.prefix,
  itemLabel: '',
  source: { name: 'novocantico', id: 'novocantico.com.br/hino' }
}
const problems = [...validateSongbook(songbook), ...songs.flatMap((s) => validateSong(s, `HNC ${s.number}`))]
if (problems.length > 0) {
  console.error(`translate:hymnal: ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

const base = join(outRoot, 'songbooks', 'hnc')
rmSync(base, { recursive: true, force: true })
writeJson(join(base, 'songbook.json'), songbook)
for (const s of songs) writeJson(join(base, 'songs', `${s.number.padStart(3, '0')}.json`), s)
const numbered = songs.filter((s) => /^\d+$/.test(s.number)).length
console.log(`translate:hymnal: ${songs.length} hymns (${numbered} numbered, ${songs.length - numbered} appendices) → ${base}`)
for (const n of notes) console.log(`  note: ${n}`)
