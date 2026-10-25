/**
 * Present tab (README → "Apresentar"): the sequence on the left (the ad hoc item on top), the
 * viewed item's screens, and Anterior / Próximo. The state lives in the main process.
 */
import { ArrowLeftIcon, ArrowRightIcon, EyeSlashIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/i18n'
import { fitSections, sectionOfSlide } from '@shared/sections'
import { SectionStrip } from '../../components/Sections'
import { Pager, useBox } from '../library/parts'
import { usePresent } from '../../present'

/** Space kept below the screens for the Anterior / Próximo bar. */
const BAR_RESERVE = 130
/** Design v2 → Apresentar: 140 px cards at least 240 px wide, 15 px apart. */
const CARD = { width: 240, height: 140, gap: 15 }
/** The pager below the grid, when a section has more screens than fit. */
const PAGER_HEIGHT = 40

/** Columns and screens per section of the grid in a box (design v2 formulas). */
export function slideGrid(box: { width: number; height: number }) {
  const columns = Math.max(2, Math.floor((box.width + CARD.gap) / (CARD.width + CARD.gap)))
  const rows = Math.max(1, Math.floor((box.height + CARD.gap) / (CARD.height + CARD.gap)))
  return { columns, capacity: columns * rows }
}

export function PresentView() {
  const { view, command } = usePresent()
  // Item being looked at; null follows the item on the air.
  const [picked, setPicked] = useState<number | null>(null)
  const items = view?.items ?? []
  const state = view?.state
  const live = state?.live ?? 0
  const viewed = picked !== null && picked < items.length ? picked : live
  const item = items[viewed]

  // Long items one section at a time (E11): as many screens as fit; the section follows the air.
  const grid = useRef<HTMLDivElement>(null)
  // Measured again when the strip of sections (above the grid) or the pager (below it) appears.
  const [crowded, setCrowded] = useState(false)
  const box = useBox(grid, BAR_RESERVE + (crowded ? PAGER_HEIGHT : 0), `${viewed}:${item?.itemRef}:${crowded}`)
  const { columns, capacity } = slideGrid(box)
  const sections = item ? fitSections(item.units, capacity) : []
  const liveSections = items[live] ? fitSections(items[live].units, capacity) : []
  const liveSection = sectionOfSlide(liveSections, state?.slide ?? 0)
  // Section being looked at; null follows the screen on the air.
  const [peek, setPeek] = useState<{ item: number; section: number } | null>(null)
  const shown = peek && peek.item === viewed && peek.section < sections.length ? peek.section : viewed === live ? liveSection : 0
  const section = sections[shown] ?? { start: 0, end: item?.slides.length ?? 0 }
  // Design v2: a section (an item that can't be cut) bigger than the grid pages; the page follows the air.
  const pages = Math.max(1, Math.ceil((section.end - section.start) / capacity))
  const [pagePeek, setPagePeek] = useState<{ key: string; page: number } | null>(null)
  const pageKey = `${viewed}:${shown}`
  const slide = state?.slide ?? 0
  const followed = viewed === live && slide >= section.start && slide < section.end ? Math.floor((slide - section.start) / capacity) : 0
  const page = Math.min(pages - 1, pagePeek?.key === pageKey ? pagePeek.page : followed)
  const from = section.start + page * capacity
  const to = Math.min(section.end, from + capacity)
  if ((sections.length > 1 || pages > 1) !== crowded) setCrowded(sections.length > 1 || pages > 1)

  const go = (index: number, slide: number) => {
    setPicked(null)
    setPeek(null)
    setPagePeek(null)
    command({ type: 'go', index, slide })
  }
  const step = (delta: -1 | 1) => {
    setPicked(null)
    setPeek(null)
    setPagePeek(null)
    command({ type: 'step', delta })
  }
  /** Shift+← / Shift+→: first screen of the previous / next section of the item on the air. */
  const jump = (delta: -1 | 1) => {
    const target = liveSections[liveSection + delta]
    if (target) go(live, target.start)
  }

  const jumpRef = useRef(jump)
  useEffect(() => {
    jumpRef.current = jump
  })
  // ← / → (and PageUp / PageDown, as presentation remotes send) outside text fields; with Shift,
  // a whole section.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const forward = e.key === 'ArrowRight' || e.key === 'PageDown'
      if (!forward && e.key !== 'ArrowLeft' && e.key !== 'PageUp') return
      e.preventDefault()
      if (e.shiftKey) return jumpRef.current(forward ? 1 : -1)
      setPicked(null)
      setPeek(null)
      command({ type: 'step', delta: forward ? 1 : -1 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command])

  let nextHint = ''
  const current = items[live]
  if (current && state) {
    const following = items[live + 1]
    const nextSection = liveSections[liveSection + 1]
    nextHint =
      state.slide + 1 < current.slides.length
        ? nextSection && state.slide + 1 === nextSection.start
          ? `${nextSection.title} · ${current.slides[state.slide + 1].lines[0]}`
          : current.slides[state.slide + 1].lines[0]
        : following
          ? `${following.adhoc ? t('present.adhoc') : following.moment || t('common.empty')} · ${following.title}`
          : t('present.end')
  }

  return (
    <main className="view view--present" role="tabpanel" id="view-present" aria-labelledby="tab-present">
      <div className="view-grid view-grid--present">
        <aside className="pres-aside" aria-label={t('present.aside')}>
          <h6 className="text-muted">{view?.service?.name ?? t('present.aside')}</h6>
          {items.map((it, i) => (
            <div key={`${i}:${it.collection}:${it.itemRef}`} className="pres-item" aria-current={i === viewed}>
              <button type="button" className="pres-item-pick" onClick={() => setPicked(i)}>
                <span className="pres-item-top">
                  <span className={it.adhoc ? 'pres-moment pres-moment--adhoc' : 'pres-moment'}>{it.adhoc ? t('present.adhoc') : it.moment || t('common.empty')}</span>
                  {i === live && !state?.blank && <span className="pres-live">{t('present.onAir')}</span>}
                </span>
                <span className="pres-item-title">{it.title}</span>
                <span className="text-muted pres-item-col">{it.collectionLabel}</span>
              </button>
              {it.adhoc && (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon pres-drop"
                  title={t('present.dropAdhoc')}
                  aria-label={t('present.dropAdhoc')}
                  onClick={() => {
                    setPicked(null)
                    command({ type: 'dropAdhoc' })
                  }}
                >
                  <XIcon size={16} weight="duotone" />
                </button>
              )}
            </div>
          ))}
          {view && items.length === 0 && <p className="empty-note">{t('present.noItems')}</p>}
        </aside>
        <section className="pres-main">
          <div className="pres-head">
            <div className="pres-head-text">
              <div className="lit-kicker">{item ? `${item.adhoc ? t('present.adhoc') : item.moment || t('common.empty')} · ${item.collectionLabel}` : ''}</div>
              <h2 className="pres-title">{item ? item.title : t('present.emptyLiturgy')}</h2>
            </div>
            <button type="button" className="btn btn-secondary" disabled={!state} onClick={() => state && command({ type: 'blank', blank: !state.blank })}>
              <EyeSlashIcon size={17} weight="duotone" aria-hidden />
              {state?.blank ? t('present.show') : t('present.blank')}
            </button>
          </div>
          <SectionStrip
            sections={sections}
            current={shown}
            live={viewed === live && !state?.blank ? liveSection : undefined}
            onPick={(i) => setPeek({ item: viewed, section: i })}
          />
          <div className="pres-slides" ref={grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {item?.slides.slice(from, to).map((s, k) => {
              const i = from + k
              const onAir = viewed === live && i === state?.slide && !state.blank
              const upNext = viewed === live && i === (state?.slide ?? 0) + 1
              return (
                <button key={i} type="button" className={onAir ? 'pres-slide pres-slide--live' : 'pres-slide'} aria-pressed={onAir} onClick={() => go(viewed, i)}>
                  <span className="pres-slide-top">
                    <span className="text-muted">{s.header}</span>
                    {onAir && <span className="pres-live">{t('present.onAir')}</span>}
                    {!onAir && upNext && <span className="pres-next">{t('present.upNext')}</span>}
                  </span>
                  <span className="pres-slide-text">{s.lines.join('\n')}</span>
                </button>
              )
            })}
          </div>
          <Pager page={page} pages={pages} goPage={(p) => setPagePeek({ key: pageKey, page: Math.max(0, Math.min(pages - 1, p)) })} />
          <div className="pres-bar">
            <button type="button" className="btn btn-secondary pres-prev" disabled={items.length === 0} onClick={() => step(-1)}>
              <ArrowLeftIcon size={20} weight="duotone" aria-hidden />
              {t('present.prev')}
            </button>
            <button type="button" className="btn btn-primary pres-next-btn" disabled={items.length === 0} onClick={() => step(1)}>
              <span className="pres-next-label">
                {t('present.next')}
                <ArrowRightIcon size={20} weight="duotone" aria-hidden />
              </span>
              <span className="pres-next-hint">{nextHint}</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
