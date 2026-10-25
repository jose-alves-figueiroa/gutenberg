/**
 * Automatic screen breaking — faithful port of the prototype's `autobreak()`
 * (design/proposals/v1/design/Gutenberg.dc.html). Parity is enforced by
 * tests/fixtures/autobreak.golden.json; do not change the algorithm without regenerating
 * the golden file (`npm run golden`) and explaining why.
 *
 * Each screen is a string with at most one `\n` (2 balanced lines).
 */

/** Default characters per screen. */
export const DEFAULT_MAX = 96
/** Allowed range for the per-screen limit setting. */
export const MIN_MAX = 60
export const MAX_MAX = 160

/** Clamps the limit to 60–160 (invalid values fall back to the default). */
export function clampMax(max: number): number {
  if (!Number.isFinite(max)) return DEFAULT_MAX
  return Math.min(MAX_MAX, Math.max(MIN_MAX, Math.round(max)))
}

/** Splits text into segments at blank lines (rule 1). */
export function splitSegments(text: string | null | undefined): string[] {
  return (text || '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Splits an over-long phrase into word-balanced chunks (rule 3). */
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
 * Breaks a screen into 2 balanced lines at the space nearest the middle, preferring
 * one right after `, ; :` (rule 6). Short screens (≤ 55% of the limit) stay on one line.
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

/** Splits text into screens. See README → "Quebra automática de telas". */
export function autobreak(text: string | null | undefined, max: number = DEFAULT_MAX): string[] {
  max = clampMax(max)
  const out: string[] = []
  for (const seg of splitSegments(text)) {
    // Rule 2: fits in one screen.
    if (seg.length <= max) {
      out.push(twoLines(seg, max))
      continue
    }
    // Rule 3: phrases at pauses; an over-long phrase becomes word chunks.
    const flat = seg.replace(/\s*\n\s*/g, ' ')
    const phrases = flat.split(/(?<=[,;:.!?])\s+/).flatMap((p) => (p.length > max ? wordChunks(p, max) : [p]))
    // Rule 4: group phrases, in order, up to the limit.
    const screens: string[] = []
    let cur = ''
    for (const p of phrases) {
      if (cur && (cur + ' ' + p).length > max) {
        screens.push(cur)
        cur = p
      } else cur = cur ? cur + ' ' + p : p
    }
    if (cur) screens.push(cur)
    // Rule 5: a short tail (< 30%) merges into the previous screen if it fits in 120%.
    const n = screens.length
    if (n > 1 && screens[n - 1].length < max * 0.3 && (screens[n - 2] + ' ' + screens[n - 1]).length <= max * 1.2) {
      screens.splice(-2, 2, screens[n - 2] + ' ' + screens[n - 1])
    }
    for (const s of screens) out.push(twoLines(s, max))
  }
  return out
}
