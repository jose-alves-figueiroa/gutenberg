/**
 * Reads and writes data/canonical/ (layout in docs/DATA.md). Missing folders load as empty:
 * completeness is `data:check`'s job, structure is the validators' job.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BibleBook, BibleVersionMeta, CanonicalData, Catechism, Confession, Creeds, Song, Songbook } from '../../src/shared/data-model'
import {
  validateBibleBook,
  validateBibleMeta,
  validateCatechism,
  validateConfession,
  validateCreeds,
  validateSong,
  validateSongbook
} from '../../src/shared/validate'

export const DEFAULT_CANONICAL_DIR = join(import.meta.dirname, '..', '..', 'data', 'canonical')

const GITCRYPT_HEADER = Buffer.from('\0GITCRYPT\0')

/** True when the data is still encrypted (repository not unlocked with `npm run data:unlock`). */
export function isLocked(dir: string): boolean {
  const probe = join(dir, '.gitcrypt-check.json')
  if (!existsSync(probe)) return false
  return readFileSync(probe).subarray(0, GITCRYPT_HEADER.length).equals(GITCRYPT_HEADER)
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))
const jsonFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [])
const subdirs = (dir: string) =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []

/** Writes pretty JSON with a trailing newline, creating folders as needed. */
export function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

export interface LoadResult {
  data: CanonicalData
  /** Structural problems, prefixed with the file they came from. */
  problems: string[]
}

export function loadCanonical(dir: string = DEFAULT_CANONICAL_DIR): LoadResult {
  if (isLocked(dir)) throw new Error(`${dir} is encrypted — run \`npm run data:unlock\` first`)
  const problems: string[] = []
  const load = <T>(file: string, validate: (v: unknown, where: string) => string[]): T => {
    const rel = file.slice(dir.length + 1)
    const value = readJson(file)
    problems.push(...validate(value, rel))
    return value as T
  }

  const bibles = subdirs(join(dir, 'bible')).map((code) => {
    const base = join(dir, 'bible', code)
    const meta = load<BibleVersionMeta>(join(base, 'meta.json'), validateBibleMeta)
    const books = jsonFiles(base)
      .filter((f) => f !== 'meta.json')
      .map((f) => load<BibleBook>(join(base, f), validateBibleBook))
      .sort((a, b) => a.order - b.order)
    return { meta, books }
  })

  const songbooks = subdirs(join(dir, 'songbooks')).map((id) => {
    const base = join(dir, 'songbooks', id)
    const songbook = load<Songbook>(join(base, 'songbook.json'), validateSongbook)
    if (songbook.id !== id) problems.push(`songbooks/${id}: id "${songbook.id}" does not match its folder`)
    const songs = jsonFiles(join(base, 'songs')).map((f) => {
      const song = load<Song>(join(base, 'songs', f), validateSong)
      if (song.songbook !== id) problems.push(`songbooks/${id}/songs/${f}: songbook "${song.songbook}" does not match`)
      return song
    })
    return { songbook, songs }
  })

  const confessions = jsonFiles(join(dir, 'confessions')).map((f) => load<Confession>(join(dir, 'confessions', f), validateConfession))
  const catechisms = jsonFiles(join(dir, 'catechisms')).map((f) => load<Catechism>(join(dir, 'catechisms', f), validateCatechism))
  const creedsFile = join(dir, 'creeds.json')
  const creeds = existsSync(creedsFile) ? load<Creeds>(creedsFile, validateCreeds) : null

  return { data: { bibles, songbooks, confessions, catechisms, creeds }, problems }
}
