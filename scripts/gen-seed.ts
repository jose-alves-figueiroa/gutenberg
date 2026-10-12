// npm run data:seed [-- --out tests/fixtures/canonical]
// Translates the prototype's sample library (LIB0) into the internal data format. It is the
// development/test seed: small, in plain text, and never part of the shipped data.
import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { toProse, toStanzas } from '../src/shared/clean'
import { BOOKS, DEFAULT_COLLECTIONS } from '../src/shared/collections'
import type { BibleBook, Catechism, Confession, Creeds, Song, Songbook } from '../src/shared/data-model'
import { BOOK_CHAPTERS } from '../src/shared/requirements'
import { parseArgs } from './lib/args'
import { writeJson } from './lib/canonical'
import { loadPrototype } from './prototype.mjs'

interface ProtoLib {
  biblia: { ab: string; ch: string; verses: { n: string; t: string }[] }[]
  salmos: { id: string; num: string; ver: string; meta: string; text: string }[]
  hnc: { id: string; num: string; title: string; meta: string; text: string }[]
  credos: { id: string; title: string; text: string }[]
  cfw: { id: string; cap: string; sec: string; text: string }[]
  breve: { id: string; q: string; pergunta: string; resposta: string }[]
  maior: { id: string; q: string; pergunta: string; resposta: string }[]
}

const args = parseArgs()
const out = typeof args.out === 'string' ? resolve(args.out) : join(import.meta.dirname, '..', 'tests', 'fixtures', 'canonical')
const proto = loadPrototype()
const lib = proto.LIB0 as unknown as ProtoLib
const source = { name: 'prototype' }
const meta = (id: string) => DEFAULT_COLLECTIONS.find((c) => c.id === id)!

rmSync(out, { recursive: true, force: true })
writeJson(join(out, '.gitcrypt-check.json'), { format: 1, check: 'git-crypt ok' })

// Bible: the prototype only has Hb 12.14–15; the rest of Hebrews is filled with placeholders
// (as the prototype's own makeBible() does) so the book has its real chapter count.
const passage = lib.biblia[0]
const order = BOOKS.findIndex(([abbrev]) => abbrev === passage.ab) + 1
const name = BOOKS[order - 1][1]
const placeholder = (c: number, v: number) => `[texto ARA de ${name} ${c}.${v}]`
const chapters = Array.from({ length: BOOK_CHAPTERS[passage.ab] }, (_, c) => {
  const n = c + 1 === Number(passage.ch) ? 29 : 1
  return Array.from({ length: n }, (_, v) => {
    const real = c + 1 === Number(passage.ch) && passage.verses.find((x) => Number(x.n) === v + 1)
    return real ? toProse(real.t) : placeholder(c + 1, v + 1)
  })
})
writeJson(join(out, 'bible', 'ara', 'meta.json'), { format: 1, code: 'ARA', name: 'Almeida Revista e Atualizada', source })
const book: BibleBook = { format: 1, book: passage.ab, name, order, testament: order <= 39 ? 'OT' : 'NT', chapters }
writeJson(join(out, 'bible', 'ara', `${String(order).padStart(2, '0')}-${passage.ab}.json`), book)

// Songbooks
const songbook = (id: string, itemLabel: string): Songbook => {
  const m = meta(id)
  return { format: 1, id, title: m.title, shortTitle: m.shortTitle, prefix: m.prefix, itemLabel, source }
}
writeJson(join(out, 'songbooks', 'psalter', 'songbook.json'), songbook('psalter', 'Salmo'))
for (const s of lib.salmos) {
  const song: Song = {
    format: 1,
    id: `psalter-${s.num}${s.ver}`,
    songbook: 'psalter',
    number: s.num,
    version: s.ver,
    title: `Salmo ${s.num}${s.ver}`,
    versification: '',
    credits: { author: '', artist: s.meta, copyright: '' },
    stanzas: toStanzas(s.text),
    source: { name: 'prototype', id: s.id }
  }
  writeJson(join(out, 'songbooks', 'psalter', 'songs', `${s.num}${s.ver}.json`), song)
}
writeJson(join(out, 'songbooks', 'hnc', 'songbook.json'), songbook('hnc', ''))
for (const h of lib.hnc) {
  const song: Song = {
    format: 1,
    id: `hnc-${h.id}`,
    songbook: 'hnc',
    number: h.num,
    version: '',
    title: h.title,
    versification: '',
    credits: { author: h.meta, artist: '', copyright: '' },
    stanzas: toStanzas(h.text),
    source: { name: 'prototype', id: h.id }
  }
  writeJson(join(out, 'songbooks', 'hnc', 'songs', `${h.id}.json`), song)
}

// Westminster Confession: the sample sections, grouped by chapter, with the prototype's titles.
const wcf: Confession = {
  format: 1,
  id: 'wcf',
  title: 'Confissão de Fé de Westminster',
  shortTitle: meta('wcf').shortTitle,
  prefix: meta('wcf').prefix,
  chapters: [...new Set(lib.cfw.map((s) => s.cap))].map((cap) => ({
    id: cap,
    title: proto.CFW_T[Number(cap)],
    sections: lib.cfw.filter((s) => s.cap === cap).map((s) => ({ id: s.sec, text: toProse(s.text) }))
  })),
  source
}
writeJson(join(out, 'confessions', 'wcf.json'), wcf)

// Catechisms
const catechism = (id: 'wsc' | 'wlc', title: string, items: ProtoLib['breve']): Catechism => ({
  format: 1,
  id,
  title,
  shortTitle: meta(id).shortTitle,
  prefix: meta(id).prefix,
  questions: items.map((q) => ({ number: Number(q.q), question: toProse(q.pergunta), answer: toProse(q.resposta) })),
  source
})
writeJson(join(out, 'catechisms', 'wsc.json'), catechism('wsc', 'Breve Catecismo de Westminster', lib.breve))
writeJson(join(out, 'catechisms', 'wlc.json'), catechism('wlc', 'Catecismo Maior de Westminster', lib.maior))

// Creeds: the prototype has the Apostles' text and a Nicene placeholder.
const CREED_IDS: Record<string, Creeds['creeds'][number]['id']> = { ca: 'apostles', cn: 'nicene' }
const creeds: Creeds = {
  format: 1,
  creeds: lib.credos.map((c) => ({ id: CREED_IDS[c.id], title: c.title, text: toProse(c.text) })),
  source
}
writeJson(join(out, 'creeds.json'), creeds)

console.log(`data:seed: prototype library written to ${out}`)
