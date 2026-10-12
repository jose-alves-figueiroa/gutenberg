import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeEntities, normalizeSpacing, stripMarkup, toLine, toProse, toStanzas } from '@shared/clean'

// The real Holyrics → OBS payload from the handoff: two JSON objects separated by a blank line.
const raw = readFileSync(join(__dirname, '../design_handoff_gutenberg/reference/holyrics-payload-exemplo.json.txt'), 'utf8')
const [bible, music] = raw.split(/\n\s*\n(?=\{)/).map((chunk) => JSON.parse(chunk).map as Record<string, string>)

describe('clean — real Holyrics payload', () => {
  it('reads both sample payloads', () => {
    expect(bible.type).toBe('BIBLE')
    expect(music.type).toBe('MUSIC')
  })

  it('header: <desc> is unwrapped', () => {
    expect(toLine(bible.header)).toBe('Hebreus 12.15')
  })

  it('Bible text: drops <ctt>, &nbsp; padding, the (RA) tag and the force-update span', () => {
    expect(toProse(bible.text)).toBe('...por meio dela, muitos sejam contaminados;')
  })

  it('song text: keeps the two lines, trims the trailing space, drops the force-update span', () => {
    expect(toStanzas(music.text)).toEqual([['Oh! Como é bom e agradável,', 'bem suave, sim,']])
  })
})

describe('clean — building blocks', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('a&nbsp;b &amp; c &#233; &#xE9; &lt;x&gt; &bogus;')).toBe('a b & c é é <x> &bogus;')
  })

  it('turns <br> into line breaks and unwraps other tags', () => {
    expect(stripMarkup('<b>um</b><br/>dois<br>três')).toBe('um\ndois\ntrês')
  })

  it('keeps a parenthesized word that is not a trailing version tag', () => {
    expect(toProse('Amém <span>(RA)</span> e mais')).toBe('Amém (RA) e mais')
  })

  it('normalizes CRLF, tabs and non-breaking spaces; collapses 3+ blank lines', () => {
    expect(normalizeSpacing('  a\t b \r\n\r\n\r\n\r\nc  ')).toBe('a b\n\nc')
  })

  it('prose: single line breaks become spaces, paragraphs survive', () => {
    expect(toProse('Creio em Deus Pai,\ntodo-poderoso.\n\nCreio em Jesus Cristo')).toBe(
      'Creio em Deus Pai, todo-poderoso.\n\nCreio em Jesus Cristo'
    )
  })

  it('stanzas: blank lines split stanzas, empty lines vanish', () => {
    expect(toStanzas('a\nb\n\n\n c \n\n')).toEqual([['a', 'b'], ['c']])
    expect(toStanzas('')).toEqual([])
  })
})
