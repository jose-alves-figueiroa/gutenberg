/** `LibraryApi` over the repository — used by the IPC handler in the app and directly in tests. */
import type { LibraryApi } from '../../shared/library-api'
import type { SqlDatabase } from '../db/schema'
import * as repo from './repository'

export function createLibraryApi(db: SqlDatabase): LibraryApi {
  const p = <T>(fn: () => T) => Promise.resolve().then(fn)
  return {
    collections: () => p(() => repo.collections(db)),
    bibleBooks: (version) => p(() => repo.bibleBooks(db, version)),
    bibleChapter: (version, book, chapter) => p(() => repo.bibleChapter(db, version, book, chapter)),
    confessionChapters: (id) => p(() => repo.confessionChapters(db, id)),
    confessionSection: (id, chapter, section) => p(() => repo.confessionSection(db, id, chapter, section)),
    saveConfessionSection: (record) => p(() => repo.saveConfessionSection(db, record)),
    catechism: (id) => p(() => repo.catechism(db, id)),
    catechismQuestion: (id, number) => p(() => repo.catechismQuestion(db, id, number)),
    saveCatechismQuestion: (record) => p(() => repo.saveCatechismQuestion(db, record)),
    songbook: (id) => p(() => repo.songbook(db, id)),
    song: (id) => p(() => repo.song(db, id)),
    saveSong: (record) => p(() => repo.saveSong(db, record)),
    creeds: () => p(() => repo.creeds(db)),
    saveCreed: (record) => p(() => repo.saveCreed(db, record))
  }
}
