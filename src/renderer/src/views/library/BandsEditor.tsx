/**
 * Biblioteca › Faixas (design v2, PLAN.md → E18): the lists of service bands, sacraments and
 * preachers, edited as data, beside a preview of the selected one as the "Faixas" output draws it.
 */
import { PlusIcon, XIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { DEFAULT_BANDS, entryBand, sermonBand, type BandLibrary } from '@shared/bands'
import { t } from '@shared/i18n'
import { DEFAULT_STYLE, toPayload } from '@shared/payload'
import { json, useApi } from '../../api'
import { OverlayPreview } from '../../components/OverlayPreview'
import { LevelHeader, Pager, useFitRows, usePaging } from './parts'

export type BandList = 'services' | 'sacraments' | 'preachers'
export const BAND_LISTS: readonly BandList[] = ['services', 'sacraments', 'preachers']

/** Below the rows: pager, Salvar/Descartar and the view's padding. */
const ROWS_RESERVE = 110
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`

export function BandsEditor({ list }: { list: BandList }) {
  const api = useApi()
  const qc = useQueryClient()
  const stored = useQuery({ queryKey: ['bands'], queryFn: () => json(api.api.v1.bands.$get()) })
  const outputs = useQuery({ queryKey: ['connection'], queryFn: () => json(api.api.v1.connection.$get()) })
  const [draft, setDraft] = useState<BandLibrary | null>(null)
  const [picked, setPicked] = useState(0)
  const rows = useRef<HTMLDivElement>(null)
  const size = useFitRows(rows, ROWS_RESERVE)
  const library = draft ?? stored.data ?? DEFAULT_BANDS
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(stored.data)
  const save = useMutation({
    mutationFn: (next: BandLibrary) => json(api.api.v1.bands.$put({ json: next })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['bands'] })
      setDraft(null)
    }
  })
  const entries = list === 'preachers' ? library.preachers.map((p) => ({ id: p.id, title: p.name, subtitle: '' })) : library[list]
  const paging = usePaging(entries.length, size)
  const set = (next: BandLibrary) => setDraft(next)
  const update = (i: number, patch: { title?: string; subtitle?: string }) => {
    if (list === 'preachers') set({ ...library, preachers: library.preachers.map((p, j) => (j === i ? { ...p, name: patch.title ?? p.name } : p)) })
    else set({ ...library, [list]: library[list].map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }
  const remove = (i: number) => {
    if (list === 'preachers') set({ ...library, preachers: library.preachers.filter((_, j) => j !== i) })
    else set({ ...library, [list]: library[list].filter((_, j) => j !== i) })
  }
  const add = () => {
    const title = t(`bands.new.${list}`)
    if (list === 'preachers') set({ ...library, preachers: [...library.preachers, { id: newId('preacher'), name: title }] })
    else set({ ...library, [list]: [...library[list], { id: newId(list === 'services' ? 'service' : 'sacrament'), title, subtitle: '' }] })
    setPicked(entries.length)
    paging.goPage(Math.floor(entries.length / size))
  }
  const style = outputs.data?.outputs.find((o) => o.collections.includes('bands'))?.style ?? DEFAULT_STYLE
  const chosen = entries[Math.min(picked, entries.length - 1)]
  const band = !chosen
    ? null
    : list === 'preachers'
      ? sermonBand(t('bands.kind.sermon'), { preacher: chosen.title, title: '', text: '' })
      : entryBand(list === 'services' ? 'service' : 'sacrament', t(list === 'services' ? 'bands.kind.service' : 'bands.kind.sacrament'), chosen, new Date())
  const valid = entries.every((e) => e.title.trim())

  return (
    <>
      <LevelHeader
        crumbs={[{ label: t('library.bandsGroup') }, { label: t(`bands.list.${list}`) }]}
        title={t(`bands.list.${list}`)}
        hint={t(`bands.hint.${list}`)}
        action={
          <button type="button" className="btn btn-secondary" onClick={add}>
            <PlusIcon size={16} weight="duotone" aria-hidden />
            {t(`bands.new.${list}`)}
          </button>
        }
      />
      <div className="bands">
        <div className="bands-list">
          <div className="bands-rows" ref={rows}>
            {entries.length === 0 && <p className="empty-note">{t('bands.empty')}</p>}
            {entries.slice(paging.page * size, (paging.page + 1) * size).map((e, k) => {
              const i = paging.page * size + k
              return (
                <div key={e.id} className="bands-row" aria-current={i === picked} onFocus={() => setPicked(i)} onClick={() => setPicked(i)}>
                  <input
                    className="input"
                    aria-label={list === 'preachers' ? t('bands.name') : t('bands.title')}
                    value={e.title}
                    maxLength={120}
                    onChange={(ev) => update(i, { title: ev.target.value })}
                  />
                  {list !== 'preachers' && (
                    <input
                      className="input"
                      aria-label={t('bands.subtitle')}
                      placeholder={list === 'services' ? t('bands.subtitleDate') : t('bands.subtitle')}
                      value={e.subtitle}
                      maxLength={120}
                      onChange={(ev) => update(i, { subtitle: ev.target.value })}
                    />
                  )}
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={t('bands.remove', { name: e.title })} onClick={() => remove(i)}>
                    <XIcon size={17} weight="duotone" />
                  </button>
                </div>
              )
            })}
          </div>
          <Pager {...paging} />
          <div className="bands-actions">
            <button type="button" className="btn btn-secondary" disabled={!dirty || save.isPending} onClick={() => setDraft(null)}>
              {t('leaf.discard')}
            </button>
            <button type="button" className="btn btn-primary" disabled={!dirty || !valid || save.isPending} onClick={() => save.mutate(library)}>
              {t('leaf.save')}
            </button>
          </div>
        </div>
        <div className="bands-preview">
          <span className="text-muted out-kicker">{t('bands.preview')}</span>
          {band && <OverlayPreview payload={toPayload({ collection: null, slide: null, band }, style, 1)} />}
        </div>
      </div>
    </>
  )
}
