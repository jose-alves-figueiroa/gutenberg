/**
 * Library collections and Bible books (README → Library; prototype `COLS` / `BOOKS`).
 * A collection is a data document (a songbook, a confession, a catechism…), so new ones —
 * Harpa Cristã, the Canons of Dort, Heidelberg — need data, not code or schema changes.
 */
import { t } from './i18n'

export type CollectionKind = 'bible' | 'songbook' | 'creeds' | 'confession' | 'catechism'
export type CollectionGroup = 'bible' | 'songs' | 'doctrine'

export interface Collection {
  kind: CollectionKind
  /** Document id (`ara`, `hnc`, `psalter`, `wcf`, `wsc`…). */
  id: string
  /** pt-BR content: the document's own title. */
  title: string
  shortTitle: string
  /** Quick-search prefix (`bc 1`, `sg 133`…); empty for the Bible. */
  prefix: string
}

const KIND_GROUP: Record<CollectionKind, CollectionGroup> = {
  bible: 'bible',
  songbook: 'songs',
  creeds: 'doctrine',
  confession: 'doctrine',
  catechism: 'doctrine'
}

/** Group order in every menu: the Bible always comes first. */
export const GROUPS: readonly CollectionGroup[] = ['bible', 'songs', 'doctrine']

export const groupOf = (kind: CollectionKind): CollectionGroup => KIND_GROUP[kind]
export const groupLabel = (group: CollectionGroup): string => t(`group.${group}`)

/** Collections shipped with the app (docs/DATA.md), in the prototype's menu order. */
export const DEFAULT_COLLECTIONS: readonly Collection[] = [
  { kind: 'bible', id: 'ara', title: 'Bíblia ARA', shortTitle: 'ARA', prefix: '' },
  { kind: 'songbook', id: 'hnc', title: 'Hinário Novo Cântico', shortTitle: 'HNC', prefix: 'hnc' },
  { kind: 'songbook', id: 'psalter', title: 'Salmos genebrinos', shortTitle: 'Salmo', prefix: 'sg' },
  { kind: 'creeds', id: 'creeds', title: 'Credos', shortTitle: 'Credo', prefix: 'credo' },
  { kind: 'confession', id: 'wcf', title: 'Confissão de Westminster', shortTitle: 'CFW', prefix: 'cfw' },
  { kind: 'catechism', id: 'wsc', title: 'Breve Catecismo', shortTitle: 'Breve Catecismo', prefix: 'bc' },
  { kind: 'catechism', id: 'wlc', title: 'Catecismo Maior', shortTitle: 'Catecismo Maior', prefix: 'cm' }
]

/** Bible books in canonical order: [abbreviation, name], as printed in the ARA (pt-BR content). */
export const BOOKS: readonly (readonly [string, string])[] = [
  ['Gn', 'Gênesis'], ['Êx', 'Êxodo'], ['Lv', 'Levítico'], ['Nm', 'Números'], ['Dt', 'Deuteronômio'],
  ['Js', 'Josué'], ['Jz', 'Juízes'], ['Rt', 'Rute'], ['1Sm', '1 Samuel'], ['2Sm', '2 Samuel'],
  ['1Rs', '1 Reis'], ['2Rs', '2 Reis'], ['1Cr', '1 Crônicas'], ['2Cr', '2 Crônicas'], ['Ed', 'Esdras'],
  ['Ne', 'Neemias'], ['Et', 'Ester'], ['Jó', 'Jó'], ['Sl', 'Salmos'], ['Pv', 'Provérbios'],
  ['Ec', 'Eclesiastes'], ['Ct', 'Cantares'], ['Is', 'Isaías'], ['Jr', 'Jeremias'], ['Lm', 'Lamentações'],
  ['Ez', 'Ezequiel'], ['Dn', 'Daniel'], ['Os', 'Oseias'], ['Jl', 'Joel'], ['Am', 'Amós'], ['Ob', 'Obadias'],
  ['Jn', 'Jonas'], ['Mq', 'Miqueias'], ['Na', 'Naum'], ['Hc', 'Habacuque'], ['Sf', 'Sofonias'],
  ['Ag', 'Ageu'], ['Zc', 'Zacarias'], ['Ml', 'Malaquias'], ['Mt', 'Mateus'], ['Mc', 'Marcos'],
  ['Lc', 'Lucas'], ['Jo', 'João'], ['At', 'Atos'], ['Rm', 'Romanos'], ['1Co', '1 Coríntios'],
  ['2Co', '2 Coríntios'], ['Gl', 'Gálatas'], ['Ef', 'Efésios'], ['Fp', 'Filipenses'], ['Cl', 'Colossenses'],
  ['1Ts', '1 Tessalonicenses'], ['2Ts', '2 Tessalonicenses'], ['1Tm', '1 Timóteo'], ['2Tm', '2 Timóteo'],
  ['Tt', 'Tito'], ['Fm', 'Filemom'], ['Hb', 'Hebreus'], ['Tg', 'Tiago'], ['1Pe', '1 Pedro'],
  ['2Pe', '2 Pedro'], ['1Jo', '1 João'], ['2Jo', '2 João'], ['3Jo', '3 João'], ['Jd', 'Judas'],
  ['Ap', 'Apocalipse']
]

const BOOK_NAME: Readonly<Record<string, string>> = Object.fromEntries(BOOKS)

/** Book name from its abbreviation (`Hb` → `Hebreus`). */
export function bookName(abbrev: string): string {
  const name = BOOK_NAME[abbrev]
  if (!name) throw new Error(`Unknown Bible book: ${abbrev}`)
  return name
}
