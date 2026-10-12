import { describe, expect, it } from 'vitest'
import { slidesOf } from '@shared/slides'
import { validateSong } from '@shared/validate'
import { cleanVerse, HNC_COPYRIGHT, hymnOrder, parseHymnXml } from '../scripts/lib/translate/hymnal'

const hymn = (inner: string, attrs = '') => `<?xml version="1.0" encoding="UTF-8"?><hino${attrs}>${inner}</hino>`

describe('Hinário Novo Cântico XML', () => {
  // Chorus printed once in stanza 1 and replaced in stanza 3; scripture among origem_letra; a
  // stanza number inside the text; an "incompleto" flag (site metadata, not lyrics).
  const xml = hymn(
    `<numero>014</numero><n>14</n><titulo>Louvor e Exaltação</titulo>
     <texto>
       <estrofe><verso>1 Vamos nós louvar a Deus,</verso><verso>Ao Senhor  de toda a luz.</verso>
         <coro><verso>Exaltado seja Deus!</verso></coro></estrofe>
       <estrofe><verso>Nosso Deus, eterno Pai,</verso></estrofe>
       <estrofe><verso>Exaltemos nosso Deus,</verso><coro><verso>Aleluia &amp; amém!</verso></coro></estrofe>
     </texto>
     <secao id="01">Louvor</secao>
     <origem_letra>Sl 145.17,18</origem_letra><origem_letra>T. Ken</origem_letra><origem_letra>G. Silveira (trad.)</origem_letra>
     <origem_musica id="X" referencia="Stainer, John">John Stainer</origem_musica>`,
    ' situacao="incompleto"'
  )
  const { song, notes } = parseHymnXml(xml)

  it('repeats the latest chorus after each stanza, in presentation order', () => {
    expect(song.stanzas).toEqual([
      ['Vamos nós louvar a Deus,', 'Ao Senhor de toda a luz.'],
      ['Exaltado seja Deus!'],
      ['Nosso Deus, eterno Pai,'],
      ['Exaltado seja Deus!'],
      ['Exaltemos nosso Deus,'],
      ['Aleluia & amém!']
    ])
    expect(notes).toEqual([])
  })

  it('maps number, title, credits and scripture origin', () => {
    expect(song).toMatchObject({
      id: 'hnc-14', number: '14', title: 'Louvor e Exaltação', versification: 'Sl 145.17,18',
      credits: { author: 'T. Ken / G. Silveira (trad.)', artist: 'John Stainer', copyright: HNC_COPYRIGHT },
      source: { name: 'novocantico', id: '014' }
    })
    expect(validateSong(song)).toEqual([])
  })

  it('appendix hymns use their letter as number and take referencia_biblica', () => {
    const { song: a } = parseHymnXml(hymn(
      `<numero>A</numero><titulo>Ofertório</titulo><texto><estrofe><verso>Tudo vem de ti Senhor</verso></estrofe></texto>
       <referencia_biblica id="13_029_014">1 Crônicas 29.14</referencia_biblica>`
    ))
    expect([a.id, a.number, a.versification]).toEqual(['hnc-A', 'A', '1 Crônicas 29.14'])
  })

  it('reports a hymn without lyrics and refuses one without number', () => {
    expect(parseHymnXml(hymn('<n>9</n><titulo>Vazio</titulo><texto></texto>')).notes).toEqual(['hymn 9: no lyrics'])
    expect(() => parseHymnXml(hymn('<titulo>Sem número</titulo>'))).toThrow(/without/)
  })

  it('sorts numbered hymns before appendices and renders "14 · Título" headers', () => {
    const s = (number: string) => ({ ...song, number })
    expect([s('B'), s('10'), s('A'), s('2')].sort(hymnOrder).map((x) => x.number)).toEqual(['2', '10', 'A', 'B'])
    expect(slidesOf({ kind: 'song', songbook: { itemLabel: '' }, item: song })[0].header).toBe('14 · Louvor e Exaltação')
  })

  it('cleanVerse removes only a leading stanza number before a capital letter', () => {
    expect(cleanVerse('3 A Deus eu louvarei')).toBe('A Deus eu louvarei')
    expect(cleanVerse('1º de janeiro')).toBe('1º de janeiro')
  })
})
