/** "Adicionar à liturgia": collection chips (Bíblia | Hinário e salmos | Doutrina), search and results. */
import { BookOpenIcon, PlusCircleIcon } from '@phosphor-icons/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { bibleItemRef, bibleRefTitle, booksFor, parseBibleRef } from '@shared/bible-ref'
import { GROUPS, groupLabel, groupOf } from '@shared/collections'
import { t } from '@shared/i18n'
import type { CollectionSummary } from '@shared/library-schemas'
import { json, useApi } from '../../api'
import { collectionLabel } from '../library/LibraryView'

/** `bible:ara`, `songbook:hnc`, `confession:wcf`, `catechism:wsc` or `creeds`. */
export const collectionRef = (c: Pick<CollectionSummary, 'kind' | 'id'>): string => (c.kind === 'creeds' ? 'creeds' : `${c.kind}:${c.id}`)

interface Result {
  key: string
  title: string
  icon: 'add' | 'book'
  action: () => void
}

export function Picker({ serviceId, onAdded }: { serviceId: number; onAdded: () => void }) {
  const api = useApi()
  const collections = useQuery({ queryKey: ['collections'], queryFn: () => json(api.api.v1.library.collections.$get()) })
  const [picked, setPicked] = useState<string>('bible:ara')
  const [q, setQ] = useState('')
  const current = collections.data?.find((c) => collectionRef(c) === picked)
  const search = useQuery({
    queryKey: ['search', picked, q],
    enabled: Boolean(current && current.kind !== 'bible'),
    queryFn: () => json(api.api.v1.library.search.$get({ query: { collection: picked, q } }))
  })
  const add = useMutation({
    mutationFn: (item: { collection: string; itemRef: string }) =>
      json(api.api.v1.liturgy.services[':id'].items.$post({ param: { id: String(serviceId) }, json: { ...item, moment: '' } })),
    onSuccess: () => {
      setQ('')
      onAdded()
    }
  })

  let results: Result[] = []
  if (current?.kind === 'bible') {
    const ref = parseBibleRef(q)
    if (ref) {
      const title = bibleRefTitle(ref)
      results = [{ key: 'ref', title: t('liturgy.addRef', { title }), icon: 'add', action: () => add.mutate({ collection: picked, itemRef: bibleItemRef(ref) }) }]
    } else if (q.trim())
      results = booksFor(q)
        .slice(0, 12)
        .map(([abbrev, name]) => ({ key: abbrev, title: name, icon: 'book', action: () => setQ(`${abbrev} `) }))
  } else if (search.data)
    results = search.data.map((r) => ({ key: r.itemRef, title: r.title, icon: 'add', action: () => add.mutate({ collection: r.collection, itemRef: r.itemRef }) }))

  const placeholder =
    current?.kind === 'bible' ? t('liturgy.placeholder.bible') : current?.kind === 'catechism' ? t('liturgy.placeholder.catechism') : t('liturgy.placeholder.other')

  return (
    <section className="picker" aria-label={t('liturgy.add')}>
      <h4>{t('liturgy.add')}</h4>
      <div className="picker-groups">
        {GROUPS.map((g) => (
          <div key={g} className="picker-group">
            <span className="picker-group-label text-muted">{groupLabel(g)}</span>
            <div className="picker-chips">
              {collections.data
                ?.filter((c) => groupOf(c.kind) === g)
                .map((c) => (
                  <button
                    key={collectionRef(c)}
                    type="button"
                    className="chip"
                    aria-pressed={collectionRef(c) === picked}
                    onClick={() => {
                      setPicked(collectionRef(c))
                      setQ('')
                    }}
                  >
                    {collectionLabel(c)}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <input className="input picker-search" aria-label={t('liturgy.search')} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="picker-results">
        {results.map((r) => (
          <button key={r.key} type="button" className="picker-result" onClick={r.action}>
            {r.icon === 'add' ? <PlusCircleIcon size={18} weight="duotone" aria-hidden /> : <BookOpenIcon size={18} weight="duotone" aria-hidden />}
            <span>{r.title}</span>
          </button>
        ))}
        {q.trim() && results.length === 0 && (current?.kind === 'bible' || search.data) && <p className="empty-note">{t('liturgy.noResults')}</p>}
      </div>
    </section>
  )
}
