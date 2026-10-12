// npm run hymnal:fetch [-- --out data/sources/hnc]
// Downloads the Hinário Novo Cântico hymn XML files from novocantico.com.br (hino/NNN/NNN.xml and
// the appendices A–D), discovering them through the site's indices. Polite: one request at a time.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from './lib/args'

const SITE = 'https://novocantico.com.br'
const INDICES = ['assunto', 'primeiro-verso', 'coro', 'referencia-biblica']
const args = parseArgs()
const out = typeof args.out === 'string' ? resolve(args.out) : join(import.meta.dirname, '..', 'data', 'sources', 'hnc')

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Gutenberg data import (church projection app)' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

const ids = new Set<string>()
for (const index of INDICES) {
  const html = await get(`${SITE}/indice/${index}`)
  for (const m of html.matchAll(/hino\/([0-9A-Za-z]+)\/\1\.xml/g)) ids.add(m[1])
}
const sorted = [...ids].sort((a, b) => (Number(a) || 1000 + a.charCodeAt(0)) - (Number(b) || 1000 + b.charCodeAt(0)))
mkdirSync(out, { recursive: true })
let fetched = 0
for (const id of sorted) {
  const file = join(out, `${id}.xml`)
  if (existsSync(file) && !args.force) continue
  writeFileSync(file, await get(`${SITE}/hino/${id}/${id}.xml`))
  fetched++
  await new Promise((r) => setTimeout(r, 100))
}
console.log(`hymnal:fetch: ${sorted.length} hymns listed, ${fetched} downloaded → ${out}`)
