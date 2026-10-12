/**
 * Holyrics songs (API dump) → songbooks in the internal format.
 * Each song goes to a songbook by its title/artist:
 * - `Salmo 133B …` or artist "Comissão Brasileira de Salmodia" → `psalter` (number + version);
 * - a leading number (`155 - Castelo forte`, `HNC 155 …`) → `hnc`;
 * - anything else → `other` (reported, so the maintainer can review it).
 * Stanzas follow the Holyrics slide `order` (repeated choruses included); each slide is a stanza.
 */
import { toLine, toStanzas } from '../../../src/shared/clean'
import { DEFAULT_COLLECTIONS } from '../../../src/shared/collections'
import type { Song, Songbook } from '../../../src/shared/data-model'
import type { HolyricsLyrics } from '../holyrics-api'

export const PSALTER_ARTIST = 'Comissão Brasileira de Salmodia'

const songbookMeta = (id: string, itemLabel: string): Songbook => {
  const c = DEFAULT_COLLECTIONS.find((x) => x.kind === 'songbook' && x.id === id)!
  return { format: 1, id, title: c.title, shortTitle: c.shortTitle, prefix: c.prefix, itemLabel, source: { name: 'holyrics-api' } }
}

export const SONGBOOKS: Readonly<Record<'psalter' | 'hnc' | 'other', Songbook>> = {
  psalter: songbookMeta('psalter', 'Salmo'),
  hnc: songbookMeta('hnc', ''),
  other: { format: 1, id: 'other', title: 'Outros cânticos', shortTitle: 'Cântico', prefix: '', itemLabel: '', source: { name: 'holyrics-api' } }
}

export interface Classification {
  songbook: 'psalter' | 'hnc' | 'other'
  number: string
  version: string
  title: string
}

const PSALM = /^Salmo\s+(\d{1,3})\s*([A-Z])?\b\s*(?:[-–:.]\s*)?(.*)$/i
const NUMBERED = /^(?:HNC\s*)?(\d{1,3})\s*[-–.:)]\s*(.+)$/i

export function classify(title: string, artist = ''): Classification {
  const t = toLine(title)
  const psalm = PSALM.exec(t)
  if (psalm) {
    const [, number, version = ''] = psalm
    return { songbook: 'psalter', number, version: version.toUpperCase(), title: `Salmo ${number}${version.toUpperCase()}` }
  }
  if (toLine(artist) === PSALTER_ARTIST) return { songbook: 'psalter', number: '', version: '', title: t }
  const numbered = NUMBERED.exec(t)
  if (numbered) return { songbook: 'hnc', number: String(Number(numbered[1])), version: '', title: numbered[2].trim() }
  return { songbook: 'other', number: '', version: '', title: t }
}

/** Slides in presentation order: `order` (1-based, may repeat) when valid, else as stored. */
export function orderedSlides(song: HolyricsLyrics): string[] {
  const slides = song.slides ?? []
  const order = (song.order ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= slides.length)
  return (order.length > 0 ? order.map((n) => slides[n - 1]) : slides).map((s) => s.text)
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cantico'

export interface SongsTranslation {
  songbooks: { songbook: Songbook; songs: Song[] }[]
  notes: string[]
}

export function translateHolyricsSongs(raw: HolyricsLyrics[], { includeArchived = false } = {}): SongsTranslation {
  const notes: string[] = []
  const byBook = new Map<string, Song[]>(Object.keys(SONGBOOKS).map((id) => [id, []]))
  const usedIds = new Set<string>()

  for (const item of raw) {
    if (item.archived && !includeArchived) {
      notes.push(`skipped archived song "${item.title}"`)
      continue
    }
    const c = classify(item.title, item.artist)
    const stanzas = orderedSlides(item).flatMap(toStanzas)
    if (stanzas.length === 0) {
      notes.push(`song "${item.title}" (${item.id}) has no lyrics — skipped`)
      continue
    }
    let id = c.number ? `${c.songbook}-${c.number}${c.version}` : `${c.songbook}-${slug(c.title)}`
    if (usedIds.has(id)) {
      let n = 2
      while (usedIds.has(`${id}-${n}`)) n++
      notes.push(`duplicate ${id} ("${item.title}") stored as ${id}-${n}`)
      id = `${id}-${n}`
    }
    usedIds.add(id)
    byBook.get(c.songbook)!.push({
      format: 1,
      id,
      songbook: c.songbook,
      number: c.number,
      version: c.version,
      title: c.title,
      versification: '',
      credits: { author: toLine(item.author ?? ''), artist: toLine(item.artist ?? ''), copyright: toLine(item.copyright ?? '') },
      stanzas,
      source: { name: 'holyrics-api', id: item.id }
    })
  }

  const songbooks = [...byBook]
    .filter(([, songs]) => songs.length > 0)
    .map(([id, songs]) => ({
      songbook: SONGBOOKS[id as keyof typeof SONGBOOKS],
      songs: songs.sort((a, b) => Number(a.number || 9999) - Number(b.number || 9999) || a.version.localeCompare(b.version) || a.title.localeCompare(b.title, 'pt-BR'))
    }))
  return { songbooks, notes }
}
