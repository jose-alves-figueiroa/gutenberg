/** Liturgy tab: services on the left; the current service's items and the picker on the right. */
import { CaretDownIcon, CaretUpIcon, PlusIcon, PresentationIcon, XIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { t } from '@shared/i18n'
import { json, useApi } from '../../api'
import { usePresentAndOpen } from '../../present'
import { useServices } from '../../service'
import { Pager, useFitRows, usePaging } from '../library/parts'
import { Picker } from './Picker'

/** Space below the services: pager and "Novo culto". */
const ASIDE_RESERVE = 120

export function LiturgyView() {
  const api = useApi()
  const qc = useQueryClient()
  const { services, current, select } = useServices()
  const detail = useQuery({
    queryKey: ['service', current?.id],
    enabled: current !== null,
    queryFn: () => json(api.api.v1.liturgy.services[':id'].$get({ param: { id: String(current!.id) } }))
  })
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['services'] })
    await qc.invalidateQueries({ queryKey: ['service'] })
  }
  const create = useMutation({
    mutationFn: () => json(api.api.v1.liturgy.services.$post({ json: { name: t('liturgy.newService') } })),
    onSuccess: async (s) => {
      select(s.id)
      await refresh()
    }
  })
  const remove = useMutation({
    mutationFn: (id: number) => json(api.api.v1.liturgy.services[':id'].$delete({ param: { id: String(id) } })),
    onSuccess: async () => {
      select(null)
      await refresh()
    }
  })

  return (
    <main className="view" role="tabpanel" id="view-liturgy" aria-labelledby="tab-liturgy">
      <div className="view-grid view-grid--liturgy">
        <aside className="lit-aside" aria-label={t('liturgy.aside')}>
          <h6 className="text-muted">{t('liturgy.aside')}</h6>
          <ServiceList />
          <button type="button" className="btn btn-ghost lit-new" onClick={() => create.mutate()}>
            <PlusIcon size={16} weight="duotone" aria-hidden />
            {t('liturgy.newService')}
          </button>
        </aside>
        <section className="view-main lit-main">
          {!current ? (
            <p className="empty-note">{services ? t('liturgy.noServices') : '…'}</p>
          ) : (
            <>
              <ServiceHeader
                key={`${current.id}:${current.name}`}
                id={current.id}
                name={current.name}
                onRenamed={refresh}
                onDelete={() => {
                  if (window.confirm(t('liturgy.confirmDelete', { name: current.name }))) remove.mutate(current.id)
                }}
              />
              {detail.data && <ItemRows serviceId={current.id} items={detail.data.items} onChange={refresh} />}
              <Picker serviceId={current.id} onAdded={refresh} />
            </>
          )}
        </section>
      </div>
    </main>
  )
}

/** Services, most recent first, paged to fit the window; the page follows the selected service. */
function ServiceList() {
  const { services = [], current, select } = useServices()
  const ref = useRef<HTMLDivElement>(null)
  const size = useFitRows(ref, ASIDE_RESERVE)
  const paging = usePaging(services.length, size)
  const { page, goPage } = paging
  // Adjusted while rendering (not in an effect) when another service is selected or created.
  const [followed, setFollowed] = useState<number | null>(null)
  const at = services.findIndex((s) => s.id === current?.id)
  if (current && current.id !== followed && at >= 0) {
    setFollowed(current.id)
    if (Math.floor(at / size) !== page) goPage(Math.floor(at / size))
  }
  return (
    <>
      <div className="lit-services" ref={ref}>
        {services.slice(page * size, (page + 1) * size).map((s) => (
          <button key={s.id} type="button" className="lit-service" aria-current={s.id === current?.id} onClick={() => select(s.id)}>
            <span className="lit-service-name">{s.name}</span>
            <span className="text-muted lit-service-count">{s.count === 1 ? t('liturgy.items.one') : t('liturgy.items.other', { n: s.count })}</span>
          </button>
        ))}
      </div>
      <Pager {...paging} compact />
    </>
  )
}

