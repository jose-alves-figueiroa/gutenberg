// npm run translate:songs -- --file data/sources/holyrics-songs.json [--include-archived] [--out data/canonical]
// Translates a Holyrics API dump (npm run holyrics:dump) into data/canonical/songbooks/.
import { readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { REQUIRED } from '../src/shared/requirements'
import { validateSong, validateSongbook } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import type { HolyricsDump } from './lib/holyrics-api'
import { SONGBOOKS, translateHolyricsSongs } from './lib/translate/holyrics-songs'

const args = parseArgs()
if (typeof args.file !== 'string') {
  console.error('usage: npm run translate:songs -- --file data/sources/holyrics-songs.json [--include-archived] [--out data/canonical]')
  process.exit(1)
}
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:songs: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}

const dump = JSON.parse(readFileSync(resolve(args.file), 'utf8')) as HolyricsDump
const { songbooks, notes } = translateHolyricsSongs(dump.songs, { includeArchived: args['include-archived'] === true })
const problems = songbooks.flatMap(({ songbook, songs }) => [
  ...validateSongbook(songbook, songbook.id),
  ...songs.flatMap((s) => validateSong(s, `${songbook.id}/${s.id}`))
])
if (problems.length > 0) {
  console.error(`translate:songs: ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

for (const id of Object.keys(SONGBOOKS)) rmSync(join(outRoot, 'songbooks', id), { recursive: true, force: true })
for (const { songbook, songs } of songbooks) {
  const base = join(outRoot, 'songbooks', songbook.id)
  writeJson(join(base, 'songbook.json'), songbook)
  for (const s of songs) writeJson(join(base, 'songs', `${s.id.slice(songbook.id.length + 1)}.json`), s)
}

const total = songbooks.reduce((n, b) => n + b.songs.length, 0)
console.log(`translate:songs: ${total} songs (requirement: ${REQUIRED.songCount}) from ${dump.source} (${dump.dumpedAt})`)
for (const { songbook, songs } of songbooks) console.log(`  ${songbook.id}: ${songs.length}`)
const other = songbooks.find((b) => b.songbook.id === 'other')
if (other) {
  console.log('  review — songs not matched to HNC or the Psalter:')
  for (const s of other.songs) console.log(`    - ${s.title}${s.credits.artist ? ` (${s.credits.artist})` : ''}`)
}
for (const n of notes) console.log(`  note: ${n}`)
