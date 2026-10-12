// npm run data:build [-- --dir data/canonical --out data/build/gutenberg.sqlite]
// Validates data/canonical/ and builds the app's SQLite database from it.
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fillDatabase } from '../src/main/db/build'
import { migrate } from '../src/main/db/schema'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, loadCanonical } from './lib/canonical'

const args = parseArgs()
const dir = typeof args.dir === 'string' ? resolve(args.dir) : DEFAULT_CANONICAL_DIR
const out = typeof args.out === 'string' ? resolve(args.out) : join(import.meta.dirname, '..', 'data', 'build', 'gutenberg.sqlite')

const { data, problems } = loadCanonical(dir)
if (problems.length > 0) {
  console.error(`data:build: ${problems.length} problem(s) in ${dir}:`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

mkdirSync(dirname(out), { recursive: true })
rmSync(out, { force: true })
const db = new DatabaseSync(out)
db.exec('PRAGMA foreign_keys = ON')
migrate(db)
const counts = fillDatabase(db, data)
db.close()
console.log(`data:build: ${out}`)
console.log(
  `  verses ${counts.verses} · songs ${counts.songs} · confession sections ${counts.confessionSections} · ` +
    `catechism questions ${counts.catechismQuestions} · creeds ${counts.creeds}`
)
