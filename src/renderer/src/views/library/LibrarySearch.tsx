/**
 * Search inside the selected collection (Library): number, title or text, as the picker does
 * (`42B`, `133`, `castelo`, `1.2`); the Bible takes a book or a reference (`sl 119`, `hebreus`).
 * Results open the item in the collection's browser; Enter opens the first one.
 */
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import type { KeyboardEvent } from 'react'
import { bibleRefTitle, booksFor, parseBibleRef } from '@shared/bible-ref'
import { t } from '@shared/i18n'
import type { CollectionSummary } from '@shared/library-schemas'
import { collectionRef } from '@shared/quick-search'
import { json, useApi } from '../../api'
import { LevelHeader, List, type ListRow } from './parts'

const MAX_BOOKS = 10

/** Browser path of a search result (see each browser's paths). */
export function resultPath(kind: CollectionSummary['kind'], itemRef: string): string[] {
  if (kind === 'songbook') return ['song', itemRef]
  if (kind === 'confession') return itemRef.split('.')
  return [itemRef]
}

interface Props {
  c: CollectionSummary
  query: string
  setQuery: (q: string) => void
  /** Opens a path in the collection's browser (and clears the search). */
  open: (path: string[]) => void
}

/** The search field; while it has text, `SearchResults` replaces the browser. */
export function SearchField({ c, query, setQuery, rows }: Omit<Props, 'open'> & { rows: ListRow[] }) {
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && rows[0]) {
      e.preventDefault()
      rows[0].go()
    } else if (e.key === 'Escape') setQuery('')
  }
  return (
    <label className="quick-search-box lib-search">
      <MagnifyingGlassIcon size={17} weight="duotone" aria-hidden />
      <input
        className="quick-search-input"
        type="search"
        aria-label={t('library.search')}
        placeholder={t(`library.searchPlaceholder.${c.kind}`)}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
      />
    </label>
  )
}

/** Result rows for `query` in collection `c`. */
export function useSearchRows({ c, query, open }: Omit<Props, 'setQuery'>): { rows: ListRow[]; pending: boolean } {
  const api = useApi()
  const q = query.trim()
  const remote = c.kind !== 'bible' && q !== ''
  const search = useQuery({
    queryKey: ['library-search', c.kind, c.id, q],
    enabled: remote,
    queryFn: () => json(api.api.v1.library.search.$get({ query: { collection: collectionRef(c), q } }))
  })
  if (!q) return { rows: [], pending: false }
  if (c.kind === 'bible') {
    const ref = parseBibleRef(q)
    if (ref) return { rows: [{ key: 'ref', label: '', sub: bibleRefTitle({ book: ref.book, chapter: ref.chapter }), go: () => open([ref.book, String(ref.chapter)]) }], pending: false }
    const rows = booksFor(q)
      .slice(0, MAX_BOOKS)
      .map(([abbrev, name]) => ({ key: abbrev, label: abbrev, sub: name, go: () => open([abbrev]) }))
    return { rows, pending: false }
  }
  const rows = (search.data ?? []).map((r) => ({ key: r.itemRef, label: '', sub: r.title, go: () => open(resultPath(c.kind, r.itemRef)) }))
  return { rows, pending: search.isPending }
}

/** Design v2: trail "Collection › Busca", title "Busca: 133", "2 resultados em …", then the rows. */
export function SearchResults({ rows, pending, title, query, clear }: { rows: ListRow[]; pending: boolean; title: string; query: string; clear: () => void }) {
  const hint = pending ? '…' : t(rows.length === 1 ? 'library.searchCount.one' : 'library.searchCount.other', { n: rows.length, name: title })
  return (
    <>
      <LevelHeader crumbs={[{ label: title, go: clear }, { label: t('library.searchCrumb') }]} title={t('library.searchTitle', { q: query.trim() })} hint={hint} />
      {rows.length === 0 ? <p className="empty-note">{pending ? '…' : t('library.searchEmpty')}</p> : <List rows={rows} plain />}
    </>
  )
}
