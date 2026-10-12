/**
 * Hinário Novo Cântico XML (novocantico.com.br, one file per hymn) → songs.
 *
 *   <hino situacao="incompleto"?>            "incompleto" = site metadata missing (lyrics checked
 *     <numero>003</numero> <n>3</n>            against the official PDF)
 *     <titulo>…</titulo>
 *     <texto><estrofe><verso>…</verso>…<coro><verso>…</verso></coro></estrofe>…</texto>
 *     <origem_letra>…</origem_letra>*  <origem_musica …>…</origem_musica>*  <referencia_biblica>…
 *   </hino>
 *
 * Presentation order: after each stanza comes the most recent chorus (a chorus is printed once,
 * inside the stanza where it starts, and may change later in the hymn).
 */
import { decodeEntities, toLine } from '../../../src/shared/clean'
import type { Song } from '../../../src/shared/data-model'

export const HNC_COPYRIGHT = 'Hinário Novo Cântico © Editora Cultura Cristã'

const tagText = (xml: string, tag: string): string[] =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => toLine(decodeEntities(m[1])))

/** Lyric line: entities decoded, spacing normalized, stanza numbers printed in the text removed. */
export function cleanVerse(text: string): string {
  return toLine(decodeEntities(text)).replace(/^\d{1,2}\s+(?=\p{Lu})/u, '')
}

/** Scripture references among `origem_letra` (e.g. `Sl 145.17,18`) go to `versification`. */
const SCRIPTURE = /^(?:[1-3]\s?)?\p{Lu}\p{Ll}{0,4}\.?\s\d+[.:]\d/u

export function parseHymnXml(xml: string): { song: Song; notes: string[] } {
  const notes: string[] = []
  const numero = tagText(xml, 'numero')[0] ?? ''
  const n = tagText(xml, 'n')[0] ?? ''
  const number = n || numero
  if (!number) throw new Error('hymn without <n>/<numero>')
  const title = tagText(xml, 'titulo')[0] ?? ''

  const stanzas: string[][] = []
  let chorus: string[] | null = null
  const texto = /<texto>([\s\S]*?)<\/texto>/.exec(xml)?.[1] ?? ''
  for (const [, body] of texto.matchAll(/<estrofe>([\s\S]*?)<\/estrofe>/g)) {
    const coro = /<coro>([\s\S]*?)<\/coro>/.exec(body)?.[1]
    const own = body.replace(/<coro>[\s\S]*?<\/coro>/, '')
    const lines = [...own.matchAll(/<verso(?:\s[^>]*)?>([\s\S]*?)<\/verso>/g)].map((m) => cleanVerse(m[1])).filter(Boolean)
    if (coro) chorus = [...coro.matchAll(/<verso(?:\s[^>]*)?>([\s\S]*?)<\/verso>/g)].map((m) => cleanVerse(m[1])).filter(Boolean)
    if (lines.length > 0) stanzas.push(lines)
    if (chorus && chorus.length > 0) stanzas.push(chorus)
  }
  if (stanzas.length === 0) notes.push(`hymn ${number}: no lyrics`)

  const letra = tagText(xml, 'origem_letra')
  const refs = [...letra.filter((l) => SCRIPTURE.test(l)), ...tagText(xml, 'referencia_biblica')]
  const song: Song = {
    format: 1,
    id: `hnc-${number}`,
    songbook: 'hnc',
    number,
    version: '',
    title,
    versification: refs.join('; '),
    credits: {
      author: letra.filter((l) => !SCRIPTURE.test(l)).join(' / '),
      artist: tagText(xml, 'origem_musica').join(' / '),
      copyright: HNC_COPYRIGHT
    },
    stanzas,
    source: { name: 'novocantico', id: numero || number }
  }
  return { song, notes }
}

/** Numbered hymns first (1–400), then the appendices (A, B, C…). */
export function hymnOrder(a: Song, b: Song): number {
  const na = Number(a.number)
  const nb = Number(b.number)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  if (Number.isFinite(na)) return -1
  if (Number.isFinite(nb)) return 1
  return a.number.localeCompare(b.number)
}
