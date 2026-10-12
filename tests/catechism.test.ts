import { describe, expect, it } from 'vitest'
import { validateCatechism } from '@shared/validate'
import { catechismDocument, translateGistCatechism } from '../scripts/lib/translate/catechism'
import { applySupplement, joinWrapped, parseLargerCatechismText } from '../scripts/lib/translate/catechism-pdf'

describe('translateGistCatechism (shorter catechism gist)', () => {
  const items = [
    { numero: '1', pergunta: 'Qual é o fim\nprincipal do homem?', resposta: 'Glorificar a Deus.', refs: 'Rm 11.36;  1Co 10.31.' },
    { numero: 'O que proíbe o décimo mandamento?', pergunta: null, resposta: 'Todo descontentamento.', refs: 'Hb 13.5.' },
    { numero: '7', pergunta: 'Terceira?', resposta: 'Resposta.', refs: null }
  ]

  it('numbers by position, recovers a question stored in "numero", cleans text', () => {
    const { questions, notes } = translateGistCatechism(items)
    expect(questions).toEqual([
      { number: 1, question: 'Qual é o fim principal do homem?', answer: 'Glorificar a Deus.', refs: 'Rm 11.36; 1Co 10.31.' },
      { number: 2, question: 'O que proíbe o décimo mandamento?', answer: 'Todo descontentamento.', refs: 'Hb 13.5.' },
      { number: 3, question: 'Terceira?', answer: 'Resposta.' }
    ])
    expect(notes).toEqual(['Q2: question recovered from the "numero" field', 'Q3: source numbers it 7'])
  })

  it('fails loudly on an item without question or answer', () => {
    expect(() => translateGistCatechism([{ numero: '1', pergunta: null, resposta: 'x' }])).toThrow(/Q1: no question/)
    expect(() => translateGistCatechism([{ numero: '1', pergunta: 'P?', resposta: null }])).toThrow(/Q1: no answer/)
  })

  it('builds a valid document with the shipped metadata', () => {
    const doc = catechismDocument('wsc', translateGistCatechism(items).questions, { name: 'gist', id: 'wsc.json' })
    expect(doc).toMatchObject({ id: 'wsc', title: 'Breve Catecismo de Westminster', shortTitle: 'Breve Catecismo', prefix: 'bc' })
    expect(validateCatechism(doc)).toEqual([])
    expect(() => catechismDocument('heidelberg', [], { name: 'x' })).toThrow(/unknown catechism/)
  })
})

describe('Larger Catechism PDF text', () => {
  // Mirrors the real `pdftotext -raw` output: title line, a wrapped question, a page break glued to
  // a question, references wrapped with a hyphen and glued to the next question, a cross-reference,
  // a question without references, a numbered line inside an answer, and missing question 4.
  const text = [
    'Catecismo Maior de Westminster',
    '1. Qual é o fim supremo e principal do',
    'homem?',
    'O fim supremo e principal do homem é glorificar a Deus e gozá-',
    'lo para sempre, como Deus-',
    'homem ensina - e não de outro modo.',
    'Rm 11.36; Jo 16.13-',
    '14.',
    '\f2. Donde se infere que há um Deus?',
    'A luz da natureza:',
    '1. primeiro ponto; 2. segundo.',
    'Veja-se Confissão de Fé, Cap. I.',
    '3. Há mais que um Deus?',
    'Há um só Deus.',
    '',
    '5. Quinta?',
    'Resposta cinco.',
    'Dt 6.4.'
  ].join('\n')

  const parsed = parseLargerCatechismText(text, 5)
  const q = (n: number) => parsed.questions.find((x) => x.number === n)!

  it('joins wrapped questions and hyphenated words/references', () => {
    expect(q(1).question).toBe('Qual é o fim supremo e principal do homem?')
    expect(q(1).answer).toBe('O fim supremo e principal do homem é glorificar a Deus e gozá-lo para sempre, como Deus-homem ensina - e não de outro modo.')
    expect(q(1).refs).toBe('Rm 11.36; Jo 16.13-14.')
  })

  it('handles page breaks, numbered lines inside answers and cross-references', () => {
    expect(q(2).question).toBe('Donde se infere que há um Deus?')
    expect(q(2).answer).toBe('A luz da natureza: 1. primeiro ponto; 2. segundo.')
    expect(q(2).refs).toBe('Veja-se Confissão de Fé, Cap. I.')
  })

  it('keeps questions without references and reports missing numbers', () => {
    expect(q(3)).toEqual({ number: 3, question: 'Há mais que um Deus?', answer: 'Há um só Deus.' })
    expect(parsed.missing).toEqual([4])
    expect(q(5).refs).toBe('Dt 6.4.')
  })

  it('fills missing questions from the supplement', () => {
    const merged = applySupplement(parsed, [{ number: 4, question: 'Quarta\npergunta?', answer: 'Quarta resposta.', refs: 'Gn 1.1.' }], 5)
    expect(merged.missing).toEqual([])
    expect(merged.questions.map((x) => x.number)).toEqual([1, 2, 3, 4, 5])
    expect(merged.questions[3]).toEqual({ number: 4, question: 'Quarta pergunta?', answer: 'Quarta resposta.', refs: 'Gn 1.1.' })
    expect(merged.notes).toContain('Q4: taken from the supplement')
  })

  it('applies partial corrections (only refs) to a question the PDF has', () => {
    const merged = applySupplement(parsed, [{ number: 4, question: 'P?', answer: 'R.' }, { number: 5, refs: 'Ex 20.1.', note: 'wrong refs in the PDF' }], 5)
    expect(merged.questions[4]).toEqual({ number: 5, question: 'Quinta?', answer: 'Resposta cinco.', refs: 'Ex 20.1.' })
    expect(merged.notes).toContain('Q5: refs corrected from the supplement')
    expect(() => applySupplement(parsed, [{ number: 4, refs: 'x' }], 5)).toThrow(/Q4: needs question and answer/)
  })

  it('joinWrapped keeps spaced dashes as separate words', () => {
    expect(joinWrapped(['pecado e de Satanás -', 'pedimos'])).toBe('pecado e de Satanás - pedimos')
    expect(joinWrapped(['co-', 'herdeiros'])).toBe('co-herdeiros')
  })
})
