/** Catechism sources → internal format. */
import { toLine, toProse } from '../../../src/shared/clean'
import { DEFAULT_COLLECTIONS } from '../../../src/shared/collections'
import type { Catechism, CatechismQuestion, SourceRef } from '../../../src/shared/data-model'

/** Full titles of the catechisms we ship; menus use the shorter titles from DEFAULT_COLLECTIONS. */
export const CATECHISM_TITLES: Readonly<Record<string, string>> = {
  wsc: 'Breve Catecismo de Westminster',
  wlc: 'Catecismo Maior de Westminster'
}

export function catechismDocument(id: string, questions: CatechismQuestion[], source: SourceRef): Catechism {
  const meta = DEFAULT_COLLECTIONS.find((c) => c.kind === 'catechism' && c.id === id)
  if (!meta) throw new Error(`unknown catechism id: ${id}`)
  return { format: 1, id, title: CATECHISM_TITLES[id] ?? meta.title, shortTitle: meta.shortTitle, prefix: meta.prefix, questions, source }
}

export interface GistItem {
  numero: string | null
  pergunta: string | null
  resposta: string | null
  refs?: string | null
}

/**
 * The shorter-catechism gist (`[{numero, pergunta, resposta, refs}]`). Questions are numbered by
 * position: item 81 carries its question in `numero` and has `pergunta: null`.
 */
export function translateGistCatechism(items: GistItem[]): { questions: CatechismQuestion[]; notes: string[] } {
  const notes: string[] = []
  const questions = items.map((item, i) => {
    const number = i + 1
    let question = item.pergunta
    if (!question && item.numero && !/^\d+$/.test(item.numero.trim())) {
      question = item.numero
      notes.push(`Q${number}: question recovered from the "numero" field`)
    } else if (item.numero && Number(item.numero) !== number) notes.push(`Q${number}: source numbers it ${item.numero}`)
    if (!question) throw new Error(`Q${number}: no question text`)
    if (!item.resposta) throw new Error(`Q${number}: no answer text`)
    const refs = item.refs ? toLine(item.refs) : ''
    return { number, question: toProse(question), answer: toProse(item.resposta), ...(refs ? { refs } : {}) }
  })
  return { questions, notes }
}
