// npm run holyrics:dump [-- --url http://192.168.0.10:8091 --token … --out data/sources/holyrics-songs.json]
// Downloads every song (with lyrics and credits) through the Holyrics local API into a raw dump.
// Needs only network access to the Holyrics PC — not the unlocked repository.
// Defaults come from HOLYRICS_API_URL / HOLYRICS_API_TOKEN (environment or .env).
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from './lib/args'
import { writeJson } from './lib/canonical'
import { dumpSongs, holyricsClient, type HolyricsDump } from './lib/holyrics-api'

const ROOT = join(import.meta.dirname, '..')
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'))
const args = parseArgs()
const url = typeof args.url === 'string' ? args.url : process.env.HOLYRICS_API_URL
const token = typeof args.token === 'string' ? args.token : process.env.HOLYRICS_API_TOKEN
const out = typeof args.out === 'string' ? resolve(args.out) : join(ROOT, 'data', 'sources', 'holyrics-songs.json')
if (!url || !token) {
  console.error('holyrics:dump: set HOLYRICS_API_URL and HOLYRICS_API_TOKEN (.env) or pass --url and --token')
  process.exit(1)
}

const songs = await dumpSongs(holyricsClient(url, token), (done, total) => {
  if (done === total || done % 25 === 0) console.log(`  ${done}/${total}`)
})
const dump: HolyricsDump = { format: 1, dumpedAt: new Date().toISOString(), source: url, songs }
writeJson(out, dump)
const archived = songs.filter((s) => s.archived).length
console.log(`holyrics:dump: ${songs.length} songs (${archived} archived) → ${out}`)
