import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { validateBibleBook, validateBibleMeta } from '@shared/validate'
import { translateOpenLpBible } from '../scripts/lib/translate/openlp'

/** A synthetic OpenLP database: Genesis 1.1–2, 2.1 and Hebrews 1.1, with Holyrics-style noise. */
function openLp(verses: [number, number, number, string][], books: [number, number, string][] = [
  [1, 1, 'Gênesis'],
  [2, 58, 'Hebreus']
]) {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE book (id INTEGER, book_reference_id INTEGER, testament_reference_id INTEGER, name TEXT);
    CREATE TABLE verse (id INTEGER, book_id INTEGER, chapter INTEGER, verse INTEGER, text TEXT);
    CREATE TABLE metadata (key TEXT, value TEXT);
    INSERT INTO metadata VALUES ('name', 'TST'), ('copyright', 'Versão de Teste - 2024');
  `)
  const b = db.prepare('INSERT INTO book VALUES (?, ?, ?, ?)')
  for (const [id, ref, name] of books) b.run(id, ref, ref <= 39 ? 1 : 2, name)
  const v = db.prepare('INSERT INTO verse (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)')
  for (const row of verses) v.run(...row)
  return db
}

const SAMPLE: [number, number, number, string][] = [
  [1, 1, 1, 'No princípio,\n criou Deus&nbsp;os céus.'],
  [1, 1, 2, 'A terra era sem forma.'],
  [1, 2, 1, 'Assim, pois, foram acabados.'],
  [2, 1, 1, '<i>Havendo</i> Deus, outrora, falado.']
]

describe('translateOpenLpBible', () => {
  it('maps book_reference_id to our abbreviations and builds chapters[c-1][v-1]', () => {
    const { meta, books, notes } = translateOpenLpBible(openLp(SAMPLE), 'TST', 'test.sqlite')
    expect(meta).toEqual({
      format: 1, code: 'TST', name: 'Versão de Teste', copyright: 'Versão de Teste - 2024',
      source: { name: 'openlp', id: 'test.sqlite' }
    })
    expect(books.map((b) => [b.book, b.order, b.testament])).toEqual([['Gn', 1, 'OT'], ['Hb', 58, 'NT']])
    expect(books[0].chapters).toEqual([['No princípio, criou Deus os céus.', 'A terra era sem forma.'], ['Assim, pois, foram acabados.']])
    expect(notes).toEqual([])
  })

  it('cleans the text so it passes the validators', () => {
    const { meta, books } = translateOpenLpBible(openLp(SAMPLE), 'TST', 'test.sqlite')
    expect(books[1].chapters[0][0]).toBe('Havendo Deus, outrora, falado.')
    expect(validateBibleMeta(meta)).toEqual([])
    for (const b of books) expect(validateBibleBook(b, b.book)).toEqual([])
  })

  it('notes book names that differ from BOOKS without failing', () => {
    const { notes } = translateOpenLpBible(openLp(SAMPLE, [[1, 1, 'Genesis'], [2, 58, 'Hebreus']]), 'TST', 'x')
    expect(notes).toEqual(['book 1: source name "Genesis" ≠ "Gênesis"'])
  })

  it('rejects gaps in verse numbering and missing chapters', () => {
    expect(() => translateOpenLpBible(openLp([[1, 1, 1, 'a'], [1, 1, 3, 'c']]), 'TST', 'x')).toThrow(/Gn 1.3: verse numbering/)
    expect(() => translateOpenLpBible(openLp([[1, 1, 1, 'a'], [1, 3, 1, 'c']]), 'TST', 'x')).toThrow(/Gn: missing chapters/)
  })

  it('rejects book references outside the 66-book canon', () => {
    expect(() => translateOpenLpBible(openLp(SAMPLE, [[1, 67, 'Tobias']]), 'TST', 'x')).toThrow(/outside 1–66/)
  })
})
