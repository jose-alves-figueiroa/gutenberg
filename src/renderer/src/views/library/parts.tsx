/** Building blocks shared by the library browsers (prototype: breadcrumb, header, grids). */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { SectionStrip } from '../../components/Sections'
import { t } from '@shared/i18n'

export interface Crumb {
  label: string
  go?: () => void
}

export function LevelHeader({ crumbs, title, hint, action }: { crumbs: Crumb[]; title: string; hint?: string; action?: ReactNode }) {
  return (
    <>
      <nav className="crumbs" aria-label="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb-wrap">
            {i > 0 && <span className="text-muted" aria-hidden>›</span>}
            <button type="button" className="crumb" aria-current={i === crumbs.length - 1 ? 'page' : undefined} onClick={c.go}>
              {c.label}
            </button>
          </span>
        ))}
      </nav>
      <div className="lib-head">
        <div className="lib-head-text">
          <h2>{title}</h2>
          {hint && <div className="lib-hint text-muted">{hint}</div>}
        </div>
        {action}
      </div>
    </>
  )
}

export interface GridItem {
  key: string
  label: string
  /** Registered in the database; unregistered cells are faded and create the record when clicked. */
  filled: boolean
  tip?: string
  go: () => void
}

/** A titled grid of cells: `num` for numbers (chapters, questions, psalms), `name` for book names. */
export function Grid({ title, kind, items }: { title: string; kind: 'num' | 'name'; items: GridItem[] }) {
  return (
    <section className="lib-grid-group">
      <span className="lib-grid-title text-muted">{title}</span>
      <div className={`lib-grid lib-grid--${kind}`}>
        {items.map((it) => (
          <button key={it.key} type="button" className={`cell${it.filled ? '' : ' cell--empty'}`} title={it.tip} onClick={it.go}>
            {it.label}
          </button>
        ))}
      </div>
    </section>
  )
}

/** Design v2 → catecismos: 54×38 px cells, 4 px apart; what does not fit becomes sections. */
const CELL = { width: 54, height: 38, gap: 4 }
const MAX_COLUMNS = 20
const STRIP = 47

/** Columns and rows of fixed cells in a box, and the numbers per section (design v2 formulas). */
export function gridSections(count: number, box: { width: number; height: number }) {
  const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.floor((box.width + CELL.gap) / (CELL.width + CELL.gap))))
  const rows = (height: number) => Math.max(1, Math.floor((height - 42) / (CELL.height + CELL.gap)))
  let size = columns * rows(box.height)
  if (size < count) size = columns * rows(box.height - STRIP)
  const sections = []
  for (let start = 0; start < count; start += size) {
    const end = Math.min(count, start + size)
    sections.push({ title: `${start + 1}–${end}`, detail: '', start, end })
  }
  return { columns, sections }
}

/** Numbered cells (questions) that fit the space below, in sections when they don't. */
export function NumberGrid({ title, items }: { title: string; items: GridItem[] }) {
  const ref = useRef<HTMLElement>(null)
  const box = useBox(ref, 24, items.length)
  const { columns, sections } = gridSections(items.length, box)
  const [picked, setPicked] = useState(0)
  const current = picked < sections.length ? picked : 0
  const section = sections[current] ?? { start: 0, end: items.length }
  return (
    <section className="lib-grid-group" ref={ref}>
      <span className="lib-grid-title text-muted">{title}</span>
      <SectionStrip sections={sections} current={current} onPick={setPicked} />
      <div className="lib-grid lib-grid--fixed" style={{ gridTemplateColumns: `repeat(${columns}, ${CELL.width}px)` }}>
        {items.slice(section.start, section.end).map((it) => (
          <button key={it.key} type="button" className={`cell${it.filled ? '' : ' cell--empty'}`} title={it.tip} onClick={it.go}>
            {it.label}
          </button>
        ))}
      </div>
    </section>
  )
}

export function Loading({ error }: { error?: unknown }) {
  return <p className="empty-note">{error ? String((error as Error).message ?? error) : '…'}</p>
}

export interface ListRow {
  key: string
  label: string
  sub: string
  meta?: string
  /** Faded (nothing registered yet). */
  faded?: boolean
  /** Only the label faded (a hymn without a number: "s/nº"). */
  mutedLabel?: boolean
  go: () => void
}

/** Rows per page when the layout can't be measured (tests, first paint). */
export const FALLBACK_PAGE_SIZE = 12
/** Space kept below the list for the pager and the view's bottom padding. */
const PAGER_RESERVE = 88
/** Last page shown per list, so going back from an item lands on the same page. */
const lastPage = new Map<string, number>()

