/**
 * Screens for a library item — port of the prototype's `slidesOf()`, with the per-collection
 * headers from the README ("Cabeçalhos por coleção"). The output already has the OBS payload
 * shape: `header` + up to 2 `lines`, no HTML. Header wording comes from i18n and from the
 * document's own short title (`CFW`, `Breve Catecismo`, `Salmo`).
 */
import { autobreak, DEFAULT_MAX } from './autobreak'
import { bookName } from './collections'
import type { Catechism, CatechismQuestion, Confession, ConfessionSection, Creed, Song, Songbook } from './data-model'
import { t } from './i18n'

export interface Slide {
  header: string
  lines: string[]
}

/** A Bible reading: consecutive verses of one chapter. */
export interface BiblePassage {
  /** Book abbreviation (`Hb`). */
  book: string
  chapter: number
  verses: { number: number; text: string }[]
}

export type LibraryEntry =
  | { kind: 'bible'; item: BiblePassage }
  | { kind: 'catechism'; catechism: Pick<Catechism, 'shortTitle'>; item: CatechismQuestion }
  | { kind: 'confession'; confession: Pick<Confession, 'shortTitle'>; chapter: string; item: ConfessionSection }
  | { kind: 'creed'; item: Creed }
  | { kind: 'song'; songbook: Pick<Songbook, 'itemLabel'>; item: Song }

/** Lines per screen for songs: the OBS lower third shows at most 2. */
export const SONG_LINES_PER_SCREEN = 2

const toSlide = (header: string, text: string): Slide => ({ header, lines: text.split('\n') })

/**
 * Header for a song: `Salmo 133B` when the songbook has an item label, `155 · Castelo forte` when
 * it only has a number, and the title for unnumbered songs (`O cântico de Simeão`).
 */
export function songHeader(songbook: Pick<Songbook, 'itemLabel'>, song: Song): string {
  if (!song.number) return song.title
  if (songbook.itemLabel) return t('slide.songLabeled', { label: songbook.itemLabel, number: song.number, version: song.version })
  return t('slide.songNumbered', { number: song.number, title: song.title })
}

/** Splits a library item into screens. `max` is the per-screen character limit (60–160). */
export function slidesOf(entry: LibraryEntry, max: number = DEFAULT_MAX): Slide[] {
  switch (entry.kind) {
    case 'bible': {
      const { book, chapter, verses } = entry.item
      const name = bookName(book)
      return verses.flatMap((v) => {
        const parts = autobreak(v.text, max)
        const ref = `${name} ${chapter}.${v.number}`
        return parts.map((text, i) => toSlide(parts.length > 1 ? `${ref} (${i + 1}/${parts.length})` : ref, text))
      })
    }
    case 'catechism': {
      const { number, question, answer } = entry.item
      const name = entry.catechism.shortTitle
      return [
        ...autobreak(question, max).map((text) => toSlide(t('slide.catechismQuestion', { name, number }), text)),
        ...autobreak(answer, max).map((text) => toSlide(t('slide.catechismAnswer', { name, number }), text))
      ]
    }
    case 'confession': {
      const header = t('slide.confession', { name: entry.confession.shortTitle, chapter: entry.chapter, section: entry.item.id })
      return autobreak(entry.item.text, max).map((text) => toSlide(header, text))
    }
    case 'creed':
      return autobreak(entry.item.text, max).map((text) => toSlide(entry.item.title, text))
    case 'song': {
      // Songs never use autobreak: each stanza is split into screens of 2 lines (the lower third's
      // maximum), never mixing lines of different stanzas.
      const header = songHeader(entry.songbook, entry.item)
      return entry.item.stanzas.flatMap((stanza) => {
        const screens: Slide[] = []
        for (let i = 0; i < stanza.length; i += SONG_LINES_PER_SCREEN)
          screens.push({ header, lines: stanza.slice(i, i + SONG_LINES_PER_SCREEN) })
        return screens
      })
    }
  }
}
