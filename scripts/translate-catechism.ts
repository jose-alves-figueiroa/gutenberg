// npm run translate:catechism -- --id wsc --file data/sources/wsc.json [--out data/canonical]
// npm run translate:catechism -- --id wlc --file data/sources/wlc.pdf [--supplement data/sources/wlc-supplement.json]
//   (questions missing from the PDF come from the supplement: [{ number, question, answer, refs? }])
// Translates a catechism source into data/canonical/catechisms/<id>.json.
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { CatechismQuestion } from '../src/shared/data-model'
import { REQUIRED } from '../src/shared/requirements'
import { validateCatechism } from '../src/shared/validate'
import { parseArgs } from './lib/args'
import { DEFAULT_CANONICAL_DIR, isLocked, writeJson } from './lib/canonical'
import { catechismDocument, translateGistCatechism, type GistItem } from './lib/translate/catechism'
import { applySupplement, parseLargerCatechismText, pdfToText } from './lib/translate/catechism-pdf'

const args = parseArgs()
if (typeof args.id !== 'string' || typeof args.file !== 'string') {
  console.error('usage: npm run translate:catechism -- --id <wsc|wlc> --file <source.json|source.pdf> [--out data/canonical]')
  process.exit(1)
}
const id = args.id
const file = resolve(args.file)
const outRoot = typeof args.out === 'string' ? resolve(args.out) : DEFAULT_CANONICAL_DIR
if (isLocked(outRoot)) {
  console.error(`translate:catechism: ${outRoot} is encrypted — run \`npm run data:unlock\` first`)
  process.exit(1)
}

let questions: CatechismQuestion[]
let notes: string[]
let sourceName: string
if (file.endsWith('.json')) {
  ;({ questions, notes } = translateGistCatechism(JSON.parse(readFileSync(file, 'utf8')) as GistItem[]))
  sourceName = 'gist'
} else if (file.endsWith('.pdf')) {
  const expected = REQUIRED.catechisms[id] ?? 0
  const parsed = parseLargerCatechismText(pdfToText(file), expected)
  const supplementFile = typeof args.supplement === 'string' ? resolve(args.supplement) : file.replace(/\.pdf$/, '-supplement.json')
  const supplement = existsSync(supplementFile) ? (JSON.parse(readFileSync(supplementFile, 'utf8')) as CatechismQuestion[]) : []
  const merged = applySupplement(parsed, supplement, expected)
  questions = merged.questions
  notes = merged.notes
  if (merged.missing.length > 0) {
    console.error(`translate:catechism: questions missing from the PDF and the supplement: ${merged.missing.join(', ')}`)
    console.error(`  add them to ${supplementFile} as [{ "number": N, "question": "…", "answer": "…", "refs": "…" }]`)
    process.exit(1)
  }
  sourceName = 'ipb-pdf'
} else {
  console.error(`translate:catechism: unsupported source ${file} (expected .json or .pdf)`)
  process.exit(1)
}

const doc = catechismDocument(id, questions, { name: sourceName, id: basename(file) })
const problems = validateCatechism(doc, id)
const expected = REQUIRED.catechisms[id]
if (expected && questions.length !== expected) problems.push(`${id}: ${questions.length} of ${expected} questions`)
if (problems.length > 0) {
  console.error(`translate:catechism: ${problems.length} problem(s):`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

const out = join(outRoot, 'catechisms', `${id}.json`)
writeJson(out, doc)
console.log(`translate:catechism: ${id} → ${out} (${questions.length} questions)`)
for (const n of notes) console.log(`  note: ${n}`)