function ServiceHeader({ id, name, onRenamed, onDelete }: { id: number; name: string; onRenamed: () => void; onDelete: () => void }) {
  const api = useApi()
  const present = usePresentAndOpen()
  // Remounted (key) when the stored name changes, so local state starts from it.
  const [value, setValue] = useState(name)
  const rename = useMutation({
    mutationFn: (newName: string) => json(api.api.v1.liturgy.services[':id'].$patch({ param: { id: String(id) }, json: { name: newName } })),
    onSuccess: onRenamed
  })
  const commit = () => {
    const v = value.trim()
    if (v && v !== name) rename.mutate(v)
    else setValue(name)
  }
  return (
    <div className="lit-head">
      <div className="lit-head-text">
        <div className="kicker lit-kicker">{t('liturgy.kicker')}</div>
        <input
          className="lit-name"
          aria-label={t('liturgy.name')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <button type="button" className="btn btn-ghost" onClick={onDelete}>
        {t('liturgy.delete')}
      </button>
      <button type="button" className="btn btn-primary" disabled={present.pending} onClick={() => void present.run({ type: 'service', serviceId: id })}>
        <PresentationIcon size={16} weight="duotone" aria-hidden />
        {t('liturgy.present')}
      </button>
    </div>
  )
}

interface Item {
  position: number
  moment: string
  title: string
  collectionLabel: string
  screens: number
  missing: boolean
}

function ItemRows({ serviceId, items, onChange }: { serviceId: number; items: Item[]; onChange: () => void }) {
  const api = useApi()
  const param = (position: number) => ({ id: String(serviceId), position: String(position) })
  const items$ = api.api.v1.liturgy.services[':id'].items[':position']
  const move = useMutation({
    mutationFn: ({ position, delta }: { position: number; delta: -1 | 1 }) => json(items$.move.$post({ param: param(position), json: { delta } })),
    onSuccess: onChange
  })
  const remove = useMutation({ mutationFn: (position: number) => json(items$.$delete({ param: param(position) })), onSuccess: onChange })
  const setMoment = useMutation({
    mutationFn: ({ position, moment }: { position: number; moment: string }) => json(items$.$patch({ param: param(position), json: { moment } })),
    onSuccess: onChange
  })
  if (items.length === 0) return <p className="empty-note">{t('liturgy.noItems')}</p>
  return (
    <ol className="lit-rows">
      {items.map((it) => (
        <li key={`${it.position}:${it.title}`} className={`lit-row${it.missing ? ' lit-row--missing' : ''}`}>
          <span className="lit-n text-muted">{String(it.position).padStart(2, '0')}</span>
          <MomentInput key={it.moment} value={it.moment} onCommit={(moment) => setMoment.mutate({ position: it.position, moment })} />
          <span className="lit-item">
            <span className="lit-title">{it.title}</span>
            <span className="text-muted lit-meta">
              {it.collectionLabel} · {it.screens === 1 ? t('liturgy.screens.one') : t('liturgy.screens.other', { n: it.screens })}
            </span>
          </span>
          <span className="lit-actions">
            <button type="button" className="btn btn-ghost btn-icon lit-icon" title={t('liturgy.up')} aria-label={t('liturgy.up')} disabled={it.position === 1} onClick={() => move.mutate({ position: it.position, delta: -1 })}>
              <CaretUpIcon size={17} weight="duotone" />
            </button>
            <button type="button" className="btn btn-ghost btn-icon lit-icon" title={t('liturgy.down')} aria-label={t('liturgy.down')} disabled={it.position === items.length} onClick={() => move.mutate({ position: it.position, delta: 1 })}>
              <CaretDownIcon size={17} weight="duotone" />
            </button>
            <button type="button" className="btn btn-ghost btn-icon lit-icon lit-icon--remove" title={t('liturgy.remove')} aria-label={t('liturgy.remove')} onClick={() => remove.mutate(it.position)}>
              <XIcon size={17} weight="duotone" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Moment field: edited locally, saved on blur or Enter (remounted by key when the stored value changes). */
function MomentInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <input
      className="input lit-moment"
      aria-label={t('liturgy.moment')}
      placeholder={t('liturgy.moment')}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
