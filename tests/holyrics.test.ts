import { describe, expect, it } from 'vitest'
import { slidesOf } from '@shared/slides'
import { validateSong, validateSongbook } from '@shared/validate'
import { dumpSongs, holyricsClient, type HolyricsLyrics } from '../scripts/lib/holyrics-api'
import { classify, orderedSlides, PSALTER_ARTIST, translateHolyricsSongs } from '../scripts/lib/translate/holyrics-songs'

const song = (over: Partial<HolyricsLyrics>): HolyricsLyrics => ({ id: '1', title: 'x', slides: [{ text: 'a' }], ...over })

describe('classify', () => {
  it('psalter: "Salmo 133B" with or without suffix text, version uppercased', () => {
    expect(classify('Salmo 133B')).toEqual({ songbook: 'psalter', number: '133', version: 'B', title: 'Salmo 133B' })
    expect(classify('Salmo 133c - Oh! Como é bom')).toEqual({ songbook: 'psalter', number: '133', version: 'C', title: 'Salmo 133C' })
    expect(classify('Salmo 23')).toEqual({ songbook: 'psalter', number: '23', version: '', title: 'Salmo 23' })
  })

  it('psalter by artist when the title has no number', () => {
    expect(classify('Cântico de Simeão', PSALTER_ARTIST)).toMatchObject({ songbook: 'psalter', title: 'Cântico de Simeão' })
  })

  it('HNC: leading number, with or without the "HNC" prefix', () => {
    expect(classify('155 - Castelo forte')).toEqual({ songbook: 'hnc', number: '155', version: '', title: 'Castelo forte' })
    expect(classify('HNC 007. Santo! Santo! Santo!')).toEqual({ songbook: 'hnc', number: '7', version: '', title: 'Santo! Santo! Santo!' })
  })

  it('anything else goes to "other"', () => {
    expect(classify('Grandioso és Tu')).toEqual({ songbook: 'other', number: '', version: '', title: 'Grandioso és Tu' })
  })
})

describe('orderedSlides', () => {
  const s = song({ slides: [{ text: 'v1' }, { text: 'coro' }, { text: 'v2' }] })
  it('follows the Holyrics order, repeating the chorus', () => {
    expect(orderedSlides({ ...s, order: '1,2,3,2' })).toEqual(['v1', 'coro', 'v2', 'coro'])
  })
  it('falls back to stored order when "order" is missing or invalid', () => {
    expect(orderedSlides(s)).toEqual(['v1', 'coro', 'v2'])
    expect(orderedSlides({ ...s, order: '9,x' })).toEqual(['v1', 'coro', 'v2'])
  })
})

describe('translateHolyricsSongs', () => {
  const raw: HolyricsLyrics[] = [
    song({ id: 'a', title: 'Salmo 133B', artist: PSALTER_ARTIST, slides: [{ text: 'Oh! Como é bom e agradável, \nbem suave, sim,' }, { text: '<b>quando</b> os irmãos\n\nem harmonia' }] }),
    song({ id: 'b', title: '155 - Castelo forte', author: 'Martinho Lutero', copyright: '© HNC', slides: [{ text: 'Castelo forte' }] }),
    song({ id: 'c', title: 'Grandioso és Tu', slides: [{ text: 'Senhor meu Deus' }] }),
    song({ id: 'd', title: 'Grandioso és Tu', slides: [{ text: 'outra versão' }] }),
    song({ id: 'e', title: 'Arquivada', archived: true }),
    song({ id: 'f', title: 'Vazia', slides: [{ text: '  ' }] })
  ]
  const { songbooks, notes } = translateHolyricsSongs(raw)
  const book = (id: string) => songbooks.find((b) => b.songbook.id === id)!

  it('groups songs by songbook with ids, credits and source', () => {
    expect(songbooks.map((b) => [b.songbook.id, b.songs.length])).toEqual([['psalter', 1], ['hnc', 1], ['other', 2]])
    expect(book('hnc').songs[0]).toMatchObject({
      id: 'hnc-155', number: '155', title: 'Castelo forte',
      credits: { author: 'Martinho Lutero', artist: '', copyright: '© HNC' }, source: { name: 'holyrics-api', id: 'b' }
    })
  })

  it('cleans slides into stanzas (a blank line inside a slide splits it)', () => {
    expect(book('psalter').songs[0].stanzas).toEqual([['Oh! Como é bom e agradável,', 'bem suave, sim,'], ['quando os irmãos'], ['em harmonia']])
  })

  it('keeps duplicates apart, skips archived and empty songs, and says so', () => {
    expect(book('other').songs.map((s) => s.id)).toEqual(['other-grandioso-es-tu', 'other-grandioso-es-tu-2'])
    expect(notes).toEqual([
      'duplicate other-grandioso-es-tu ("Grandioso és Tu") stored as other-grandioso-es-tu-2',
      'skipped archived song "Arquivada"',
      'song "Vazia" (f) has no lyrics — skipped'
    ])
  })

  it('produces valid documents whose slides read "Salmo 133B"', () => {
    for (const { songbook, songs } of songbooks) {
      expect(validateSongbook(songbook)).toEqual([])
      for (const s of songs) expect(validateSong(s)).toEqual([])
    }
    expect(slidesOf({ kind: 'song', songbook: book('psalter').songbook, item: book('psalter').songs[0] })[0].header).toBe('Salmo 133B')
  })
})

describe('Holyrics API client', () => {
  const calls: { url: string; body: unknown }[] = []
  const fakeFetch = async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) })
    const action = new URL(url).pathname.split('/').pop()
    const data =
      action === 'GetSongs' ? [{ id: '1', title: 'Salmo 1' }, { id: '2', title: 'Salmo 2' }]
      : action === 'GetLyrics' ? { id: (JSON.parse(init.body) as { id: string }).id, title: 't', slides: [{ text: 'x' }] }
      : null
    return { ok: true, status: 200, json: async () => (data ? { status: 'ok', data } : { status: 'error', error: 'unknown action' }) }
  }

  it('lists songs then fetches each with its slides, passing the token', async () => {
    calls.length = 0
    const songs = await dumpSongs(holyricsClient('http://192.168.0.10:8091/', 'se/cret', fakeFetch))
    expect(songs.map((s) => s.id)).toEqual(['1', '2'])
    expect(calls.map((c) => c.url)).toEqual([
      'http://192.168.0.10:8091/api/GetSongs?token=se%2Fcret',
      'http://192.168.0.10:8091/api/GetLyrics?token=se%2Fcret',
      'http://192.168.0.10:8091/api/GetLyrics?token=se%2Fcret'
    ])
    expect(calls[1].body).toEqual({ id: '1' })
  })

  it('surfaces API and HTTP errors', async () => {
    await expect(holyricsClient('http://x', 't', fakeFetch)('Nope')).rejects.toThrow(/Holyrics Nope: "unknown action"/)
    const down = async () => ({ ok: false, status: 401, json: async () => ({}) })
    await expect(holyricsClient('http://x', 't', down)('GetSongs')).rejects.toThrow(/HTTP 401/)
  })
})
