/**
 * Telas por item da biblioteca — porte de `slidesOf()` do protótipo, com os cabeçalhos
 * por coleção do README ("Cabeçalhos por coleção"). A saída já tem o formato do payload
 * para o OBS: `header` + até 2 `lines`, sem HTML.
 */
import { autobreak, DEFAULT_MAX, splitSegments } from './autobreak'
import { bookName, COLLECTION, type CollectionKey } from './collections'

export interface Slide {
  header: string
  lines: string[]
}

export interface BibleVerse {
  n: number | string
  t: string
}
export interface BibleItem {
  /** Abreviação do livro (`Hb`). */
  book: string
  ch: number | string
  verses: BibleVerse[]
}
export interface CatechismItem {
  q: number | string
  pergunta: string
  resposta: string
}
export interface CfwItem {
  cap: number | string
  sec: number | string
  text: string
}
export interface CreedItem {
  title: string
  text: string
}
export interface PsalmItem {
  num: number | string
  /** Versão (`A`, `B`…); vazia quando o salmo tem uma só. */
  ver?: string
  text: string
}
export interface HymnItem {
  num?: number | string
  title: string
  text: string
}

export type LibraryEntry =
  | { collection: 'biblia'; item: BibleItem }
  | { collection: 'breve' | 'maior'; item: CatechismItem }
  | { collection: 'cfw'; item: CfwItem }
  | { collection: 'credos'; item: CreedItem }
  | { collection: 'salmos'; item: PsalmItem }
  | { collection: 'hnc'; item: HymnItem }

const toSlide = (header: string, text: string): Slide => ({ header, lines: text.split('\n') })

/** Título do cântico usado como cabeçalho (`Salmo 133B`, `12 · Castelo forte`). */
export function songTitle(collection: Extract<CollectionKey, 'salmos' | 'hnc'>, item: PsalmItem | HymnItem): string {
  if (collection === 'salmos') {
    const p = item as PsalmItem
    return `Salmo ${p.num}${p.ver ?? ''}`
  }
  const h = item as HymnItem
  return (h.num ? `${h.num} · ` : '') + h.title
}

/** Divide um item em telas. `max` é o limite de caracteres por tela (60–160). */
export function slidesOf(entry: LibraryEntry, max: number = DEFAULT_MAX): Slide[] {
  switch (entry.collection) {
    case 'biblia': {
      const { book, ch, verses } = entry.item
      const name = bookName(book)
      return verses.flatMap((v) => {
        const parts = autobreak(v.t, max)
        const ref = `${name} ${ch}.${v.n}`
        return parts.map((t, i) => toSlide(parts.length > 1 ? `${ref} (${i + 1}/${parts.length})` : ref, t))
      })
    }
    case 'breve':
    case 'maior': {
      const { q, pergunta, resposta } = entry.item
      const header = `${COLLECTION[entry.collection].short} · P. ${q}`
      return [
        ...autobreak(pergunta, max).map((t) => toSlide(`${header} · pergunta`, t)),
        ...autobreak(resposta, max).map((t) => toSlide(header, t))
      ]
    }
    case 'cfw': {
      const { cap, sec, text } = entry.item
      return autobreak(text, max).map((t) => toSlide(`CFW ${cap}.${sec}`, t))
    }
    case 'credos':
      return autobreak(entry.item.text, max).map((t) => toSlide(entry.item.title, t))
    case 'salmos':
    case 'hnc': {
      // Cânticos não usam a quebra automática: cada estrofe é uma tela.
      const header = songTitle(entry.collection, entry.item)
      return splitSegments(entry.item.text).map((t) => toSlide(header, t))
    }
  }
}
