/**
 * The chosen item ("folha"): editor draft state, the preview of the screens as OBS will show them
 * and the sticky action bar (README → Biblioteca → Folha).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { DEFAULT_MAX } from '@shared/autobreak'
import { t } from '@shared/i18n'
import { fitSections, type SectionUnit } from '@shared/sections'
import type { Slide } from '@shared/slides'
import { SectionStrip, useCapacity } from '../../components/Sections'
import { Pager, usePaging } from './parts'
import { json, useApi } from '../../api'
import { usePresentAndOpen } from '../../present'
import { useServices } from '../../service'

/** Draft over a stored record (or a blank template for a record not registered yet). */
export function useDraft<T extends object>(original: T | null | undefined, key: string) {
  const [state, setState] = useState<{ key: string; draft: T | null }>({ key, draft: null })
  const own = state.key === key ? state.draft : null
  const draft = own ?? original ?? null
  const dirty = own !== null && JSON.stringify(own) !== JSON.stringify(original)
  return {
    draft,
    dirty,
    set: (patch: Partial<T>) =>
      setState((s) => {
        const base = (s.key === key ? s.draft : null) ?? original
        return base ? { key, draft: { ...base, ...patch } } : s
      }),
    reset: () => setState({ key, draft: null })
  }
}

/** Per-screen character limit stored in the database (settings), for previews. */
export function useScreenLimit(): number {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => json(api.api.v1.library.settings.$get()) })
  return settings.data?.screenCharLimit ?? DEFAULT_MAX
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface LeafProps {
  slides: Slide[]
  /** Where long previews may be cut into sections (E11). */
  units?: SectionUnit[]
  song?: boolean
  max: number
  editable: boolean
  dirty?: boolean
  status?: SaveStatus
  onSave?: () => void
  onDiscard?: () => void
  /** The item as a liturgy reference; absent while it is not saved (cannot be added yet). */
  item?: { collection: string; itemRef: string }
  /**
   * Design v2: a column beside the content (Bible chapter, hymn) with one card per screen, the
   * two real OBS lines each, paged to the column's height instead of cut into sections.
   */
  aside?: boolean
}

/** Space for the sticky action bar and the strip, so one section fits the window. */
const LEAF_RESERVE = 180
/** Below the aside's cards: its pager and action bar, and the view's bottom padding. */
const ASIDE_RESERVE = 150

export function Leaf({ slides, units, song, max, editable, dirty = false, status = 'idle', onSave, onDiscard, item, aside = false }: LeafProps) {
  const api = useApi()
  const qc = useQueryClient()
  const { current } = useServices()
  const present = usePresentAndOpen()
  const [added, setAdded] = useState<string | null>(null)
  const cards = useRef<HTMLDivElement>(null)
  const capacity = useCapacity(cards, aside ? { reserve: ASIDE_RESERVE, key: slides.length } : { reserve: LEAF_RESERVE, viewport: true })
  const sections = units && !aside ? fitSections(units, capacity) : []
  const paging = usePaging(slides.length, aside ? capacity : slides.length)
  const [picked, setPicked] = useState(0)
  const shown = picked < sections.length ? picked : 0
  const section = aside
    ? { start: paging.page * capacity, end: (paging.page + 1) * capacity }
    : (sections[shown] ?? { start: 0, end: slides.length })
  const add = useMutation({
    mutationFn: () =>
      json(api.api.v1.liturgy.services[':id'].items.$post({ param: { id: String(current!.id) }, json: { ...item!, moment: '' } })),
    onSuccess: async () => {
      setAdded(current!.name)
      await qc.invalidateQueries({ queryKey: ['services'] })
      await qc.invalidateQueries({ queryKey: ['service', current!.id] })
    }
  })
  const note = dirty
    ? t('leaf.unsaved')
    : status === 'saved'
      ? t('leaf.saved')
      : status === 'error'
        ? t('leaf.saveError')
        : added
          ? t('liturgy.added', { name: added })
          : ''
  const label = t(slides.length === 1 ? 'leaf.preview.one' : 'leaf.preview.other', { n: slides.length })
  if (aside)
    return (
      <section className="leaf leaf--aside" aria-label={label}>
        <span className="leaf-label text-muted">{label}</span>
        <div className="slide-cards slide-cards--aside" ref={cards}>
          {slides.slice(section.start, section.end).map((s, i) => (
            <div key={section.start + i} className="slide-card slide-card--aside">
              <span className="slide-card-head text-muted">{s.header}</span>
              {s.lines.map((line, j) => (
                <span key={j} className="slide-card-line">
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
        <Pager {...paging} compact />
        <div className="leaf-bar leaf-bar--aside">
          <button type="button" className="btn btn-primary" disabled={!item || dirty || present.pending} onClick={() => item && void present.run({ type: 'adhoc', ...item })}>
            {t('leaf.present')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!item || !current || dirty || add.isPending}
            title={current ? undefined : t('liturgy.chooseService')}
            onClick={() => add.mutate()}
          >
            {t('leaf.addToLiturgy')}
          </button>
          <span className="leaf-status text-muted" role="status">
            {note}
          </span>
        </div>
      </section>
    )
  return (
    <section className="leaf" aria-label={t(slides.length === 1 ? 'leaf.preview.one' : 'leaf.preview.other', { n: slides.length })}>
      <div className="leaf-head">
        <span className="leaf-label text-muted">{t(slides.length === 1 ? 'leaf.preview.one' : 'leaf.preview.other', { n: slides.length })}</span>
        <span className="leaf-note text-muted">{song ? t('leaf.breakSong') : t('leaf.breakProse', { max })}</span>
      </div>
      <SectionStrip sections={sections} current={shown} onPick={setPicked} />
      <div className="slide-cards" ref={cards}>
        {slides.slice(section.start, section.end).map((s, i) => (
          <div key={i} className="slide-card">
            <span className="slide-card-head text-muted">{s.header}</span>
            <span className="slide-card-text">{s.lines.join('\n')}</span>
          </div>
        ))}
      </div>
      <div className="leaf-bar">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!item || dirty || present.pending}
          onClick={() => item && void present.run({ type: 'adhoc', ...item })}
        >
          {t('leaf.present')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!item || !current || dirty || add.isPending}
          title={current ? undefined : t('liturgy.chooseService')}
          onClick={() => add.mutate()}
        >
          {t('leaf.addToLiturgy')}
        </button>
        <span className="leaf-status text-muted" role="status">
          {note}
        </span>
        {editable && (
          <span className="leaf-edit">
            <button type="button" className="btn btn-secondary" disabled={!dirty || status === 'saving'} onClick={onDiscard}>
              {t('leaf.discard')}
            </button>
            <button type="button" className="btn btn-primary" disabled={!dirty || status === 'saving'} onClick={onSave}>
              {t('leaf.save')}
            </button>
          </span>
        )}
      </div>
    </section>
  )
}
