/**
 * Hand-reviewed creeds text → internal format. Format of data/sources/creeds.txt:
 *
 *   ## Credo Apostólico
 *   Creio em Deus Pai, todo-poderoso…
 *
 *   (blank line = new paragraph)
 *
 *   ## Credo Niceno
 *   …
 *
 * Headings map to ids by name (apostólico → apostles, niceno → nicene, atanasiano / de Atanásio → athanasian).
 */
import { toLine, toProse } from '../../../src/shared/clean'
import type { Creed, CreedId } from '../../../src/shared/data-model'

const IDS: [RegExp, CreedId][] = [
  [/apost[óo]lico/i, 'apostles'],
  [/niceno/i, 'nicene'],
  [/atan[áa]si/i, 'athanasian']
]

export function parseCreedsText(text: string): Creed[] {
  const creeds: Creed[] = []
  const blocks = text.replace(/\r\n?/g, '\n').split(/^##\s+/m).slice(1)
  for (const block of blocks) {
    const [heading, ...body] = block.split('\n')
    const title = toLine(heading)
    const id = IDS.find(([re]) => re.test(title))?.[1]
    if (!id) throw new Error(`unknown creed heading "${title}" (expected Apostólico, Niceno or Atanasiano/de Atanásio)`)
    if (creeds.some((c) => c.id === id)) throw new Error(`creed "${title}" appears twice`)
    const prose = toProse(body.join('\n'))
    if (!prose) throw new Error(`creed "${title}" has no text`)
    creeds.push({ id, title, text: prose })
  }
  return creeds
}
