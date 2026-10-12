/**
 * Quebra automática de telas — porte fiel de `autobreak()` do protótipo
 * (design_handoff_gutenberg/design/Gutenberg.dc.html). Paridade garantida por
 * tests/fixtures/autobreak.golden.json; não altere o algoritmo sem regenerar o golden
 * (`npm run golden`) e justificar.
 *
 * Cada tela é uma string com no máximo uma quebra `\n` (2 linhas equilibradas).
 */

/** Limite padrão de caracteres por tela. */
export const DEFAULT_MAX = 96
/** Faixa permitida para a configuração do limite. */
export const MIN_MAX = 60
export const MAX_MAX = 160

/** Ajusta o limite à faixa 60–160 (valores inválidos voltam ao padrão). */
export function clampMax(max: number): number {
  if (!Number.isFinite(max)) return DEFAULT_MAX
  return Math.min(MAX_MAX, Math.max(MIN_MAX, Math.round(max)))
}

/** Divide o texto em segmentos nas linhas em branco (regra 1). */
export function splitSegments(text: string | null | undefined): string[] {
  return (text || '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Divide uma frase longa demais em pedaços equilibrados por palavras (regra 3). */
export function wordChunks(s: string, max: number): string[] {
  const n = Math.ceil(s.length / max)
  const target = s.length / n
  const out: string[] = []
  let cur = ''
  for (const w of s.split(' ')) {
    if (cur && (cur + ' ' + w).length > target && out.length < n - 1) {
      out.push(cur)
      cur = w
    } else cur = cur ? cur + ' ' + w : w
  }
  if (cur) out.push(cur)
  return out
}

/**
 * Quebra a tela em 2 linhas equilibradas: no espaço mais perto do meio, preferindo
 * depois de `, ; :` (regra 6). Telas curtas (≤ 55% do limite) ficam numa linha só.
 */
export function twoLines(s: string, max: number): string {
  if (s.includes('\n') || s.length <= Math.round(max * 0.55)) return s
  const mid = s.length / 2
  let best = -1
  let score = Infinity
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] !== ' ') continue
    const sc = Math.abs(i - mid) - (/[,;:]/.test(s[i - 1]) ? 10 : 0)
    if (sc < score) {
      score = sc
      best = i
    }
  }
  return best < 0 ? s : s.slice(0, best) + '\n' + s.slice(best + 1)
}

/** Divide um texto em telas. Ver README → "Quebra automática de telas". */
export function autobreak(text: string | null | undefined, max: number = DEFAULT_MAX): string[] {
  max = clampMax(max)
  const out: string[] = []
  for (const seg of splitSegments(text)) {
    // Regra 2: cabe numa tela.
    if (seg.length <= max) {
      out.push(twoLines(seg, max))
      continue
    }
    // Regra 3: frases nas pausas; frase longa demais vira pedaços por palavra.
    const flat = seg.replace(/\s*\n\s*/g, ' ')
    const phrases = flat.split(/(?<=[,;:.!?])\s+/).flatMap((p) => (p.length > max ? wordChunks(p, max) : [p]))
    // Regra 4: agrupa as frases, em ordem, até o limite.
    const screens: string[] = []
    let cur = ''
    for (const p of phrases) {
      if (cur && (cur + ' ' + p).length > max) {
        screens.push(cur)
        cur = p
      } else cur = cur ? cur + ' ' + p : p
    }
    if (cur) screens.push(cur)
    // Regra 5: sobra curta (< 30%) junta com a anterior se couber em 120%.
    const n = screens.length
    if (n > 1 && screens[n - 1].length < max * 0.3 && (screens[n - 2] + ' ' + screens[n - 1]).length <= max * 1.2) {
      screens.splice(-2, 2, screens[n - 2] + ' ' + screens[n - 1])
    }
    for (const s of screens) out.push(twoLines(s, max))
  }
  return out
}
