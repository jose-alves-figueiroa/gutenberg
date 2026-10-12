// Builds tests/fixtures/autobreak.golden.json by running the prototype's ORIGINAL autobreak().
// Usage: npm run golden
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadPrototype } from './prototype.mjs'

const { autobreak, LIB0 } = loadPrototype()

const hb = LIB0.biblia[0].verses
const credo = LIB0.credos.find((c) => c.id === 'ca')
const cfw = LIB0.cfw.find((c) => c.id === 'w11')
const [bc1, bc2, bc3] = LIB0.breve

export const TEXTS = {
  'confession-1.1': cfw.text,
  'heb-12.14': hb.find((v) => v.n === '14').t,
  'heb-12.15': hb.find((v) => v.n === '15').t,
  'shorter-1-question': bc1.pergunta,
  'shorter-1-answer': bc1.resposta,
  'shorter-2-question': bc2.pergunta,
  'shorter-2-answer': bc2.resposta,
  'shorter-3-answer': bc3.resposta,
  'apostles-creed': credo.text,
  // Synthetic edge cases for the algorithm
  'blank-lines': 'Primeiro parágrafo curto.\n\nSegundo parágrafo, também curto.\n\n\n   \n\nTerceiro.',
  'single-newlines': 'Uma linha\nque continua na outra linha e segue por bastante tempo, com vírgulas, pausas; e pontos.\nE mais uma linha que deixa o segmento comprido demais para caber numa tela só.',
  'no-pause-sentence': 'Esta frase muito longa não tem nenhuma pausa de pontuação no meio e por isso precisa ser cortada em pedaços equilibrados por palavras para caber nas telas da transmissão sem ficar desigual',
  'short-tail': 'Bendize, ó minha alma, ao Senhor, e tudo o que há em mim bendiga o seu santo nome, e não te esqueças de nenhum de seus benefícios. Amém.',
  'empty': '',
  'whitespace-only': '  \n\n  '
}

export const LIMITS = [60, 72, 96, 128, 160]

const golden = { source: 'design_handoff_gutenberg/design/Gutenberg.dc.html#autobreak', texts: TEXTS, cases: {} }
for (const [name, text] of Object.entries(TEXTS)) {
  golden.cases[name] = Object.fromEntries(LIMITS.map((max) => [max, autobreak(text, max)]))
}

const out = fileURLToPath(new URL('../tests/fixtures/autobreak.golden.json', import.meta.url))
writeFileSync(out, JSON.stringify(golden, null, 2) + '\n')
console.log(`golden: ${Object.keys(TEXTS).length} texts × ${LIMITS.length} limits → ${out}`)
