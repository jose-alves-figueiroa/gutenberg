import { describe, expect, it } from 'vitest'
import { autobreak, clampMax, DEFAULT_MAX, MAX_MAX, MIN_MAX, splitSegments, twoLines, wordChunks } from '@shared/autobreak'
import { loadPrototype } from '../scripts/prototype.mjs'
import golden from './fixtures/autobreak.golden.json'

const flat = (screens: string[]) => screens.map((s) => s.replace(/\n/g, ' ')).join(' ')
const collapse = (t: string) => t.replace(/\s+/g, ' ').trim()
/** Frase com exatamente `len` caracteres, terminando em `end`. */
const phrase = (len: number, end = ',') => ('palavra '.repeat(len).slice(0, len - 1).trimEnd().padEnd(len - 1, 'x') + end).slice(-len)

describe('autobreak — paridade com o protótipo', () => {
  const cases = Object.entries(golden.cases) as [string, Record<string, string[]>][]
  for (const [name, byLimit] of cases) {
    for (const [max, expected] of Object.entries(byLimit)) {
      it(`${name} @ ${max}`, () => {
        expect(autobreak(golden.texts[name as keyof typeof golden.texts], Number(max))).toEqual(expected)
      })
    }
  }

  it('bate com o protótipo em 500 textos aleatórios', () => {
    const proto = loadPrototype()
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const words = ['Deus', 'graça', 'e', 'a', 'santificação', 'que', 'ninguém', 'verá', 'o', 'Senhor', 'paz', 'com', 'todos', 'inescusáveis', 'providência', 'de', 'misericórdia']
    const seps = [' ', ' ', ' ', ' ', ', ', '; ', ': ', '. ', '! ', '? ', '\n', '\n\n', ' \n \n ']
    for (let i = 0; i < 500; i++) {
      let text = ''
      const n = 1 + Math.floor(rnd() * 90)
      for (let w = 0; w < n; w++) text += words[Math.floor(rnd() * words.length)] + (rnd() < 0.7 ? ' ' : seps[Math.floor(rnd() * seps.length)])
      const max = MIN_MAX + Math.floor(rnd() * (MAX_MAX - MIN_MAX + 1))
      expect(autobreak(text, max), `texto #${i} @ ${max}`).toEqual(proto.autobreak(text, max))
    }
  })
})

