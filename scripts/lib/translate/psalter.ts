/**
 * Saltério de Genebra em Português (salteriodegenebra.com.br, CC0) `letras.docx` → songs.
 * Paragraph styles: `Ttulo1` = title (`Salmo 1A`, `Salmo 119.1-8A`, `Os dez mandamentos`),
 * `Autoremelodia` (or `Body2`) = `(Author - Saltério de Genebra)`, `Numeraodeestrofe` /
 * `Numeraaodeestrofe` = stanza number, `TextoBblico` = Scripture reference of a canticle,
 * no style = a line of the current stanza. Lines carry Bible verse numbers (`1 Quão…`,
 * `Dizendo:_3 “Os…`) and `_` marking syllable elision; both are removed.
 */
import { execFileSync } from 'node:child_process'
import { decodeEntities, toLine } from '../../../src/shared/clean'
import type { Song } from '../../../src/shared/data-model'

export interface DocxParagraph {
  style: string
  text: string
}

/** Reads `word/document.xml` of a .docx (via `unzip`, available on macOS/Linux). */
export function readDocxParagraphs(file: string): DocxParagraph[] {
  const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return parseDocumentXml(xml)
}

export function parseDocumentXml(xml: string): DocxParagraph[] {
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map((p) => {
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? ''
    const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(br|tab)\s*\/>/g)]
      .map((m) => (m[2] === 'br' ? '\n' : m[2] === 'tab' ? ' ' : decodeEntities(m[1])))
      .join('')
    return { style, text }
  })
}

const AUTHOR_ABBREVIATIONS: Record<string, string> = { CBS: 'Comissão Brasileira de Salmodia' }

/** `(Lucas Freire / Vítor Olivier - Saltério de Genebra)` → `Lucas Freire / Vítor Olivier`. */
export function parseAuthorLine(text: string): string | null {
  const m = /^\((.+?)(?:\s*-\s*Saltério de Genebra)?\)$/.exec(toLine(text))
  if (!m) return null
  return m[1]
    .split(/\s*\/\s*/)
    .map((a) => AUTHOR_ABBREVIATIONS[a] ?? a)
    .join(' / ')
}

/** Removes Bible verse numbers (`3`, `4-5`) and elision marks from a lyric line. */
export function cleanLyricLine(line: string): string {
  return toLine(
    line
      .replace(/(^|[\s_“"(])\d{1,3}(?:[-–]\d{1,3})?(?=[\s_])/g, '$1')
      .replace(/_/g, ' ')
  )
}

const PSALM_TITLE = /^Salmo\s+(\d{1,3}(?:\.\d{1,3}-\d{1,3})?)([A-Z])$/

export function parsePsalter(paragraphs: DocxParagraph[]): { songs: Song[]; notes: string[] } {
  const notes: string[] = []
  const songs: Song[] = []
  let current: (Song & { ref?: string }) | null = null
  let stanza: string[] | null = null

  const closeStanza = () => {
    if (current && stanza && stanza.length > 0) current.stanzas.push(stanza)
    stanza = null
  }
  const closeSong = () => {
    closeStanza()
    if (current) songs.push(current)
    current = null
  }

  for (const p of paragraphs) {
    const text = toLine(p.text)
    if (p.style === 'Ttulo1') {
      closeSong()
      const m = PSALM_TITLE.exec(text)
      const number = m?.[1] ?? ''
      const version = m?.[2] ?? ''
      const title = m ? `Salmo ${number}${version}` : text
      const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      current = {
        format: 1,
        id: m ? `psalter-${number}${version}` : `psalter-${slug}`,
        songbook: 'psalter',
        number,
        version,
        title,
        versification: '',
        credits: { author: '', artist: '', copyright: 'CC0 1.0 — salteriodegenebra.com.br' },
        stanzas: [],
        source: { name: 'salteriodegenebra', id: title }
      }
      continue
    }
    if (!current) continue
    if (p.style === 'Autoremelodia' || p.style === 'Body2') {
      const author = parseAuthorLine(text)
      if (author) current.credits.author = author
      else notes.push(`${current.title}: unrecognized author line "${text}"`)
      continue
    }
    if (p.style === 'TextoBblico') {
      current.versification = text
      continue
    }
    if (/^Numera\w*estrofe$/.test(p.style)) {
      closeStanza()
      stanza = []
      continue
    }
    for (const raw of p.text.split('\n')) {
      const line = cleanLyricLine(raw)
      if (!line) continue
      if (!stanza) stanza = []
      stanza.push(line)
    }
  }
  closeSong()

  for (const s of songs) {
    if (!s.credits.author) notes.push(`${s.title}: no author line`)
    if (s.stanzas.length === 0) notes.push(`${s.title}: no stanzas`)
  }
  return { songs, notes }
}
