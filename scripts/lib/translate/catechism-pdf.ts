/**
 * Larger Catechism PDF published by the IPB → questions. Text is extracted with `pdftotext`
 * (poppler; `brew install poppler`) — only the maintainer runs translators, and the result is
 * versioned, so the shipped app never depends on it.
 *
 * Layout: "N. question?" (may wrap), answer lines, then a Scripture-reference paragraph.
 * Quirks handled: page breaks (\f) glued to a question, references glued to the next question,
 * words hyphenated across lines, and questions missing from the PDF (reported, and filled from
 * a supplement file).
 */
import { execFileSync } from 'node:child_process'
import { toLine, toProse } from '../../../src/shared/clean'
import type { CatechismQuestion } from '../../../src/shared/data-model'

const QUESTION = /^(\d{1,3})\.\s+(\S.*)$/
/**
 * Start of the Scripture-reference paragraph: `Rm 11.36`, `1Co 10.31`, `2Tm 3.16`, or a
 * cross-reference such as `Veja-se Confissão de Fé, Cap. XXVII…`.
 */
const REFS_START = /^(?:(?:[1-3]\s?)?[A-ZÊÉÁÓÚ][a-zêéáíóúç]{0,3}\s?\d+[.:,]|Veja-se\b)/

/**
 * Joins wrapped lines. A line ending in `word-` continues the same token (`gozá-` + `lo` →
 * `gozá-lo`, `Deus-` + `Homem`, `16.13-` + `14`); a spaced dash (`Satanás -`) or anything else
 * joins with a space.
 */
export function joinWrapped(lines: string[]): string {
  return lines.reduce((acc, line) => {
    const l = line.trim()
    if (!acc) return l
    if (/[\p{L}\d]-$/u.test(acc)) return acc + l
    return `${acc} ${l}`
  }, '')
}

export interface ParsedCatechism {
  questions: CatechismQuestion[]
  /** Question numbers absent from the source. */
  missing: number[]
  notes: string[]
}

export function parseLargerCatechismText(text: string, expected: number): ParsedCatechism {
  const lines = text.replace(/\f/g, '\n').split('\n').map((l) => l.trim())
  const found = new Map<number, { q: string[]; a: string[]; r: string[] }>()
  let current: { q: string[]; a: string[]; r: string[] } | null = null
  let mode: 'question' | 'answer' | 'refs' = 'question'
  let last = 0

  for (const line of lines) {
    const m = QUESTION.exec(line)
    // A new question only when its number moves forward (at most a few missing in between),
    // so numbered lists inside an answer are never mistaken for questions.
    if (m && Number(m[1]) > last && Number(m[1]) <= last + 5) {
      last = Number(m[1])
      current = { q: [m[2]], a: [], r: [] }
      found.set(last, current)
      mode = /\?$/.test(m[2]) ? 'answer' : 'question'
      continue
    }
    if (!current || line === '') continue
    if (mode === 'question') {
      current.q.push(line)
      if (/\?$/.test(line)) mode = 'answer'
    } else if (mode === 'answer' && current.a.length > 0 && REFS_START.test(line)) {
      mode = 'refs'
      current.r.push(line)
    } else (mode === 'refs' ? current.r : current.a).push(line)
  }

  const questions: CatechismQuestion[] = []
  const missing: number[] = []
  const notes: string[] = []
  for (let n = 1; n <= expected; n++) {
    const item = found.get(n)
    if (!item) {
      missing.push(n)
      continue
    }
    if (item.a.length === 0) notes.push(`Q${n}: no answer text in the source`)
    const refs = item.r.length > 0 ? toLine(joinWrapped(item.r)) : ''
    questions.push({
      number: n,
      question: toProse(joinWrapped(item.q)),
      answer: toProse(joinWrapped(item.a)),
      ...(refs ? { refs } : {})
    })
  }
  return { questions, missing, notes }
}

/** Fills missing questions (and optionally overrides existing ones) from a supplement list. */
export function applySupplement(
  parsed: ParsedCatechism,
  supplement: CatechismQuestion[],
  expected: number
): { questions: CatechismQuestion[]; missing: number[]; notes: string[] } {
  const byNumber = new Map(parsed.questions.map((q) => [q.number, q]))
  const notes = [...parsed.notes]
  for (const s of supplement) {
    const refs = s.refs ? toLine(s.refs) : ''
    byNumber.set(s.number, { number: s.number, question: toProse(s.question), answer: toProse(s.answer), ...(refs ? { refs } : {}) })
    notes.push(`Q${s.number}: taken from the supplement`)
  }
  const questions: CatechismQuestion[] = []
  const missing: number[] = []
  for (let n = 1; n <= expected; n++) {
    const q = byNumber.get(n)
    if (q) questions.push(q)
    else missing.push(n)
  }
  return { questions, missing, notes }
}

export function pdfToText(file: string): string {
  try {
    // -raw keeps line-end hyphens; the default mode silently de-hyphenates (`16.13-14` → `16.1314`).
    return execFileSync('pdftotext', ['-raw', file, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (err) {
    throw new Error(`pdftotext failed (install poppler: brew install poppler): ${(err as Error).message}`, { cause: err })
  }
}
