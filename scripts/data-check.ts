// npm run data:check [-- --dir data/canonical]
// Validates data/canonical/ and reports what is still missing against the functional
// requirement (docs/DATA.md). Exit code 1 when anything is invalid or incomplete.
import { resolve } from 'node:path'
import { checkCompleteness } from '../src/shared/requirements'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, loadCanonical } from './lib/canonical'

const args = parseArgs()
const dir = typeof args.dir === 'string' ? resolve(args.dir) : DEFAULT_CANONICAL_DIR

if (isLocked(dir)) {
  console.warn(`data:check: ${dir} is encrypted — run \`npm run data:unlock\` to check the data`)
  process.exit(0)
}

const { data, problems } = loadCanonical(dir)
const gaps = checkCompleteness(data)

if (problems.length > 0) {
  console.error(`data:check: ${problems.length} structural problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
}
if (gaps.length > 0) {
  console.error(`data:check: ${gaps.length} gap(s) against the requirement:`)
  const byArea = Map.groupBy(gaps, (g) => g.area)
  for (const [area, list] of byArea) {
    console.error(`  ${area}: ${list.length}`)
    for (const g of list.slice(0, 10)) console.error(`    - ${g.problem}`)
    if (list.length > 10) console.error(`    … ${list.length - 10} more`)
  }
}
if (problems.length === 0 && gaps.length === 0) console.log('data:check: complete ✓')
else process.exit(1)
