/**
 * Contract between the renderer (Library UI) and the main process (SQLite). The renderer only
 * sees this interface: in the app it is the preload bridge (`window.gutenberg.library`), in tests
 * an in-process implementation over the same repository.
 */
import type { CollectionKind } from './collections'
import type { Testament } from './data-model'

export interface CollectionSummary {
  kind: CollectionKind
  id: string
  title: string
  shortTitle: string
  prefix: string
  /** Books for the Bible; songs, sections, questions or creeds for the others. */
  count: number
}

export interface BibleBookSummary {
  book: string
  name: string
  testament: Testament
  chapters: number
}

export interface VerseRecord {
  number: number
  text: string
}

export interface ConfessionChapterSummary {
  chapter: string
  title: string
  /** Section labels registered in the database, in order. */
  sections: string[]
  /** Sections the chapter should have (requirements), or null when unknown. */
  expected: number | null
}

export interface ConfessionSectionRecord {
  confessionId: string
  chapter: string
  chapterTitle: string
  section: string
  text: string
  refs: string
}

export interface CatechismIndex {
  id: string
  title: string
  shortTitle: string
  /** Questions the catechism should have (requirements), or the highest registered number. */
  size: number
  questions: { number: number; question: string }[]
}

export interface CatechismQuestionRecord {
  catechismId: string
  number: number
  question: string
  answer: string
  refs: string
}

export interface SongbookInfo {
  id: string
  title: string
  shortTitle: string
  prefix: string
  itemLabel: string
}

export interface SongSummary {
  id: string
  number: string
  version: string
  title: string
  author: string
  firstLine: string
}

export interface SongRecord {
  /** Empty for a song not yet saved. */
  id: string
  songbookId: string
  number: string
  version: string
  title: string
  versification: string
  author: string
  artist: string
  copyright: string
  /** Stanzas separated by a blank line, lines by a line break. */
  lyrics: string
}

export interface CreedRecord {
  id: string
  title: string
  text: string
}

export interface LibraryApi {
  collections(): Promise<CollectionSummary[]>
  bibleBooks(version: string): Promise<BibleBookSummary[]>
  bibleChapter(version: string, book: string, chapter: number): Promise<VerseRecord[]>
  confessionChapters(confessionId: string): Promise<ConfessionChapterSummary[]>
  confessionSection(confessionId: string, chapter: string, section: string): Promise<ConfessionSectionRecord | null>
  /** Creates or updates the section (edits apply to every liturgy). */
  saveConfessionSection(record: ConfessionSectionRecord): Promise<void>
  catechism(catechismId: string): Promise<CatechismIndex>
  catechismQuestion(catechismId: string, number: number): Promise<CatechismQuestionRecord | null>
  saveCatechismQuestion(record: CatechismQuestionRecord): Promise<void>
  songbook(songbookId: string): Promise<{ info: SongbookInfo; songs: SongSummary[] }>
  song(songId: string): Promise<SongRecord | null>
  /** Creates (empty `id`) or updates a song; returns the stored record. */
  saveSong(record: SongRecord): Promise<SongRecord>
  creeds(): Promise<CreedRecord[]>
  saveCreed(record: CreedRecord): Promise<void>
}

/** Method names, used by the IPC bridge to allow-list calls. */
export const LIBRARY_METHODS = [
  'collections',
  'bibleBooks',
  'bibleChapter',
  'confessionChapters',
  'confessionSection',
  'saveConfessionSection',
  'catechism',
  'catechismQuestion',
  'saveCatechismQuestion',
  'songbook',
  'song',
  'saveSong',
  'creeds',
  'saveCreed'
] as const satisfies readonly (keyof LibraryApi)[]

export type LibraryMethod = (typeof LIBRARY_METHODS)[number]
