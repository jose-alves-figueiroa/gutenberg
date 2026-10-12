/**
 * Quick search in the nav (README → "Busca rápida"): a book becomes a tag, then
 * `capítulo.versículo`; direct references and collection prefixes (`bc 1`, `sg 133`…). Enter
 * presents the item as "Avulso" and opens the Present tab.
 */
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useState, type KeyboardEvent } from 'react'
import { bookName } from '@shared/collections'
import { t } from '@shared/i18n'
import { parseQuickSearch } from '@shared/quick-search'
import { json, useApi } from '../api'
import { usePresentAndOpen } from '../present'

interface Suggestion {
  label: string
  sub: string
  group: string
  run: (() => void) | null
}

const MAX_RESULTS = 8

export function QuickSearch() {
  const api = useApi()
  const present = usePresentAndOpen()
  const [text, setText] = useState('')
  const [book, setBook] = useState<string | null>(null)
  const [sel, setSel] = useState(0)
  const [focus, setFocus] = useState(false)

  const collections = useQuery({ queryKey: ['collections'], queryFn: () => json(api.api.v1.library.collections.$get()) })
  const parsed = parseQuickSearch(text, collections.data ?? [], book)
  const search = useQuery({
    queryKey: ['quick-search', parsed.type === 'collection' ? parsed.collection : '', parsed.type === 'collection' ? parsed.query : ''],
    enabled: parsed.type === 'collection',
    queryFn: () =>
      parsed.type === 'collection'
        ? json(api.api.v1.library.search.$get({ query: { collection: parsed.collection, q: parsed.query } }))
        : Promise.resolve([])
  })

  const reset = () => {
    setText('')
    setBook(null)
    setSel(0)
  }
  const show = (collection: string, itemRef: string) => {
    reset()
    void present.run({ type: 'adhoc', collection, itemRef })
  }
  const bible = t('group.bible')
  const bibleRef = collections.data?.find((c) => c.kind === 'bible')
  const bibleCollection = bibleRef ? `bible:${bibleRef.id}` : 'bible:ara'

  let sugg: Suggestion[] = []
  if (parsed.type === 'bible') sugg = [{ label: parsed.title, sub: t('quick.enterPresents'), group: bible, run: () => show(bibleCollection, parsed.itemRef) }]
  else if (parsed.type === 'chapter') sugg = [{ label: bookName(parsed.book), sub: t('quick.typeChapter'), group: bible, run: null }]
  else if (parsed.type === 'books')
    sugg = parsed.books.map(([abbrev, name]) => ({
      label: abbrev,
      sub: name,
      group: bible,
      run: () => {
        setBook(abbrev)
        setText('')
        setSel(0)
      }
    }))
  else if (parsed.type === 'collection')
    sugg = (search.data ?? []).slice(0, MAX_RESULTS).map((r) => {
      const [label, ...rest] = r.title.split(' — ')
      return { label, sub: rest.join(' — '), group: parsed.title, run: () => show(r.collection, r.itemRef) }
    })
  const cur = Math.min(sel, Math.max(0, sugg.length - 1))

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel(Math.min(cur + 1, sugg.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel(Math.max(cur - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      sugg[cur]?.run?.()
    } else if (e.key === 'Escape') reset()
    else if (e.key === 'Backspace' && !text && book) setBook(null)
  }

  const open = focus && sugg.length > 0
  return (
    <div className="quick-search">
      <label className="quick-search-box">
        <MagnifyingGlassIcon size={17} weight="duotone" aria-hidden />
        {book && <span className="tag tag-accent quick-search-tag">{bookName(book)}</span>}
        <input
          className="quick-search-input"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="quick-search-list"
          aria-label={t('nav.quickSearch')}
          placeholder={book ? t('quick.chapterPlaceholder') : t('nav.quickSearchPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setSel(0)
          }}
          onKeyDown={onKey}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
        />
      </label>
      {open && (
        <div className="quick-search-menu elev-md" id="quick-search-list" role="listbox" aria-label={t('nav.quickSearch')}>
          {sugg.map((g, i) => (
            <button
              key={`${g.group}:${g.label}:${i}`}
              type="button"
              role="option"
              aria-selected={i === cur}
              className="quick-search-option"
              // mousedown, so the input does not lose focus (and close the menu) before the click.
              onMouseDown={(e) => {
                e.preventDefault()
                g.run?.()
              }}
            >
              <span className="quick-search-main">
                <span className="quick-search-label">{g.label}</span>
                <span className="quick-search-sub">{g.sub}</span>
              </span>
              <span className="text-muted quick-search-group">{g.group}</span>
            </button>
          ))}
          <span className="text-muted quick-search-foot">{book ? t('quick.footChapter') : t('quick.foot')}</span>
        </div>
      )}
    </div>
  )
}
