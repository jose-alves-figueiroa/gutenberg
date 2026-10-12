import { describe, expect, it } from 'vitest'
import { slidesOf } from '@shared/slides'
import { validateSong } from '@shared/validate'
import { cleanLyricLine, parseAuthorLine, parseDocumentXml, parsePsalter } from '../scripts/lib/translate/psalter'

const p = (style: string, ...runs: string[]) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${runs.map((r) => (r === '<br>' ? '<w:r><w:br/></w:r>' : `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`)).join('')}</w:p>`

// Mirrors letras.docx: NBSP in titles, author lines (with/without suffix, Body2 style), both
// stanza-number styles, verse numbers and ranges inside lines, `_` elisions, Psalm 119 parts and a
// canticle with its Scripture reference.
const xml = [
  p('Ttulo1', 'Salmo 1A '),
  p('Autoremelodia', '(CBS - Saltério de Genebra)'),
  p('Numeraodeestrofe', '1'),
  p('', '1 Quão bem-aventurado é_o varão'),
  p('', 'Dizendo:_3 “Os laços seus', '<br>', '4-5 É vero o meu andar:'),
  p('Numeraaodeestrofe', '2'),
  p('', 'Açoito a transgressão, 33-34 mas sem tirar bondade!'),
  p('Ttulo1', 'Salmo 119.1-8A'),
  p('Body2', '(Lucas Freire / Vítor Olivier)'),
  p('Numeraodeestrofe', '1'),
  p('', '1 Felizes os de caminho reto'),
  p('Ttulo1', 'O cântico de Simeão'),
  p('TextoBblico', 'Lucas 2.29-32'),
  p('Autoremelodia', '(Vítor Olivier - Saltério de Genebra)'),
  p('Numeraodeestrofe', '1'),
  p('', '29 Agora, Senhor, despedes'),
  p('', '30 Teu servo em paz')
].join('')

describe('Saltério de Genebra docx', () => {
  const { songs, notes } = parsePsalter(parseDocumentXml(`<w:document><w:body>${xml}</w:body></w:document>`))

  it('reads titles, numbers, versions and Psalm 119 parts', () => {
    expect(songs.map((s) => [s.id, s.number, s.version, s.title])).toEqual([
      ['psalter-1A', '1', 'A', 'Salmo 1A'],
      ['psalter-119.1-8A', '119.1-8', 'A', 'Salmo 119.1-8A'],
      ['psalter-o-cantico-de-simeao', '', '', 'O cântico de Simeão']
    ])
    expect(notes).toEqual([])
  })

  it('cleans lines: verse numbers and ranges removed, elisions become spaces, <br> splits lines', () => {
    expect(songs[0].stanzas).toEqual([
      ['Quão bem-aventurado é o varão', 'Dizendo: “Os laços seus', 'É vero o meu andar:'],
      ['Açoito a transgressão, mas sem tirar bondade!']
    ])
  })

  it('keeps credits, the CC0 notice and the canticle reference', () => {
    expect(songs[0].credits).toEqual({ author: 'Comissão Brasileira de Salmodia', artist: '', copyright: 'CC0 1.0 — salteriodegenebra.com.br' })
    expect(songs[1].credits.author).toBe('Lucas Freire / Vítor Olivier')
    expect(songs[2].versification).toBe('Lucas 2.29-32')
    for (const s of songs) expect(validateSong(s)).toEqual([])
  })

  it('headers read like the source titles', () => {
    const psalter = { itemLabel: 'Salmo' }
    expect(slidesOf({ kind: 'song', songbook: psalter, item: songs[1] })[0].header).toBe('Salmo 119.1-8A')
    expect(slidesOf({ kind: 'song', songbook: psalter, item: songs[2] })[0].header).toBe('O cântico de Simeão')
  })

  it('helpers', () => {
    expect(parseAuthorLine('(LFG / Vítor Olivier - Saltério de Genebra)')).toBe('LFG / Vítor Olivier')
    expect(parseAuthorLine('Não é autoria')).toBeNull()
    expect(cleanLyricLine('E_em dia_e noite')).toBe('E em dia e noite')
  })
})