/** Rows that fit between the list's top and the bottom of the window, minus `reserve` px below it. */
export function useFitRows(list: RefObject<HTMLElement | null>, reserve = PAGER_RESERVE) {
  const [size, setSize] = useState(FALLBACK_PAGE_SIZE)
  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current
      const row = el?.firstElementChild as HTMLElement | null
      const rowHeight = row?.getBoundingClientRect().height ?? 0
      if (!el || rowHeight <= 0) return
      const free = window.innerHeight - el.getBoundingClientRect().top - reserve
      setSize(Math.max(3, Math.floor(free / rowHeight)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [list, reserve])
  return size
}

/** Height from an element's top down to the bottom of the window, minus `reserve` px (null until measured). */
export function useFillHeight(ref: RefObject<HTMLElement | null>, reserve: number, key?: unknown) {
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current
      if (el) setHeight(Math.max(240, window.innerHeight - el.getBoundingClientRect().top - reserve))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ref, reserve, key])
  return height
}

/** Width of an element and the height left below its top down to the window's bottom, minus `reserve` px. */
export function useBox(ref: RefObject<HTMLElement | null>, reserve: number, key?: unknown, fallback = { width: 600, height: 4000 }) {
  const [box, setBox] = useState(fallback)
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width > 0) setBox({ width: r.width, height: window.innerHeight - r.top - reserve })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ref, reserve, key])
  return box
}

/** Page shown of `count` rows, `size` per page; `pageKey` remembers it while the list is away. */
export function usePaging(count: number, size: number, pageKey?: string) {
  const pages = Math.max(1, Math.ceil(count / size))
  const [wanted, setWanted] = useState(() => (pageKey && lastPage.get(pageKey)) || 0)
  const page = Math.min(wanted, pages - 1)
  const goPage = (p: number) => {
    const next = Math.max(0, Math.min(p, pages - 1))
    setWanted(next)
    if (pageKey) lastPage.set(pageKey, next)
  }
  return { page, pages, goPage }
}

/** Design v2: « ‹ Página k de n › », nothing when there is a single page; `compact` (narrow sidebars): ‹ k de n ›. */
export function Pager({ page, pages, goPage, compact = false }: ReturnType<typeof usePaging> & { compact?: boolean }) {
  if (pages < 2) return null
  return (
    <nav className="pager" aria-label={t('pager.label')}>
      <button type="button" className="btn btn-ghost btn-icon pager-arrow" disabled={page === 0} onClick={() => goPage(page - 1)} aria-label={t('pager.previous')}>‹</button>
      <span className="pager-status text-muted" aria-live="polite">{t(compact ? 'pager.short' : 'pager.status', { k: page + 1, n: pages })}</span>
      <button type="button" className="btn btn-ghost btn-icon pager-arrow" disabled={page === pages - 1} onClick={() => goPage(page + 1)} aria-label={t('pager.next')}>›</button>
    </nav>
  )
}

/**
 * Rows with a number/label, a title and a muted meta column (prototype `lv.list`), paged to fit the
 * window instead of scrolling; ←/→ change page. `pageKey` remembers the page while the operator opens an item;
 * `plain`: titles only, without the number column (search results).
 */
export function List({ rows, pageKey, plain = false }: { rows: ListRow[]; pageKey?: string; plain?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const size = useFitRows(ref)
  const paging = usePaging(rows.length, size, pageKey)
  const { page, pages, goPage } = paging

  useEffect(() => {
    if (pages < 2) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowRight') goPage(page + 1)
      else if (e.key === 'ArrowLeft') goPage(page - 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <div className={plain ? 'lib-list lib-list--plain' : 'lib-list'} ref={ref}>
        {rows.slice(page * size, (page + 1) * size).map((r) => (
          <button key={r.key} type="button" className={`lib-row${r.faded ? ' lib-row--faded' : ''}`} onClick={r.go}>
            <span className={r.mutedLabel ? 'lib-row-label lib-row-label--muted' : 'lib-row-label'}>{r.label}</span>
            <span className="lib-row-sub">{r.sub}</span>
            <span className="lib-row-meta text-muted">{r.meta}</span>
          </button>
        ))}
      </div>
      <Pager {...paging} />
    </>
  )
}

export function TextField({ label, value, onChange, width, placeholder }: { label: string; value: string; onChange: (v: string) => void; width?: string; placeholder?: string }) {
  return (
    <label className="field" style={width ? { maxWidth: width } : undefined}>
      <span className="field-label">{label}</span>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function TextArea({ label, value, onChange, rows = 10, fill = false }: { label: string; value: string; onChange: (v: string) => void; rows?: number; fill?: boolean }) {
  return (
    <label className={fill ? 'field field--fill' : 'field'}>
      <span className="field-label">{label}</span>
      <textarea className="input editor-text" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
