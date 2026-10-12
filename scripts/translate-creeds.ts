// npm run translate:creeds -- --file data/sources/creeds.txt [--out data/canonical]
// Translates the hand-reviewed creeds text (format in scripts/lib/translate/creeds.ts) into
// data/canonical/creeds.json.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Creeds } from '../src/shared/data-model'
import { REQUIRED } from '../src/shared/requirements'
import { validateCreeds } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import { parseCreedsText } from './lib/translate/creeds'

const args = parseArgs()
if (typeof args.file !== 'string') {
  console.error('usage: npm run translate:creeds -- --file data/sources/creeds.txt [--out data/canonical]')
  process.exit(1)
}
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:creeds: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}

const creeds = parseCreedsText(readFileSync(resolve(args.file), 'utf8'))
const doc: Creeds = { format: 1, creeds, source: { name: 'manual' } }
const problems = validateCreeds(doc)
for (const id of REQUIRED.creeds) if (!creeds.some((c) => c.id === id)) problems.push(`missing creed ${id}`)
if (problems.length > 0) {
  console.error(`translate:creeds: ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
const out = join(outRoot, 'creeds.json')
writeJson(out, doc)
console.log(`translate:creeds: ${creeds.map((c) => c.title).join(', ')} → ${out}`)
