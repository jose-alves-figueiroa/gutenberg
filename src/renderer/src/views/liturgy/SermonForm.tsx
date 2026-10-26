/** Liturgia › Pregação (design v2, PLAN.md → E18): the sermon of this service and its band. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { sermonBand, type Sermon } from '@shared/bands'
import { t } from '@shared/i18n'
import { DEFAULT_STYLE, toPayload } from '@shared/payload'
import { json, useApi } from '../../api'
import { OverlayPreview } from '../../components/OverlayPreview'

export function SermonForm({ serviceId }: { serviceId: number }) {
  const api = useApi()
  const qc = useQueryClient()
  const param = { id: String(serviceId) }
  const stored = useQuery({ queryKey: ['sermon', serviceId], queryFn: () => json(api.api.v1.liturgy.services[':id'].sermon.$get({ param })) })
  const bands = useQuery({ queryKey: ['bands'], queryFn: () => json(api.api.v1.bands.$get()) })
  const [draft, setDraft] = useState<Sermon | null>(null)
  const save = useMutation({
    mutationFn: (s: Sermon) => json(api.api.v1.liturgy.services[':id'].sermon.$put({ param, json: s })),
    onSuccess: (s) => qc.setQueryData(['sermon', serviceId], s)
  })
  const sermon = draft ?? stored.data ?? { preacher: '', title: '', text: '' }
  const edit = (patch: Partial<Sermon>) => setDraft({ ...sermon, ...patch })
  const commit = (patch: Partial<Sermon> = {}) => {
    const next = { ...sermon, ...patch }
    setDraft(next)
    save.mutate(next)
  }
  const preachers = bands.data?.preachers ?? []
  const names = [...new Set([...preachers.map((p) => p.name), ...(sermon.preacher ? [sermon.preacher] : [])])]
  const band = sermonBand(t('bands.kind.sermon'), sermon)

  return (
    <section className="sermon" aria-label={t('liturgy.tab.sermon')}>
      <label className="field">
        <span className="field-label">{t('sermon.preacher')}</span>
        <select className="input" value={sermon.preacher} onChange={(e) => commit({ preacher: e.target.value })}>
          <option value="">{t('sermon.choose')}</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      {preachers.length === 0 && <p className="text-muted out-note">{t('sermon.noPreachers')}</p>}
      <label className="field">
        <span className="field-label">{t('sermon.title')}</span>
        <input className="input" value={sermon.title} maxLength={120} onChange={(e) => edit({ title: e.target.value })} onBlur={() => commit()} />
      </label>
      <label className="field">
        <span className="field-label">{t('sermon.text')}</span>
        <input className="input" value={sermon.text} maxLength={120} placeholder={t('sermon.textPlaceholder')} onChange={(e) => edit({ text: e.target.value })} onBlur={() => commit()} />
      </label>
      {band && <OverlayPreview payload={toPayload({ collection: null, slide: null, band }, DEFAULT_STYLE, 1)} />}
      <p className="text-muted out-note">{t('sermon.note')}</p>
    </section>
  )
}