describe('autobreak — regras do README', () => {
  it('1. linha em branco força quebra (inclusive com espaços)', () => {
    expect(autobreak('Graça.\n\nPaz.', 96)).toEqual(['Graça.', 'Paz.'])
    expect(autobreak('Graça.\n   \nPaz.', 96)).toEqual(['Graça.', 'Paz.'])
    expect(splitSegments('a\n\n\n\nb')).toEqual(['a', 'b'])
  })

  it('2. segmento que cabe no limite vira uma tela só', () => {
    const s = phrase(96, '.')
    expect(s).toHaveLength(96)
    expect(autobreak(s, 96)).toHaveLength(1)
    expect(autobreak(phrase(97, '.'), 96).length).toBeGreaterThan(1)
  })

  it('3. segmento maior é dividido nas pausas , ; : . ! ?', () => {
    for (const p of [',', ';', ':', '.', '!', '?']) {
      const text = `${phrase(50, p)} ${phrase(50, '.')}`
      const screens = autobreak(text, 60)
      expect(screens, p).toHaveLength(2)
      expect(screens[0].replace('\n', ' ').endsWith(p), p).toBe(true)
    }
  })

  it('3. frase longa sem pausa vira pedaços equilibrados por palavra', () => {
    const s = golden.texts['frase-sem-pausa']
    const chunks = wordChunks(s, 96)
    expect(chunks).toHaveLength(Math.ceil(s.length / 96))
    const lens = chunks.map((c) => c.length)
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(15)
    expect(chunks.join(' ')).toBe(s)
  })

  it('4. frases são agrupadas em ordem até o limite', () => {
    const a = phrase(30), b = phrase(30), c = phrase(30), d = phrase(30, '.')
    const screens = autobreak([a, b, c, d].join(' '), 96)
    expect(screens.map((s) => s.replace('\n', ' '))).toEqual([`${a} ${b} ${c}`, d])
  })

  it('5. sobra < 30% junta com a anterior se couber em 120%', () => {
    const first = `${phrase(50)} ${phrase(45)}` // 96 caracteres
    const merged = autobreak(`${first} ${phrase(12, '.')}`, 96)
    expect(merged).toHaveLength(1)
    expect(merged[0].replace('\n', ' ')).toHaveLength(109)
  })

  it('5. sobra curta NÃO junta se passar de 120%', () => {
    const first = `${phrase(50)} ${phrase(45)}`
    expect(autobreak(`${first} ${phrase(25, '.')}`, 96)).toHaveLength(2) // 122 > 115
  })

  it('5. o corte é 30% do limite (28,8 de 96)', () => {
    // Juntas dariam 97–98 caracteres: passam do limite, mas cabem nos 120%.
    expect(autobreak(`${phrase(66)} ${phrase(30, '.')}`, 96)).toHaveLength(2) // 30 ≥ 28,8 → fica separada
    expect(autobreak(`${phrase(69)} ${phrase(28, '.')}`, 96)).toHaveLength(1) // 28 < 28,8 → junta
  })

  it('6. cada tela vira 2 linhas equilibradas', () => {
    const s = 'atentando diligentemente por que ninguém seja faltoso separando-se da graça de Deus'
    const [l1, l2] = twoLines(s, 96).split('\n')
    expect(Math.abs(l1.length - l2.length)).toBeLessThanOrEqual(12)
  })

  it('6. prefere quebrar depois de vírgula, ponto e vírgula ou dois-pontos', () => {
    const s = 'Segui a paz com todos e a santificação, sem a qual ninguém verá o Senhor jamais'
    expect(twoLines(s, 96)).toBe('Segui a paz com todos e a santificação,\nsem a qual ninguém verá o Senhor jamais')
    expect(twoLines(s.replace(',', ';'), 96)).toContain(';\n')
    expect(twoLines(s.replace(',', ':'), 96)).toContain(':\n')
  })

  it('6. tela curta (≤ 55% do limite) não é quebrada', () => {
    expect(twoLines(phrase(53, '.'), 96)).not.toContain('\n') // 53 = round(96 × 0.55)
    expect(twoLines(phrase(54, '.'), 96)).toContain('\n')
  })

  it('nenhuma tela dos textos de referência passa de 2 linhas nem de 120% do limite', () => {
    for (const [name, text] of Object.entries(golden.texts)) {
      for (const max of [60, 96, 160]) {
        for (const s of autobreak(text, max)) {
          expect(s.split('\n').length, `${name} @ ${max}`).toBeLessThanOrEqual(2)
          expect(s.replace('\n', ' ').length, `${name} @ ${max}`).toBeLessThanOrEqual(max * 1.2)
          expect(s, `${name} @ ${max}`).not.toMatch(/<[a-z/]|&nbsp;/i)
        }
      }
    }
  })

  it('não perde nem reordena texto', () => {
    for (const [name, text] of Object.entries(golden.texts)) {
      for (const max of [60, 96, 160]) expect(flat(autobreak(text, max)), name).toBe(collapse(text))
    }
  })

  it('texto vazio, nulo ou só espaços → nenhuma tela', () => {
    expect(autobreak('')).toEqual([])
    expect(autobreak(null)).toEqual([])
    expect(autobreak(undefined)).toEqual([])
    expect(autobreak('  \n\n  ')).toEqual([])
  })
})

describe('limite configurável', () => {
  it('padrão é 96, faixa 60–160', () => {
    expect([DEFAULT_MAX, MIN_MAX, MAX_MAX]).toEqual([96, 60, 160])
    expect(autobreak(golden.texts['cfw-1.1'])).toEqual(autobreak(golden.texts['cfw-1.1'], 96))
  })

  it('clampa valores fora da faixa', () => {
    expect(clampMax(10)).toBe(60)
    expect(clampMax(500)).toBe(160)
    expect(clampMax(Number.NaN)).toBe(96)
    expect(clampMax(95.6)).toBe(96)
    expect(autobreak(golden.texts['cfw-1.1'], 10)).toEqual(autobreak(golden.texts['cfw-1.1'], 60))
  })

  it('limite maior gera menos telas', () => {
    const t = golden.texts['credo-apostolico']
    expect(autobreak(t, 160).length).toBeLessThan(autobreak(t, 60).length)
  })
})
