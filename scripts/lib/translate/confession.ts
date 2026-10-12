/**
 * Westminster Confession page from IP Aliança (Wix HTML) → internal format.
 * Layout: `CAPÍTULO I`, an all-caps title, then sections `I. text…` each followed by a
 * Scripture-reference line. Quirks: `V .` / `I .` / `IV Pela` (spacing/missing dot), the book
 * list in 1.2 (one book per line), references glued without spaces (`Mt.3:16`), and the site
 * footer after the last chapter.
 */
import { decodeEntities, toLine, toProse } from '../../../src/shared/clean'
import type { ConfessionChapter } from '../../../src/shared/data-model'

/** Chapter titles as the app shows them (prototype `CFW_T`, chapters 1–33). */
export const WCF_TITLES: readonly string[] = [
  'Da Escritura Sagrada', 'De Deus e da Santíssima Trindade', 'Dos Eternos Decretos de Deus', 'Da Criação',
  'Da Providência', 'Da Queda do Homem, do Pecado e do seu Castigo', 'Do Pacto de Deus com o Homem',
  'De Cristo, o Mediador', 'Do Livre-Arbítrio', 'Da Vocação Eficaz', 'Da Justificação', 'Da Adoção',
  'Da Santificação', 'Da Fé Salvadora', 'Do Arrependimento para a Vida', 'Das Boas Obras',
  'Da Perseverança dos Santos', 'Da Certeza da Graça e da Salvação', 'Da Lei de Deus',
  'Da Liberdade Cristã e da Liberdade de Consciência', 'Do Culto Religioso e do Domingo',
  'Dos Juramentos Legais e dos Votos', 'Do Magistrado Civil', 'Do Matrimônio e do Divórcio', 'Da Igreja',
  'Da Comunhão dos Santos', 'Dos Sacramentos', 'Do Batismo', 'Da Ceia do Senhor', 'Das Censuras Eclesiásticas',
  'Dos Sínodos e Concílios', 'Do Estado do Homem depois da Morte e da Ressurreição dos Mortos', 'Do Juízo Final'
]

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }
export function fromRoman(r: string): number {
  return [...r].reduce((n, c, i, a) => (ROMAN[c] < (ROMAN[a[i + 1]] ?? 0) ? n - ROMAN[c] : n + ROMAN[c]), 0)
}

/** Visible text of an HTML page, one block per line (scripts, styles and tags removed). */
export function htmlToLines(html: string): string[] {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  return decodeEntities(body.replace(/<(br|\/p|\/h[1-6]|\/li|\/div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[\u200b\u00a0]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim()

const CHAPTER = /^CAP[ÍI]TULO\s+([IVXLC]+)$/
const SECTION = /^([IVXLC]+)\s*(\.?)\s+(\S.*)$/
/**
 * A reference line: starts like a book (`Sal.`, `I Cor.`, `João`, `Mt.`, `II Pe.`) and is dense in
 * chapter:verse numbers. Deliberately tolerant: the page has typos such as `João I5:4`,
 * `Mat.l6:19`, `Mat., 1: 18`, `Exo. 21, e 22:1-29` and `I Cor. S;`.
 */
const BOOK_START = /^(?:I{1,3}\s?)?\p{Lu}\p{Ll}{1,8}[.,]*\s?[\dlIS]/u
export function isRefsLine(line: string): boolean {
  if (!BOOK_START.test(line)) return false
  const digits = line.match(/\d/g)?.length ?? 0
  return digits >= 2 && (/[;:]/.test(line) || /\d+\s?[-–]\s?\d+\.?$/.test(line))
}
const FOOTER = /^Sobre N[óo]s$/

export interface ConfessionParse {
  chapters: ConfessionChapter[]
  notes: string[]
}

export function parseConfessionLines(lines: string[]): ConfessionParse {
  const notes: string[] = []
  const chapters: (ConfessionChapter & { number: number; rawTitle: string })[] = []
  type Draft = { id: string; text: string[]; refs: string[] }
  let section: Draft | null = null
  let expectTitle = false

  const flush = () => {
    if (!section) return
    const chapter = chapters[chapters.length - 1]
    // A section whose lines include a short, unpunctuated list (the book list in 1.2) reads
    // better with list items separated by commas.
    const [first, ...rest] = section.text
    const listLike = rest.length > 3 && rest.every((l) => l.length < 40 && !/[.;:!?]$/.test(l))
    const text = listLike ? `${first} ${joinList(rest)}` : section.text.join(' ')
    const refs = section.refs.length > 0 ? toLine(section.refs.join(' ')) : ''
    chapter.sections.push({ id: section.id, text: toProse(text), ...(refs ? { refs } : {}) })
    section = null
  }

  for (const line of lines) {
    if (FOOTER.test(line)) break
    const c = CHAPTER.exec(line)
    if (c) {
      flush()
      const number = fromRoman(c[1])
      if (number !== chapters.length + 1) notes.push(`chapter ${c[1]} found after chapter ${chapters.length}`)
      chapters.push({ id: String(number), number, title: '', rawTitle: '', sections: [] })
      expectTitle = true
      continue
    }
    const chapter = chapters[chapters.length - 1]
    if (!chapter) continue
    if (expectTitle) {
      chapter.rawTitle = line
      expectTitle = false
      continue
    }
    const s = SECTION.exec(line)
    // `IV Pela…` (no dot) is a section; `III João` in the 1.2 book list is not — without the dot,
    // only a full sentence counts.
    const isSection = s && (s[2] === '.' || s[3].length > 40) && !isRefsLine(line)
    if (isSection && fromRoman(s[1]) === chapter.sections.length + (section ? 2 : 1)) {
      flush()
      section = { id: String(fromRoman(s[1])), text: [s[3]], refs: [] }
      continue
    }
    if (!section) {
      notes.push(`chapter ${chapter.id}: stray line "${line.slice(0, 40)}"`)
      continue
    }
    if (isRefsLine(line) || section.refs.length > 0) section.refs.push(line)
    else section.text.push(line)
  }
  flush()

  for (const ch of chapters) {
    const known = WCF_TITLES[ch.number - 1]
    if (known && fold(known) === fold(ch.rawTitle)) ch.title = known
    else {
      ch.title = sentenceCase(ch.rawTitle)
      notes.push(`chapter ${ch.id}: title "${ch.rawTitle}"${known ? ` ≠ "${known}"` : ''} — using "${ch.title}"`)
    }
  }
  return { chapters: chapters.map(({ id, title, sections }) => ({ id, title, sections })), notes }
}

/** `O VELHO TESTAMENTO`, `Gênesis`, `Êxodo` … → `O Velho Testamento: Gênesis, Êxodo, …` */
function joinList(items: string[]): string {
  const out: string[] = []
  for (const item of items) {
    if (item === item.toUpperCase() && /\p{Lu}{3}/u.test(item)) out.push(`${out.length ? '. ' : ''}${sentenceCase(item)}:`)
    else out.push(`${out.length && !out[out.length - 1].endsWith(':') ? ', ' : ' '}${item}`)
  }
  return out.join('').trim() + '.'
}

function sentenceCase(s: string): string {
  const lower = s.toLocaleLowerCase('pt-BR')
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}
