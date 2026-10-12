/** Building blocks shared by the library browsers (prototype: breadcrumb, header, grids). */
import type { ReactNode } from 'react'

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
  go: () => void
}

/** Rows with a number/label, a title and a muted meta column (prototype `lv.list`). */
export function List({ rows }: { rows: ListRow[] }) {
  return (
    <div className="lib-list">
      {rows.map((r) => (
        <button key={r.key} type="button" className={`lib-row${r.faded ? ' lib-row--faded' : ''}`} onClick={r.go}>
          <span className="lib-row-label">{r.label}</span>
          <span className="lib-row-sub">{r.sub}</span>
          <span className="lib-row-meta text-muted">{r.meta}</span>
        </button>
      ))}
    </div>
  )
}

export function TextField({ label, value, onChange, width }: { label: string; value: string; onChange: (v: string) => void; width?: string }) {
  return (
    <label className="field" style={width ? { maxWidth: width } : undefined}>
      <span className="field-label">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function TextArea({ label, value, onChange, rows = 10 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea className="input editor-text" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
