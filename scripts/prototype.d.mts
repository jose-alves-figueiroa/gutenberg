export function loadPrototype(): {
  autobreak: (text: string, max: number) => string[]
  split: (text: string) => string[]
  BOOKS: [string, string][]
  COLS: { k: string; label: string; kind: string; short: string; g: string; key?: string }[]
  LIB0: Record<string, Record<string, unknown>[]>
  /** Chapters per Bible book. */
  CH: Record<string, number>
  /** Sections per WCF chapter (index 0 unused). */
  CFW_S: number[]
  /** WCF chapter titles (index 0 unused). */
  CFW_T: string[]
  CAT_N: { breve: number; maior: number }
  booksFor: (q: string) => [string, string][]
  parseBible: (raw: string) => { ab: string; ch: number; v1: number; v2: number } | null
}
