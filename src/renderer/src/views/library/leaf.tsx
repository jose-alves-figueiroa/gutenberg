/**
 * The chosen item ("folha"): editor draft state, the preview of the screens as OBS will show them
 * and the sticky action bar (README → Biblioteca → Folha).
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DEFAULT_MAX } from '@shared/autobreak'
import { t } from '@shared/i18n'
import type { Slide } from '@shared/slides'
import { json, useApi } from '../../api'

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
  song?: boolean
  max: number
  editable: boolean
  dirty?: boolean
  status?: SaveStatus
  onSave?: () => void
  onDiscard?: () => void
}

export function Leaf({ slides, song, max, editable, dirty = false, status = 'idle', onSave, onDiscard }: LeafProps) {
  const note = dirty ? t('leaf.unsaved') : status === 'saved' ? t('leaf.saved') : status === 'error' ? t('leaf.saveError') : ''
  return (
    <section className="leaf" aria-label={t(slides.length === 1 ? 'leaf.preview.one' : 'leaf.preview.other', { n: slides.length })}>
      <div className="leaf-head">
        <span className="leaf-label text-muted">{t(slides.length === 1 ? 'leaf.preview.one' : 'leaf.preview.other', { n: slides.length })}</span>
        <span className="leaf-note text-muted">{song ? t('leaf.breakSong') : t('leaf.breakProse', { max })}</span>
      </div>
      <div className="slide-cards">
        {slides.map((s, i) => (
          <div key={i} className="slide-card">
            <span className="slide-card-head text-muted">{s.header}</span>
            <span className="slide-card-text">{s.lines.join('\n')}</span>
          </div>
        ))}
      </div>
      <div className="leaf-bar">
        <button type="button" className="btn btn-primary" disabled title={t('leaf.notYet')}>
          {t('leaf.present')}
        </button>
        <button type="button" className="btn btn-secondary" disabled title={t('leaf.notYet')}>
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
