import { describe, expect, it } from 'vitest'
import { fromRoman, htmlToLines, isRefsLine, parseConfessionLines, WCF_TITLES } from '../scripts/lib/translate/confession'
import { loadPrototype } from '../scripts/prototype.mjs'

// Mirrors the IP Aliança (Wix) page: intro text, chapter headings, an all-caps title, the book
// list in 1.2 (with "III João" that must not open a section), sections written `V .` / `IV Pela`,
// reference typos, a chapter beyond 33 and the site footer.
const html = `
<h1>Confissão de Fé de Westminster</h1><p>Introdução.</p>
<p>CAPÍTULO I</p><h2>DA ESCRITURA SAGRADA</h2>
<p>I. Ainda que a luz da natureza&nbsp;manifeste a bondade de Deus.</p>
<p>Sal. 19: 1-4; Rom. 1: 32.</p>
<p>II. Incluem-se os seguintes livros:</p>
<p>O VELHO TESTAMENTO</p><p>Gênesis</p><p>Êxodo</p><p>O NOVO TESTAMENTO</p><p>Mateus</p><p>II João</p><p>III João</p>
<p>Ef. 2:20; Apoc. 22:18-19.</p>
<p>III. Os livros apócrifos não são inspirados.</p><p>Luc. 24:27,44.</p>
<p>CAPÍTULO II</p><p>DE DEUS E DA SANTÍSSIMA TRINDADE</p>
<p>I . Há um só Deus vivo e verdadeiro.</p><p>João I5:4-6; Mat.l6:19, e 18:17.</p>
<p>II Ele é todo suficiente em si e para si, não precisando de nenhuma das criaturas.</p><p>Exo. 21, e 22:1-29.</p>
<p>CAPÍTULO III</p><p>DO ESPÍRITO SANTO</p>
<p>I. O Espírito Santo é a terceira pessoa.</p><p>Mt.3:16-17.</p>
<p>Sobre Nós</p><p>Rua Dr. Enéas, 232</p>`

describe('Westminster Confession page', () => {
  const lines = htmlToLines(html)
  const { chapters, notes } = parseConfessionLines(lines)

  it('reads chapters, sections and references', () => {
    expect(chapters.map((c) => [c.id, c.sections.map((s) => s.id)])).toEqual([
      ['1', ['1', '2', '3']],
      ['2', ['1', '2']],
      ['3', ['1']]
    ])
    expect(chapters[0].sections[0]).toEqual({ id: '1', text: 'Ainda que a luz da natureza manifeste a bondade de Deus.', refs: 'Sal. 19: 1-4; Rom. 1: 32.' })
  })

  it('uses the app titles for known chapters and sentence case otherwise', () => {
    expect(chapters[0].title).toBe('Da Escritura Sagrada')
    expect(chapters[1].title).toBe('De Deus e da Santíssima Trindade')
    expect(chapters[2].title).toBe('Do espírito santo')
    expect(notes).toEqual(['chapter 3: title "DO ESPÍRITO SANTO" ≠ "Dos Eternos Decretos de Deus" — using "Do espírito santo"'])
  })

  it('joins the 1.2 book list without mistaking "III João" for a section', () => {
    expect(chapters[0].sections[1].text).toBe(
      'Incluem-se os seguintes livros: O velho testamento: Gênesis, Êxodo. O novo testamento: Mateus, II João, III João.'
    )
    expect(chapters[0].sections[1].refs).toBe('Ef. 2:20; Apoc. 22:18-19.')
  })

  it('accepts "I ." and "IV Pela" section markers and tolerant references', () => {
    expect(chapters[1].sections[0].refs).toBe('João I5:4-6; Mat.l6:19, e 18:17.')
    expect(chapters[1].sections[1].text).toMatch(/^Ele é todo suficiente/)
    expect(chapters[1].sections[1].refs).toBe('Exo. 21, e 22:1-29.')
  })

  it('stops at the site footer', () => {
    expect(lines).toContain('Rua Dr. Enéas, 232')
    expect(JSON.stringify(chapters)).not.toMatch(/Enéas/)
  })

  it('helpers: roman numerals and reference lines', () => {
    expect([fromRoman('I'), fromRoman('IV'), fromRoman('IX'), fromRoman('XXXIII')]).toEqual([1, 4, 9, 33])
    expect(isRefsLine('I Cor. 10: 1-4.')).toBe(true)
    expect(isRefsLine('At. 10-47, e 8:36-38; Mat. 28:19.')).toBe(true)
    expect(isRefsLine('Gênesis')).toBe(false)
    expect(isRefsLine('III João')).toBe(false)
    expect(isRefsLine('Os sacramentos são santos sinais.')).toBe(false)
  })

  it('app chapter titles match the prototype', () => {
    expect(WCF_TITLES).toEqual(loadPrototype().CFW_T.slice(1))
  })
})
