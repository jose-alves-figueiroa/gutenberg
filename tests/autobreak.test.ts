import { describe, expect, it } from 'vitest'
import { autobreak, clampMax, DEFAULT_MAX, MAX_MAX, MIN_MAX, splitSegments, twoLines, wordChunks } from '@shared/autobreak'
import { loadPrototype } from '../scripts/prototype.mjs'
import golden from './fixtures/autobreak.golden.json'

const flat = (screens: string[]) => screens.map((s) => s.replace(/\n/g, ' ')).join(' ')
const collapse = (t: string) => t.replace(/\s+/g, ' ').trim()
/** A phrase of exactly `len` characters ending with `end`. */
const phrase = (len: number, end = ',') => ('palavra '.repeat(len).slice(0, len - 1).trimEnd().padEnd(len - 1, 'x') + end).slice(-len)

describe('autobreak — parity with the prototype', () => {
  const cases = Object.entries(golden.cases) as [string, Record<string, string[]>][]
  for (const [name, byLimit] of cases) {
    for (const [max, expected] of Object.entries(byLimit)) {
      it(`${name} @ ${max}`, () => {
        expect(autobreak(golden.texts[name as keyof typeof golden.texts], Number(max))).toEqual(expected)
      })
    }
  }

  it('matches the prototype on 500 random texts', () => {
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
      expect(autobreak(text, max), `text #${i} @ ${max}`).toEqual(proto.autobreak(text, max))
    }
  })
})

describe('autobreak — README rules', () => {
  it('1. a blank line forces a break (even with spaces)', () => {
    expect(autobreak('Graça.\n\nPaz.', 96)).toEqual(['Graça.', 'Paz.'])
    expect(autobreak('Graça.\n   \nPaz.', 96)).toEqual(['Graça.', 'Paz.'])
    expect(splitSegments('a\n\n\n\nb')).toEqual(['a', 'b'])
  })

  it('2. a segment within the limit is a single screen', () => {
    const s = phrase(96, '.')
    expect(s).toHaveLength(96)
    expect(autobreak(s, 96)).toHaveLength(1)
    expect(autobreak(phrase(97, '.'), 96).length).toBeGreaterThan(1)
  })

  it('3. a longer segment splits at the pauses , ; : . ! ?', () => {
    for (const p of [',', ';', ':', '.', '!', '?']) {
      const text = `${phrase(50, p)} ${phrase(50, '.')}`
      const screens = autobreak(text, 60)
      expect(screens, p).toHaveLength(2)
      expect(screens[0].replace('\n', ' ').endsWith(p), p).toBe(true)
    }
  })

  it('3. a long phrase without pauses becomes word-balanced chunks', () => {
    const s = golden.texts['no-pause-sentence']
    const chunks = wordChunks(s, 96)
    expect(chunks).toHaveLength(Math.ceil(s.length / 96))
    const lens = chunks.map((c) => c.length)
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(15)
    expect(chunks.join(' ')).toBe(s)
  })

  it('4. phrases are grouped in order up to the limit', () => {
    const a = phrase(30), b = phrase(30), c = phrase(30), d = phrase(30, '.')
    const screens = autobreak([a, b, c, d].join(' '), 96)
    expect(screens.map((s) => s.replace('\n', ' '))).toEqual([`${a} ${b} ${c}`, d])
  })

  it('5. a tail < 30% merges into the previous screen if it fits in 120%', () => {
    const first = `${phrase(50)} ${phrase(45)}` // 96 characters
    const merged = autobreak(`${first} ${phrase(12, '.')}`, 96)
    expect(merged).toHaveLength(1)
    expect(merged[0].replace('\n', ' ')).toHaveLength(109)
  })

  it('5. a short tail does NOT merge beyond 120%', () => {
    const first = `${phrase(50)} ${phrase(45)}`
    expect(autobreak(`${first} ${phrase(25, '.')}`, 96)).toHaveLength(2) // 122 > 115
  })

  it('5. the threshold is 30% of the limit (28.8 of 96)', () => {
    // Merged they would be 97–98 characters: over the limit but within 120%.
    expect(autobreak(`${phrase(66)} ${phrase(30, '.')}`, 96)).toHaveLength(2) // 30 ≥ 28.8 → stays separate
    expect(autobreak(`${phrase(69)} ${phrase(28, '.')}`, 96)).toHaveLength(1) // 28 < 28.8 → merges
  })

  it('6. each screen becomes 2 balanced lines', () => {
    const s = 'atentando diligentemente por que ninguém seja faltoso separando-se da graça de Deus'
    const [l1, l2] = twoLines(s, 96).split('\n')
    expect(Math.abs(l1.length - l2.length)).toBeLessThanOrEqual(12)
  })

  it('6. prefers breaking after a comma, semicolon or colon', () => {
    const s = 'Segui a paz com todos e a santificação, sem a qual ninguém verá o Senhor jamais'
    expect(twoLines(s, 96)).toBe('Segui a paz com todos e a santificação,\nsem a qual ninguém verá o Senhor jamais')
    expect(twoLines(s.replace(',', ';'), 96)).toContain(';\n')
    expect(twoLines(s.replace(',', ':'), 96)).toContain(':\n')
  })

  it('6. a short screen (≤ 55% of the limit) is not broken', () => {
    expect(twoLines(phrase(53, '.'), 96)).not.toContain('\n') // 53 = round(96 × 0.55)
    expect(twoLines(phrase(54, '.'), 96)).toContain('\n')
  })

  it('no reference-text screen exceeds 2 lines or 120% of the limit', () => {
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

  it('never drops or reorders text', () => {
    for (const [name, text] of Object.entries(golden.texts)) {
      for (const max of [60, 96, 160]) expect(flat(autobreak(text, max)), name).toBe(collapse(text))
    }
  })

  it('empty, null or whitespace-only text → no screens', () => {
    expect(autobreak('')).toEqual([])
    expect(autobreak(null)).toEqual([])
    expect(autobreak(undefined)).toEqual([])
    expect(autobreak('  \n\n  ')).toEqual([])
  })
})

describe('configurable limit', () => {
  it('defaults to 96 within 60–160', () => {
    expect([DEFAULT_MAX, MIN_MAX, MAX_MAX]).toEqual([96, 60, 160])
    expect(autobreak(golden.texts['confession-1.1'])).toEqual(autobreak(golden.texts['confession-1.1'], 96))
  })

  it('clamps out-of-range values', () => {
    expect(clampMax(10)).toBe(60)
    expect(clampMax(500)).toBe(160)
    expect(clampMax(Number.NaN)).toBe(96)
    expect(clampMax(95.6)).toBe(96)
    expect(autobreak(golden.texts['confession-1.1'], 10)).toEqual(autobreak(golden.texts['confession-1.1'], 60))
  })

  it('a larger limit yields fewer screens', () => {
    const t = golden.texts['apostles-creed']
    expect(autobreak(t, 160).length).toBeLessThan(autobreak(t, 60).length)
  })
})
