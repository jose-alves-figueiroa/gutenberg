/**
 * Liturgy items: a document (`collection`) plus a stable reference (`item_ref`), resolved on
 * demand so library edits apply to every liturgy (README → "Referência estável").
 *
 *   bible:ara        Hb:12 · Hb:12:14 · Hb:12:14-15
 *   songbook:<id>    song id (psalter-133B, hnc-155…)
 *   confession:<id>  <chapter>.<section> (1.1, 3/4.R1)
 *   catechism:<id>   question number
 *   creeds           apostles · nicene · athanasian
 */
import { bibleRefTitle, parseBibleItemRef } from '../../shared/bible-ref'
import { DEFAULT_COLLECTIONS } from '../../shared/collections'
import type { CreedId } from '../../shared/data-model'
import { lyricsToStanzas } from '../../shared/lyrics'
import type { SongCredits } from '../../shared/payload'
import { slidesOf, songHeader, type Slide } from '../../shared/slides'
import type { SqlDatabase } from '../db/schema'
import * as repo from './repository'

export interface ResolvedItem {
  collection: string
  itemRef: string
  title: string
  collectionLabel: string
  slides: Slide[]
  /** The referenced record no longer exists. */
  missing: boolean
  /** Songs only: credits sent to OBS (`$system_var_music_*`). */
  credits?: SongCredits
}

const MISSING_TITLE = '(item removido)'

export function parseCollection(collection: string): { kind: string; id: string } {
  const [kind, id = ''] = collection.split(':')
  return { kind, id }
}

function label(db: SqlDatabase, kind: string, id: string): string {
  const known = DEFAULT_COLLECTIONS.find((c) => c.kind === (kind === 'creeds' ? 'creeds' : kind) && c.id === (kind === 'creeds' ? 'creeds' : id))
  if (known) return known.title
  return repo.collections(db).find((c) => c.kind === kind && c.id === id)?.title ?? collection(kind, id)
}

const collection = (kind: string, id: string) => (id ? `${kind}:${id}` : kind)

export function resolveItem(db: SqlDatabase, coll: string, itemRef: string, max: number): ResolvedItem {
  const { kind, id } = parseCollection(coll)
  const base = { collection: coll, itemRef, collectionLabel: label(db, kind, id) }
  const missing = (title = MISSING_TITLE): ResolvedItem => ({ ...base, title, slides: [], missing: true })

  switch (kind) {
    case 'bible': {
      const ref = parseBibleItemRef(itemRef)
      if (!ref) return missing()
      const verses = repo
        .bibleChapter(db, id, ref.book, ref.chapter)
        .filter((v) => ref.from === undefined || (v.number >= ref.from && v.number <= (ref.to ?? ref.from)))
      if (verses.length === 0) return missing(bibleRefTitle(ref))
      return { ...base, title: bibleRefTitle(ref), slides: slidesOf({ kind: 'bible', item: { book: ref.book, chapter: ref.chapter, verses } }, max), missing: false }
    }
    case 'songbook': {
      const song = repo.song(db, itemRef)
      if (!song) return missing()
      const info = repo.songbook(db, song.songbookId).info
      const item = {
        format: 1 as const,
        id: song.id,
        songbook: song.songbookId,
        number: song.number,
        version: song.version,
        title: song.title,
        versification: song.versification,
        credits: { author: song.author, artist: song.artist, copyright: song.copyright },
        stanzas: lyricsToStanzas(song.lyrics),
        source: { name: 'db' }
      }
      const title = songHeader(info, item)
      return {
        ...base,
        title,
        slides: slidesOf({ kind: 'song', songbook: info, item }, max),
        missing: false,
        credits: { title, artist: song.artist, author: song.author, copyright: song.copyright }
      }
    }
    case 'confession': {
      const dot = itemRef.lastIndexOf('.')
      const chapter = itemRef.slice(0, dot)
      const section = itemRef.slice(dot + 1)
      const s = dot > 0 ? repo.confessionSection(db, id, chapter, section) : null
      const short = repo.collections(db).find((c) => c.kind === 'confession' && c.id === id)?.shortTitle ?? id.toUpperCase()
      if (!s) return missing()
      return {
        ...base,
        title: `${short} ${chapter}.${section} — ${s.chapterTitle}`,
        slides: slidesOf({ kind: 'confession', confession: { shortTitle: short }, chapter, item: { id: section, text: s.text } }, max),
        missing: false
      }
    }
    case 'catechism': {
      const number = Number(itemRef)
      const q = Number.isInteger(number) ? repo.catechismQuestion(db, id, number) : null
      if (!q) return missing()
      const short = repo.collections(db).find((c) => c.kind === 'catechism' && c.id === id)?.shortTitle ?? id
      return {
        ...base,
        title: `${short} · P. ${number}`,
        slides: slidesOf({ kind: 'catechism', catechism: { shortTitle: short }, item: { number, question: q.question, answer: q.answer } }, max),
        missing: false
      }
    }
    case 'creeds': {
      const c = repo.creeds(db).find((x) => x.id === itemRef)
      if (!c) return missing()
      return { ...base, title: c.title, slides: slidesOf({ kind: 'creed', item: { id: c.id as CreedId, title: c.title, text: c.text } }, max), missing: false }
    }
    default:
      return missing()
  }
}

export interface SearchResult {
  collection: string
  itemRef: string
  title: string
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Picker search inside one collection: number or title/text (README → Liturgia → picker). */
export function searchCollection(db: SqlDatabase, coll: string, query: string, limit = 40): SearchResult[] {
  const { kind, id } = parseCollection(coll)
  const q = fold(query.trim())
  const match = (...fields: string[]) => !q || fields.some((f) => fold(f).includes(q))
  const out: SearchResult[] = []
  if (kind === 'songbook') {
    const { info, songs } = repo.songbook(db, id)
    for (const s of songs) {
      const title = info.itemLabel && s.number ? `${info.itemLabel} ${s.number}${s.version}` : s.number ? `${s.number} · ${s.title}` : s.title
      if (match(`${s.number}${s.version}`, s.title, title)) out.push({ collection: coll, itemRef: s.id, title })
    }
  } else if (kind === 'catechism') {
    const index = repo.catechism(db, id)
    for (const qn of index.questions)
      if (!q || String(qn.number) === query.trim() || match(qn.question))
        out.push({ collection: coll, itemRef: String(qn.number), title: `${index.shortTitle} · P. ${qn.number} — ${qn.question}` })
  } else if (kind === 'confession') {
    const short = repo.collections(db).find((c) => c.kind === 'confession' && c.id === id)?.shortTitle ?? id
    for (const ch of repo.confessionChapters(db, id))
      for (const sec of ch.sections) {
        const ref = `${ch.chapter}.${sec}`
        if (!q || ref === query.trim() || ref.startsWith(`${query.trim()}.`) || match(ch.title))
          out.push({ collection: coll, itemRef: ref, title: `${short} ${ref} — ${ch.title}` })
      }
  } else if (kind === 'creeds') {
    for (const c of repo.creeds(db)) if (match(c.title)) out.push({ collection: 'creeds', itemRef: c.id, title: c.title })
  }
  return out.slice(0, limit)
}
