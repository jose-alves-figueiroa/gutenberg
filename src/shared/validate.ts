/**
 * Structural validators for the internal data format (src/shared/data-model.ts).
 * Each returns a list of human-readable problems; an empty list means valid.
 * Used by the translators before writing and by `data:check` / `data:build` before reading.
 */
import type { BibleBook, Catechism, Confession, Creeds, Song, Songbook } from './data-model'
import { DATA_FORMAT } from './data-model'

type Problems = string[]

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown): v is string => typeof v === 'string'
const isFilled = (v: unknown): v is string => isText(v) && v.trim() !== ''
const HTML = /<\/?[a-z][^>]*>|&nbsp;|&#\d+;|&[a-z]+;/i

function common(v: unknown, where: string, out: Problems): v is Record<string, unknown> {
  if (!isObject(v)) {
    out.push(`${where}: not an object`)
    return false
  }
  if (v.format !== DATA_FORMAT) out.push(`${where}: format must be ${DATA_FORMAT}`)
  return true
}

function source(v: Record<string, unknown>, where: string, out: Problems): void {
  if (!isObject(v.source) || !isFilled(v.source.name)) out.push(`${where}: source.name is required`)
}

/** Running text: non-empty, no HTML, no single line breaks (only blank lines between paragraphs). */
function prose(text: unknown, where: string, out: Problems): void {
  if (!isFilled(text)) return void out.push(`${where}: empty text`)
  if (HTML.test(text)) out.push(`${where}: contains HTML`)
  if (/[^\n]\n[^\n]/.test(text)) out.push(`${where}: single line break in running text`)
}

function document(v: Record<string, unknown>, where: string, out: Problems): void {
  for (const k of ['id', 'title', 'shortTitle'] as const) if (!isFilled(v[k])) out.push(`${where}: ${k} is required`)
  if (!isText(v.prefix)) out.push(`${where}: prefix must be a string`)
  source(v, where, out)
}

export function validateBibleMeta(v: unknown, where = 'bible meta'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  if (!isFilled(v.code)) out.push(`${where}: code is required`)
  if (!isFilled(v.name)) out.push(`${where}: name is required`)
  source(v, where, out)
  return out
}

export function validateBibleBook(v: unknown, where = 'bible book'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  const b = v as Partial<BibleBook>
  if (!isFilled(b.book)) out.push(`${where}: book is required`)
  if (!isFilled(b.name)) out.push(`${where}: name is required`)
  if (!Number.isInteger(b.order) || b.order! < 1 || b.order! > 66) out.push(`${where}: order must be 1–66`)
  if (b.testament !== 'OT' && b.testament !== 'NT') out.push(`${where}: testament must be OT or NT`)
  if (!Array.isArray(b.chapters) || b.chapters.length === 0) out.push(`${where}: chapters must be a non-empty array`)
  else
    b.chapters.forEach((ch, c) => {
      if (!Array.isArray(ch) || ch.length === 0) return void out.push(`${where} ${c + 1}: no verses`)
      ch.forEach((verse, i) => prose(verse, `${where} ${c + 1}.${i + 1}`, out))
    })
  return out
}

export function validateSongbook(v: unknown, where = 'songbook'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  document(v, where, out)
  if (!isText((v as Partial<Songbook>).itemLabel)) out.push(`${where}: itemLabel must be a string`)
  return out
}

export function validateSong(v: unknown, where = 'song'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  const s = v as Partial<Song>
  for (const k of ['id', 'songbook'] as const) if (!isFilled(s[k])) out.push(`${where}: ${k} is required`)
  for (const k of ['number', 'version', 'title', 'versification'] as const) if (!isText(s[k])) out.push(`${where}: ${k} must be a string`)
  if (!isFilled(s.number) && !isFilled(s.title)) out.push(`${where}: needs a number or a title`)
  const credits: unknown = s.credits
  if (!isObject(credits) || !['author', 'artist', 'copyright'].every((k) => isText(credits[k])))
    out.push(`${where}: credits must have author, artist and copyright strings`)
  if (!Array.isArray(s.stanzas) || s.stanzas.length === 0) out.push(`${where}: stanzas must be a non-empty array`)
  else
    s.stanzas.forEach((st, i) => {
      if (!Array.isArray(st) || st.length === 0 || !st.every(isFilled)) out.push(`${where} stanza ${i + 1}: needs non-empty lines`)
      else if (st.some((line) => HTML.test(line) || line.includes('\n'))) out.push(`${where} stanza ${i + 1}: HTML or line break inside a line`)
    })
  source(s as Record<string, unknown>, where, out)
  return out
}

export function validateConfession(v: unknown, where = 'confession'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  document(v, where, out)
  const c = v as Partial<Confession>
  if (!Array.isArray(c.chapters) || c.chapters.length === 0) return [...out, `${where}: chapters must be a non-empty array`]
  const chapterIds = new Set<string>()
  for (const ch of c.chapters) {
    const at = `${where} ${ch?.id ?? '?'}`
    if (!isFilled(ch?.id)) out.push(`${where}: chapter without id`)
    else if (chapterIds.has(ch.id)) out.push(`${at}: duplicate chapter id`)
    else chapterIds.add(ch.id)
    if (!isFilled(ch?.title)) out.push(`${at}: title is required`)
    if (!Array.isArray(ch?.sections) || ch.sections.length === 0) {
      out.push(`${at}: no sections`)
      continue
    }
    const ids = new Set<string>()
    for (const s of ch.sections) {
      if (!isFilled(s?.id)) out.push(`${at}: section without id`)
      else if (ids.has(s.id)) out.push(`${at}.${s.id}: duplicate section id`)
      else ids.add(s.id)
      prose(s?.text, `${at}.${s?.id ?? '?'}`, out)
    }
  }
  return out
}

export function validateCatechism(v: unknown, where = 'catechism'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  document(v, where, out)
  const c = v as Partial<Catechism>
  if (!Array.isArray(c.questions) || c.questions.length === 0) return [...out, `${where}: questions must be a non-empty array`]
  c.questions.forEach((q, i) => {
    const at = `${where} Q${q?.number ?? '?'}`
    if (q?.number !== i + 1) out.push(`${where}: question ${i + 1} is numbered ${q?.number}`)
    prose(q?.question, `${at} question`, out)
    prose(q?.answer, `${at} answer`, out)
    if (q?.refs !== undefined && !isText(q.refs)) out.push(`${at}: refs must be a string`)
  })
  return out
}

export function validateCreeds(v: unknown, where = 'creeds'): Problems {
  const out: Problems = []
  if (!common(v, where, out)) return out
  const c = v as Partial<Creeds>
  if (!Array.isArray(c.creeds) || c.creeds.length === 0) return [...out, `${where}: creeds must be a non-empty array`]
  const ids = new Set<string>()
  for (const creed of c.creeds) {
    if (!['apostles', 'nicene', 'athanasian'].includes(creed?.id)) out.push(`${where}: unknown creed id ${creed?.id}`)
    else if (ids.has(creed.id)) out.push(`${where}: duplicate creed ${creed.id}`)
    else ids.add(creed.id)
    if (!isFilled(creed?.title)) out.push(`${where} ${creed?.id}: title is required`)
    prose(creed?.text, `${where} ${creed?.id}`, out)
  }
  source(c as Record<string, unknown>, where, out)
  return out
}

