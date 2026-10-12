/** Coleções e livros da Bíblia (README → Biblioteca; protótipo `BOOKS`/`COLS`). */

export type CollectionKey = 'biblia' | 'hnc' | 'salmos' | 'credos' | 'cfw' | 'breve' | 'maior'
export type CollectionKind = 'biblia' | 'musica' | 'credo' | 'cfw' | 'catecismo'
export type CollectionGroup = 'Bíblia' | 'Hinário e salmos' | 'Doutrina'

export interface Collection {
  key: CollectionKey
  label: string
  kind: CollectionKind
  /** Nome curto usado nos cabeçalhos das telas. */
  short: string
  group: CollectionGroup
  /** Prefixo na busca rápida (`bc 1`, `sg 133`…). */
  prefix?: string
}

/** Ordem dos grupos em qualquer menu: a Bíblia sempre no topo. */
export const GROUPS: readonly CollectionGroup[] = ['Bíblia', 'Hinário e salmos', 'Doutrina']

export const COLLECTIONS: readonly Collection[] = [
  { key: 'biblia', label: 'Bíblia ARA', kind: 'biblia', short: 'ARA', group: 'Bíblia' },
  { key: 'hnc', label: 'Hinário Novo Cântico', kind: 'musica', short: 'HNC', group: 'Hinário e salmos', prefix: 'hnc' },
  { key: 'salmos', label: 'Salmos genebrinos', kind: 'musica', short: 'Salmo', group: 'Hinário e salmos', prefix: 'sg' },
  { key: 'credos', label: 'Credos', kind: 'credo', short: 'Credo', group: 'Doutrina', prefix: 'credo' },
  { key: 'cfw', label: 'Confissão de Westminster', kind: 'cfw', short: 'CFW', group: 'Doutrina', prefix: 'cfw' },
  { key: 'breve', label: 'Breve Catecismo', kind: 'catecismo', short: 'Breve Catecismo', group: 'Doutrina', prefix: 'bc' },
  { key: 'maior', label: 'Catecismo Maior', kind: 'catecismo', short: 'Catecismo Maior', group: 'Doutrina', prefix: 'cm' }
]

export const COLLECTION: Readonly<Record<CollectionKey, Collection>> = Object.fromEntries(
  COLLECTIONS.map((c) => [c.key, c])
) as Record<CollectionKey, Collection>

/** Livros da Bíblia na ordem canônica: [abreviação, nome]. */
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

/** Nome do livro pela abreviação (`Hb` → `Hebreus`). */
export function bookName(abbrev: string): string {
  const name = BOOK_NAME[abbrev]
  if (!name) throw new Error(`Livro desconhecido: ${abbrev}`)
  return name
}
