/** Library tab: collections on the left (Bible first), the selected collection's browser on the right. */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DEFAULT_COLLECTIONS, GROUPS, groupLabel, groupOf, type CollectionKind } from '@shared/collections'
import { t } from '@shared/i18n'
import type { CollectionSummary } from '@shared/library-schemas'
import { json, useApi } from '../../api'
import { BibleBrowser } from './BibleBrowser'
import { CatechismBrowser } from './CatechismBrowser'
import { ConfessionBrowser } from './ConfessionBrowser'
import { CreedsBrowser } from './CreedsBrowser'
import { SearchField, SearchResults, useSearchRows } from './LibrarySearch'
import { SongbookBrowser } from './SongbookBrowser'
import { Loading } from './parts'

interface Selected {
  kind: CollectionKind
  id: string
}

/** Menu label: the prototype's name for the shipped documents, the database title for others. */
export function collectionLabel(c: Pick<CollectionSummary, 'kind' | 'id' | 'title'>): string {
  return DEFAULT_COLLECTIONS.find((d) => d.kind === c.kind && d.id === c.id)?.title ?? c.title
}

export function LibraryView() {
  const api = useApi()
  const collections = useQuery({ queryKey: ['collections'], queryFn: () => json(api.api.v1.library.collections.$get()) })
  const [selected, setSelected] = useState<Selected>({ kind: 'bible', id: 'ara' })
  const [path, setPath] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const open = (s: Selected) => {
    setSelected(s)
    setPath([])
    setQuery('')
  }
  const current = collections.data?.find((c) => c.kind === selected.kind && c.id === selected.id)

  return (
    <main className="view" role="tabpanel" id="view-library" aria-labelledby="tab-library">
      <div className="view-grid view-grid--library">
        <aside className="lib-aside" aria-label={t('tabs.library')}>
          {!collections.data ? (
            <Loading error={collections.error && t('library.error')} />
          ) : (
            GROUPS.map((g) => (
              <div key={g} className="lib-group">
                <h6 className="text-muted">{groupLabel(g)}</h6>
                {collections.data
                  .filter((c) => groupOf(c.kind) === g)
                  .map((c) => (
                    <button
                      key={`${c.kind}:${c.id}`}
                      type="button"
                      className="lib-col"
                      aria-current={c.kind === selected.kind && c.id === selected.id}
                      onClick={() => open({ kind: c.kind, id: c.id })}
                    >
                      <span>{collectionLabel(c)}</span>
                      <span className="count">{c.count}</span>
                    </button>
                  ))}
              </div>
            ))
          )}
        </aside>
        <section className="lib-main">
          {current && <Collection key={`${current.kind}:${current.id}`} c={current} path={path} go={setPath} query={query} setQuery={setQuery} />}
        </section>
      </div>
    </main>
  )
}

/** The collection's browser, or the search results while the search field has text. */
function Collection({ c, path, go, query, setQuery }: { c: CollectionSummary; path: string[]; go: (p: string[]) => void; query: string; setQuery: (q: string) => void }) {
  const search = useSearchRows({
    c,
    query,
    open: (p) => {
      setQuery('')
      go(p)
    }
  })
  return (
    <>
      <SearchField c={c} query={query} setQuery={setQuery} rows={search.rows} />
      {query.trim() ? <SearchResults {...search} title={collectionLabel(c)} query={query} clear={() => setQuery('')} /> : <Browser c={c} path={path} go={go} />}
    </>
  )
}

function Browser({ c, path, go }: { c: CollectionSummary; path: string[]; go: (p: string[]) => void }) {
  const label = collectionLabel(c)
  switch (c.kind) {
    case 'bible':
      return <BibleBrowser version={c.id} label={label} path={path} go={go} />
    case 'confession':
      return <ConfessionBrowser id={c.id} label={label} shortTitle={c.shortTitle} path={path} go={go} />
    case 'catechism':
      return <CatechismBrowser id={c.id} label={label} path={path} go={go} />
    case 'songbook':
      return <SongbookBrowser id={c.id} label={label} path={path} go={go} />
    case 'creeds':
      return <CreedsBrowser label={label} path={path} go={go} />
  }
}
