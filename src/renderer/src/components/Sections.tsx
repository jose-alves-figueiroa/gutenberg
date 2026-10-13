/**
 * Long items one section at a time (PLAN.md → E11): how many screens (or rows) fit the window, and
 * the strip of sections to jump between them.
 */
import { useLayoutEffect, useState, type RefObject } from 'react'
import { t } from '@shared/i18n'
import type { Section } from '@shared/sections'

/** Capacity when the layout can't be measured (tests, first paint). */
export const FALLBACK_CAPACITY = 12

/**
 * Cards (or rows) that fit in a grid/list without scrolling: columns of the first row times the
 * rows (of average height) that fit between the grid's top and the bottom of the window, minus `reserve` px (a sticky
 * bar below). `viewport`: the whole window height instead (a grid low on a page that scrolls).
 */
export function useCapacity(grid: RefObject<HTMLElement | null>, opts: { reserve: number; viewport?: boolean; key?: unknown; fallback?: number }) {
  const [capacity, setCapacity] = useState(opts.fallback ?? FALLBACK_CAPACITY)
  const { reserve, viewport = false, key } = opts
  useLayoutEffect(() => {
    const measure = () => {
      const el = grid.current
      const cells = el ? ([...el.children] as HTMLElement[]) : []
      const first = cells[0]?.getBoundingClientRect()
      if (!el || !first || first.height <= 0) return
      const columns = Math.max(1, cells.filter((c) => c.getBoundingClientRect().top === first.top).length)
      const gap = parseFloat(getComputedStyle(el).rowGap) || 0
      const top = viewport ? 0 : el.getBoundingClientRect().top
      // Average height: verses and screens of one, two or three lines.
      const height = cells.reduce((n, c) => n + c.getBoundingClientRect().height, 0) / cells.length
      const rows = Math.floor((window.innerHeight - top - reserve + gap) / (height + gap))
      setCapacity(Math.max(columns, columns * rows))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [grid, reserve, viewport, key])
  return capacity
}

interface StripProps {
  sections: Section[]
  /** Section shown. */
  current: number
  /** Section on the air (Present), highlighted. */
  live?: number
  onPick: (index: number) => void
}

/** Chips with the sections; nothing when there is only one. */
export function SectionStrip({ sections, current, live, onPick }: StripProps) {
  if (sections.length < 2) return null
  return (
    <nav className="sections" aria-label={t('section.label')}>
      {sections.map((s, i) => (
        <button
          key={`${s.start}:${s.title}`}
          type="button"
          className={i === live ? 'section-chip section-chip--live' : 'section-chip'}
          aria-pressed={i === current}
          title={s.detail || undefined}
          onClick={() => onPick(i)}
        >
          {s.title}
          {s.detail && <span className="section-chip-detail">{s.detail}</span>}
        </button>
      ))}
    </nav>
  )
}
