/** Song lyrics as stored/edited (stanzas separated by a blank line) ↔ stanzas of lines. */
export function lyricsToStanzas(lyrics: string): string[][] {
  return lyrics
    .split(/\n\s*\n/)
    .map((st) => st.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((st) => st.length > 0)
}
