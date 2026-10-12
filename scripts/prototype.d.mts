export function loadPrototype(): {
  autobreak: (text: string, max: number) => string[]
  split: (text: string) => string[]
  BOOKS: [string, string][]
  COLS: { k: string; label: string; kind: string; short: string; g: string; key?: string }[]
  LIB0: Record<string, Record<string, unknown>[]>
}
