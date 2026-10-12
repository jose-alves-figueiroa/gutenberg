import { describe, expect, it } from 'vitest'
import { autobreak } from '@shared/autobreak'
import { BOOKS, bookName, COLLECTIONS, GROUPS } from '@shared/collections'
import { slidesOf, type BibleItem, type CatechismItem, type CfwItem, type CreedItem, type HymnItem, type PsalmItem } from '@shared/slides'
import { loadPrototype } from '../scripts/prototype.mjs'

const proto = loadPrototype()
const lib = proto.LIB0 as unknown as {
  biblia: { ab: string; ch: string; verses: { n: string; t: string }[] }[]
  breve: CatechismItem[]
  maior: CatechismItem[]
  cfw: CfwItem[]
  credos: (CreedItem & { id: string })[]
  salmos: (PsalmItem & { id: string })[]
  hnc: (HymnItem & { id: string })[]
}
const hb: BibleItem = { book: lib.biblia[0].ab, ch: lib.biblia[0].ch, verses: lib.biblia[0].verses }

describe('coleções', () => {
  it('livros e coleções iguais ao protótipo', () => {
    expect(BOOKS).toEqual(proto.BOOKS)
    expect(BOOKS).toHaveLength(66)
    expect(COLLECTIONS.map((c) => [c.key, c.label, c.kind, c.short, c.group, c.prefix])).toEqual(
      proto.COLS.map((c) => [c.k, c.label, c.kind, c.short, c.g, c.key])
    )
  })

  it('Bíblia sempre no topo dos grupos', () => {
    expect(GROUPS[0]).toBe('Bíblia')
    expect(COLLECTIONS[0].key).toBe('biblia')
  })

  it('nome do livro pela abreviação', () => {
    expect(bookName('Hb')).toBe('Hebreus')
    expect(bookName('1Co')).toBe('1 Coríntios')
    expect(() => bookName('Xx')).toThrow(/desconhecido/)
  })
})

describe('slidesOf — cabeçalhos por coleção', () => {
  it('Bíblia: "Hebreus 12.14" quando o versículo cabe numa tela', () => {
    const slides = slidesOf({ collection: 'biblia', item: hb }, 96)
    expect(slides[0].header).toBe('Hebreus 12.14')
  })

  it('Bíblia: Hb 12.15 recebe (i/n) quando ocupa várias telas', () => {
    const slides = slidesOf({ collection: 'biblia', item: hb }, 96).filter((s) => s.header.startsWith('Hebreus 12.15'))
    const n = autobreak(hb.verses[1].t, 96).length
    expect(n).toBeGreaterThan(1)
    expect(slides.map((s) => s.header)).toEqual(Array.from({ length: n }, (_, i) => `Hebreus 12.15 (${i + 1}/${n})`))
  })

  it('CFW: "CFW 1.1"', () => {
    const slides = slidesOf({ collection: 'cfw', item: lib.cfw[0] }, 96)
    expect(slides.length).toBe(autobreak(lib.cfw[0].text, 96).length)
    expect(new Set(slides.map((s) => s.header))).toEqual(new Set(['CFW 1.1']))
  })

  it('Catecismo: "· pergunta" na pergunta e só "P. n" na resposta', () => {
    const slides = slidesOf({ collection: 'breve', item: lib.breve[0] }, 96)
    expect(slides).toEqual([
      { header: 'Breve Catecismo · P. 1 · pergunta', lines: ['Qual é o fim principal do homem?'] },
      { header: 'Breve Catecismo · P. 1', lines: ['O fim principal do homem é glorificar a Deus,', 'e gozá-lo para sempre.'] }
    ])
    expect(slidesOf({ collection: 'maior', item: lib.maior[0] }, 96)[0].header).toBe('Catecismo Maior · P. 1 · pergunta')
  })

  it('Credo: o nome do credo', () => {
    const credo = lib.credos.find((c) => c.id === 'ca')!
    const slides = slidesOf({ collection: 'credos', item: credo }, 96)
    expect(slides.length).toBeGreaterThan(1)
    expect(new Set(slides.map((s) => s.header))).toEqual(new Set(['Credo Apostólico']))
  })

  it('Salmo: "Salmo 133B", uma estrofe por tela, sem autobreak', () => {
    const s133b = lib.salmos.find((s) => s.id === 's133b')!
    const slides = slidesOf({ collection: 'salmos', item: s133b }, 60)
    expect(slides).toHaveLength(4)
    expect(slides[0]).toEqual({ header: 'Salmo 133B', lines: ['Oh! Como é bom e agradável,', 'bem suave, sim,'] })
    expect(slidesOf({ collection: 'salmos', item: { num: 23, text: 'a\n\nb' } })[0].header).toBe('Salmo 23')
  })

  it('HNC: título (com número quando houver), uma estrofe por tela', () => {
    const h1 = lib.hnc.find((h) => h.id === 'h1')!
    const slides = slidesOf({ collection: 'hnc', item: h1 })
    expect(slides.map((s) => s.header)).toEqual(['Castelo forte', 'Castelo forte'])
    expect(slidesOf({ collection: 'hnc', item: { ...h1, num: 155 } })[0].header).toBe('155 · Castelo forte')
  })

  it('o limite muda o número de telas (exceto cânticos)', () => {
    const credo = lib.credos.find((c) => c.id === 'ca')!
    expect(slidesOf({ collection: 'credos', item: credo }, 160).length).toBeLessThan(slidesOf({ collection: 'credos', item: credo }, 60).length)
    const s133b = lib.salmos.find((s) => s.id === 's133b')!
    expect(slidesOf({ collection: 'salmos', item: s133b }, 60)).toEqual(slidesOf({ collection: 'salmos', item: s133b }, 160))
  })

  it('telas de texto corrido têm no máximo 2 linhas e nenhum HTML', () => {
    const all = [
      ...slidesOf({ collection: 'biblia', item: hb }),
      ...slidesOf({ collection: 'cfw', item: lib.cfw[0] }),
      ...lib.breve.flatMap((item) => slidesOf({ collection: 'breve', item })),
      ...lib.credos.flatMap((item) => slidesOf({ collection: 'credos', item }))
    ]
    for (const s of all) {
      expect(s.lines.length).toBeGreaterThanOrEqual(1)
      expect(s.lines.length).toBeLessThanOrEqual(2)
      expect(s.lines.join(' ')).not.toMatch(/<[a-z/]|&nbsp;/i)
    }
  })
})
