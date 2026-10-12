/**
 * Library records exchanged over the local HTTP API (src/main/server). zod schemas are the single
 * source: the server validates with them and the types below are inferred from them.
 */
import { z } from 'zod'

const label = z.string().trim().min(1).max(16)
const text = z.string().max(20_000)

export const ConfessionSectionBody = z.object({ chapterTitle: z.string().max(300), text, refs: z.string().max(2_000) })
export const CatechismQuestionBody = z.object({ question: text, answer: text, refs: z.string().max(2_000) })
export const SongBody = z.object({
  id: z.string().max(80),
  songbookId: z.string().min(1).max(40),
  number: z.string().max(20),
  version: z.string().max(4),
  title: z.string().max(300),
  versification: z.string().max(300),
  author: z.string().max(500),
  artist: z.string().max(500),
  copyright: z.string().max(500),
  lyrics: text
})
export const CreedBody = z.object({ title: z.string().min(1).max(300), text })

export const LibraryParams = {
  version: z.object({ version: z.string().regex(/^[a-z]{2,8}$/i) }),
  chapter: z.object({ version: z.string().regex(/^[a-z]{2,8}$/i), book: z.string().min(1).max(4), chapter: z.coerce.number().int().min(1).max(150) }),
  doc: z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/) }),
  section: z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), chapter: label, section: label }),
  question: z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), number: z.coerce.number().int().min(1).max(999) }),
  song: z.object({ id: z.string().min(1).max(80) }),
  creed: z.object({ id: z.enum(['apostles', 'nicene', 'athanasian']) })
}

export type ConfessionSectionRecord = z.infer<typeof ConfessionSectionBody> & { confessionId: string; chapter: string; section: string }
export type CatechismQuestionRecord = z.infer<typeof CatechismQuestionBody> & { catechismId: string; number: number }
export type SongRecord = z.infer<typeof SongBody>
export type CreedRecord = z.infer<typeof CreedBody> & { id: string }

export interface CollectionSummary {
  kind: 'bible' | 'songbook' | 'creeds' | 'confession' | 'catechism'
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
  testament: 'OT' | 'NT'
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

export interface CatechismIndex {
  id: string
  title: string
  shortTitle: string
  /** Questions the catechism should have (requirements), or the highest registered number. */
  size: number
  questions: { number: number; question: string }[]
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
