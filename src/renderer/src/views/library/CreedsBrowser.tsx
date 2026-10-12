/** Creeds: list → editor (title + running text). The three creeds are fixed (apostles, nicene, athanasian). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { t } from '@shared/i18n'
import { slidesOf } from '@shared/slides'
import { json, useApi } from '../../api'
import { Leaf, useDraft, useScreenLimit, type SaveStatus } from './leaf'
import { LevelHeader, List, Loading, TextArea, TextField, type Crumb } from './parts'

type CreedId = 'apostles' | 'nicene' | 'athanasian'

export function CreedsBrowser({ label, path, go }: { label: string; path: string[]; go: (path: string[]) => void }) {
  const api = useApi()
  const qc = useQueryClient()
  const max = useScreenLimit()
  const creeds = useQuery({ queryKey: ['creeds'], queryFn: () => json(api.api.v1.library.creeds.$get()) })
  const current = creeds.data?.find((c) => c.id === path[0])
  const body = current ? { title: current.title, text: current.text } : null
  const { draft, set, dirty, reset } = useDraft(body, path[0] ?? '')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const save = useMutation({
    mutationFn: () => json(api.api.v1.library.creeds[':id'].$put({ param: { id: current!.id as CreedId }, json: draft! })),
    onMutate: () => setStatus('saving'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['creeds'] })
      reset()
      setStatus('saved')
    },
    onError: () => setStatus('error')
  })
  if (!creeds.data) return <Loading error={creeds.error} />
  const crumbs: Crumb[] = [{ label, go: () => go([]) }]
  if (!current || !draft)
    return (
      <>
        <LevelHeader crumbs={crumbs} title={label} hint={t('library.creeds')} />
        <List rows={creeds.data.map((c) => ({ key: c.id, label: '', sub: c.title, go: () => go([c.id]) }))} />
      </>
    )
  crumbs.push({ label: draft.title || current.title })
  const edit = (patch: Partial<typeof draft>) => (set(patch), setStatus('idle'))
  return (
    <>
      <LevelHeader crumbs={crumbs} title={draft.title || current.title} />
      <div className="editor">
        <TextField label={t('field.title')} value={draft.title} onChange={(title) => edit({ title })} />
        <TextArea label={t('field.text')} value={draft.text} rows={14} onChange={(text) => edit({ text })} />
      </div>
      <Leaf
        slides={slidesOf({ kind: 'creed', item: { id: current.id as CreedId, title: draft.title, text: draft.text } }, max)}
        max={max}
        editable
        dirty={dirty}
        status={status}
        onSave={() => save.mutate()}
        onDiscard={reset}
      />
    </>
  )
}
