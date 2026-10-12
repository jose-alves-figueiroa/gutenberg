/**
 * Gutenberg's internal data format (data/canonical/**), see docs/DATA.md.
 * Every source (OpenLP, Holyrics, web pages, PDFs) is translated into these shapes;
 * we never mirror a source's own schema. Keys are English; content is pt-BR.
 */

export const DATA_FORMAT = 1

/** Where a record came from (e.g. `holyrics-db` + original id). */
export interface SourceRef {
  name: string
  id?: string
}

export interface BibleVersionMeta {
  format: typeof DATA_FORMAT
  code: string
  name: string
  /** Copyright line as given by the source (e.g. `Almeida Revista e Atualizada - 1993`). */
  copyright?: string
  source: SourceRef
}

export type Testament = 'OT' | 'NT'

/** One book of a Bible version. `chapters[c - 1][v - 1]` is the text of verse `c.v`. */
export interface BibleBook {
  format: typeof DATA_FORMAT
  book: string
  name: string
  order: number
  testament: Testament
  chapters: string[][]
}

/**
 * A songbook: Hinário Novo Cântico, the Genevan Psalter, Harpa Cristã… Songs belong to one.
 * Songs from Holyrics that are in no published songbook go to a catch-all songbook.
 */
export interface Songbook {
  format: typeof DATA_FORMAT
  /** Stable id (`hnc`, `psalter`…), also the folder name under `songbooks/`. */
  id: string
  title: string
  shortTitle: string
  /** Quick-search prefix (`hnc`, `sg`). */
  prefix: string
  /**
   * Word placed before the number in slide headers (`Salmo` → `Salmo 133B`).
   * Empty for hymnals, whose headers read `155 · Castelo forte`.
   */
  itemLabel: string
  source: SourceRef
}

export interface SongCredits {
  author: string
  artist: string
  copyright: string
}

/** A song of a songbook. Each stanza is one screen; each entry of a stanza is one line. */
export interface Song {
  format: typeof DATA_FORMAT
  id: string
  /** `Songbook.id`. */
  songbook: string
  number: string
  /** Version within the same number (the Psalter has 133A, 133B, 133C…); empty when unique. */
  version: string
  title: string
  versification: string
  credits: SongCredits
  stanzas: string[][]
  source: SourceRef
}

/** One numbered part of a confession (a section, an article, a rejection of errors…). */
export interface ConfessionSection {
  /** Label as printed: `1`, `2`, `R1`… */
  id: string
  title?: string
  text: string
}

/** A chapter / head of doctrine. `id` is a label (`1`, `3/4` in the Canons of Dort). */
export interface ConfessionChapter {
  id: string
  title: string
  sections: ConfessionSection[]
}

/** A confession of faith: Westminster, Belgic, Canons of Dort… */
export interface Confession {
  format: typeof DATA_FORMAT
  /** Stable id (`wcf`). */
  id: string
  title: string
  /** Used in slide headers (`CFW 1.1`). */
  shortTitle: string
  prefix: string
  chapters: ConfessionChapter[]
  source: SourceRef
}

export interface CatechismQuestion {
  number: number
  question: string
  answer: string
  /** Scripture references, as printed by the source. */
  refs?: string
}

/** A catechism: Westminster Shorter / Larger, Heidelberg… */
export interface Catechism {
  format: typeof DATA_FORMAT
  /** Stable id (`wsc`, `wlc`). */
  id: string
  title: string
  /** Used in slide headers (`Breve Catecismo · P. 1`). */
  shortTitle: string
  prefix: string
  questions: CatechismQuestion[]
  source: SourceRef
}

export type CreedId = 'apostles' | 'nicene' | 'athanasian'

export interface Creed {
  id: CreedId
  title: string
  text: string
}

export interface Creeds {
  format: typeof DATA_FORMAT
  creeds: Creed[]
  source: SourceRef
}

/** Everything under data/canonical/, loaded in memory (scripts/lib/canonical.ts). */
export interface CanonicalData {
  bibles: { meta: BibleVersionMeta; books: BibleBook[] }[]
  songbooks: { songbook: Songbook; songs: Song[] }[]
  confessions: Confession[]
  catechisms: Catechism[]
  creeds: Creeds | null
}
