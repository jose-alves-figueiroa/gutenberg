/**
 * Text cleaning for imported content (Holyrics, web pages, PDFs): no HTML ever reaches the
 * internal format or the OBS payload. See docs/DATA.md → "Limpeza comum".
 */

const NAMED_ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Decodes the HTML entities found in imported text (`&nbsp;`, `&amp;`, `&#233;`, `&#xE9;`…). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

/**
 * Removes Holyrics markup and any other HTML, keeping the visible text:
 * - `<span … id='text-force-update_N'></span>` (Holyrics refresh hack) — dropped;
 * - a trailing version tag such as `<span style='font-size:50%'>(RA)</span>` — dropped;
 * - `<br>` → line break; `<ctt>`, `<desc>`, `<span>` and other tags — unwrapped.
 */
export function stripMarkup(html: string): string {
  return decodeEntities(
    html
      .replace(/<span[^>]*text-force-update[^>]*>\s*<\/span>/gi, '')
      .replace(/<span[^>]*>\s*\([A-Z0-9]{1,6}\)\s*<\/span>\s*$/i, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-z][^>]*>/gi, '')
  )
}

/** Normalizes line endings and spacing; keeps line structure. Trims every line and the whole text. */
export function normalizeSpacing(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Running text (verse, confession section, answer, creed): paragraphs separated by one blank
 * line and no single line breaks — `autobreak` decides the screens.
 */
export function toProse(text: string): string {
  return normalizeSpacing(stripMarkup(text))
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Song text → stanzas (blank-line separated) of trimmed, non-empty lines. */
export function toStanzas(text: string): string[][] {
  return normalizeSpacing(stripMarkup(text))
    .split(/\n\s*\n/)
    .map((s) => s.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((s) => s.length > 0)
}

/** A single-line field (title, header, credit). */
export function toLine(text: string): string {
  return normalizeSpacing(stripMarkup(text)).replace(/\s*\n\s*/g, ' ')
}
