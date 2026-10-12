/**
 * Functional data requirements (docs/DATA.md): what "complete" means for the data shipped with
 * the app. Used by `npm run data:check`. Reference counts come from the prototype and are
 * cross-checked against it in tests.
 */
import type { CanonicalData } from './data-model'

/** Chapters per Bible book (Protestant canon, ARA abbreviations). */
export const BOOK_CHAPTERS: Readonly<Record<string, number>> = {
  Gn: 50, Êx: 40, Lv: 27, Nm: 36, Dt: 34, Js: 24, Jz: 21, Rt: 4, '1Sm': 31, '2Sm': 24, '1Rs': 22, '2Rs': 25,
  '1Cr': 29, '2Cr': 36, Ed: 10, Ne: 13, Et: 10, Jó: 42, Sl: 150, Pv: 31, Ec: 12, Ct: 8, Is: 66, Jr: 52, Lm: 5,
  Ez: 48, Dn: 12, Os: 14, Jl: 3, Am: 9, Ob: 1, Jn: 4, Mq: 7, Na: 3, Hc: 3, Sf: 3, Ag: 2, Zc: 14, Ml: 4,
  Mt: 28, Mc: 16, Lc: 24, Jo: 21, At: 28, Rm: 16, '1Co': 16, '2Co': 13, Gl: 6, Ef: 6, Fp: 4, Cl: 4, '1Ts': 5,
  '2Ts': 3, '1Tm': 6, '2Tm': 4, Tt: 3, Fm: 1, Hb: 13, Tg: 5, '1Pe': 5, '2Pe': 3, '1Jo': 5, '2Jo': 1, '3Jo': 1,
  Jd: 1, Ap: 22
}

/**
 * Sections in each chapter of the Westminster Confession (`WCF_SECTIONS[c - 1]`), as published by
 * the Igreja Presbiteriana da Aliança (the church's edition): the American revision (chapter 31,
 * "Dos Sínodos e Concílios", has 4 sections — the 1647 text used by the prototype has 5) plus
 * chapters 34 "Do Espírito Santo" and 35 "Do Amor de Deus e das Missões" (4 sections each).
 */
export const WCF_SECTIONS: readonly number[] = [
  10, 3, 8, 2, 7, 6, 6, 8, 5, 4, 6, 1, 3, 3, 6, 7, 3, 4, 7, 4, 8, 7, 4, 6, 6, 3, 5, 7, 8, 4, 4, 3, 3, 4, 4
]

export const REQUIRED = {
  bibleVersion: 'ARA',
  /** Saltério de Genebra em Português: every psalm (any version/part) and the two canticles. */
  psalter: { id: 'psalter', psalms: 150, canticles: 2 },
  /** Hinário Novo Cântico: hymns 1–400. */
  hymnal: { id: 'hnc', hymns: 400 },
  confession: { id: 'wcf', sections: WCF_SECTIONS },
  catechisms: { wsc: 107, wlc: 196 } as Readonly<Record<string, number>>,
  creeds: ['apostles', 'nicene', 'athanasian'] as const
} as const

/** One unmet requirement, e.g. `{ area: 'bible', problem: 'ARA: missing book Gn' }`. */
export interface Gap {
  area: 'bible' | 'songs' | 'confession' | 'catechisms' | 'creeds'
  problem: string
}

/** Compares loaded data with REQUIRED; an empty list means the shipped data is complete. */
export function checkCompleteness(data: CanonicalData): Gap[] {
  const gaps: Gap[] = []
  const gap = (area: Gap['area'], problem: string) => gaps.push({ area, problem })

  const bible = data.bibles.find((b) => b.meta.code === REQUIRED.bibleVersion)
  if (!bible) gap('bible', `${REQUIRED.bibleVersion}: missing`)
  else {
    const byAbbrev = new Map(bible.books.map((b) => [b.book, b]))
    for (const [abbrev, chapters] of Object.entries(BOOK_CHAPTERS)) {
      const book = byAbbrev.get(abbrev)
      if (!book) gap('bible', `${REQUIRED.bibleVersion}: missing book ${abbrev}`)
      else if (book.chapters.length !== chapters)
        gap('bible', `${REQUIRED.bibleVersion} ${abbrev}: ${book.chapters.length} of ${chapters} chapters`)
    }
  }

  const psalter = data.songbooks.find((b) => b.songbook.id === REQUIRED.psalter.id)
  if (!psalter) gap('songs', `${REQUIRED.psalter.id}: missing`)
  else {
    const psalms = new Set(psalter.songs.map((s) => s.number.split('.')[0]).filter(Boolean))
    const missing = Array.from({ length: REQUIRED.psalter.psalms }, (_, i) => String(i + 1)).filter((n) => !psalms.has(n))
    if (missing.length > 0) gap('songs', `${psalter.songbook.id}: ${missing.length} of ${REQUIRED.psalter.psalms} psalms missing (${summarize(missing)})`)
    const canticles = psalter.songs.filter((s) => !s.number).length
    if (canticles < REQUIRED.psalter.canticles) gap('songs', `${psalter.songbook.id}: ${canticles} of ${REQUIRED.psalter.canticles} canticles`)
  }

  const hymnal = data.songbooks.find((b) => b.songbook.id === REQUIRED.hymnal.id)
  if (!hymnal) gap('songs', `${REQUIRED.hymnal.id}: missing`)
  else {
    const hymns = new Set(hymnal.songs.map((s) => s.number))
    const missing = Array.from({ length: REQUIRED.hymnal.hymns }, (_, i) => String(i + 1)).filter((n) => !hymns.has(n))
    if (missing.length > 0) gap('songs', `${hymnal.songbook.id}: ${missing.length} of ${REQUIRED.hymnal.hymns} hymns missing (${summarize(missing)})`)
  }

  const wcf = data.confessions.find((c) => c.id === REQUIRED.confession.id)
  if (!wcf) gap('confession', `${REQUIRED.confession.id}: missing`)
  else
    REQUIRED.confession.sections.forEach((sections, i) => {
      const chapter = wcf.chapters.find((c) => c.id === String(i + 1))
      if (!chapter) gap('confession', `${wcf.id}: missing chapter ${i + 1}`)
      else if (chapter.sections.length !== sections)
        gap('confession', `${wcf.id} ${i + 1}: ${chapter.sections.length} of ${sections} sections`)
    })

  for (const [id, size] of Object.entries(REQUIRED.catechisms)) {
    const cat = data.catechisms.find((c) => c.id === id)
    if (!cat) gap('catechisms', `${id}: missing`)
    else if (cat.questions.length !== size) gap('catechisms', `${id}: ${cat.questions.length} of ${size} questions`)
  }

  const creedIds = new Set(data.creeds?.creeds.map((c) => c.id) ?? [])
  for (const id of REQUIRED.creeds) if (!creedIds.has(id)) gap('creeds', `missing creed ${id}`)

  return gaps
}

/** `1, 2, 3, 7` → `1–3, 7`, at most a few ranges. */
function summarize(numbers: string[]): string {
  const ranges: string[] = []
  const ns = numbers.map(Number)
  for (let i = 0; i < ns.length; ) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    ranges.push(i === j ? `${ns[i]}` : `${ns[i]}–${ns[j]}`)
    i = j + 1
  }
  return ranges.length > 6 ? `${ranges.slice(0, 6).join(', ')}, …` : ranges.join(', ')
}
