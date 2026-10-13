// Runs before `npm run dist:*`: the installer ships data/build/gutenberg.sqlite, so it must exist
// and come from the real data (`npm run data:unlock && npm run data:build`), not from a locked
// checkout or the test seed.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const FILE = join(fileURLToPath(new URL('..', import.meta.url)), 'data', 'build', 'gutenberg.sqlite')
/** The full ARA has 31,104 verses; the test seed has a handful. */
const MIN_VERSES = 31_000

function fail(msg) {
  console.error(`dist-check: ${msg}`)
  process.exit(1)
}

if (!existsSync(FILE)) fail(`${FILE} not found — run \`npm run data:unlock && npm run data:build\``)
const db = new DatabaseSync(FILE, { readOnly: true })
const verses = db.prepare('SELECT count(*) AS n FROM bible_verses').get().n
const version = db.prepare("SELECT value FROM settings WHERE key = 'content_version'").get()?.value
db.close()
if (verses < MIN_VERSES) fail(`only ${verses} Bible verses in ${FILE} — rebuild it from the unlocked data (npm run data:build)`)
if (!version) fail(`${FILE} has no content_version — rebuild it with this version of npm run data:build`)
console.log(`dist-check: ${FILE} (${verses} verses, content ${version})`)
