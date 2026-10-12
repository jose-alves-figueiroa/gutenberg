/** Catechisms: grid of questions (1–107 / 1–196) → editor (question + answer). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { t } from '@shared/i18n'
import { slidesOf } from '@shared/slides'
import { json, jsonOrNull, useApi } from '../../api'
import { Leaf, useDraft, useScreenLimit, type SaveStatus } from './leaf'
import { Grid, LevelHeader, Loading, TextArea, TextField, type Crumb } from './parts'

interface Props {
  id: string
  label: string
  path: string[]
  go: (path: string[]) => void
}

export function CatechismBrowser({ id, label, path, go }: Props) {
  const api = useApi()
  const index = useQuery({ queryKey: ['catechism', id], queryFn: () => json(api.api.v1.library.catechisms[':id'].$get({ param: { id } })) })
  if (!index.data) return <Loading error={index.error} />
  const crumbs: Crumb[] = [{ label, go: () => go([]) }]
  const number = Number(path[0])

  if (!number) {
    const byNumber = new Map(index.data.questions.map((q) => [q.number, q.question]))
    return (
      <>
        <LevelHeader crumbs={crumbs} title={label} hint={t('library.chooseQuestion')} />
        <div className="lib-grids">
          <Grid
            kind="num"
            title={t('library.questionCount', { n: index.data.size })}
            items={Array.from({ length: index.data.size }, (_, i) => {
              const n = i + 1
              const question = byNumber.get(n)
              return { key: String(n), label: String(n), filled: question !== undefined, tip: question ?? t('library.notRegistered'), go: () => go([String(n)]) }
            })}
          />
        </div>
      </>
    )
  }

  crumbs.push({ label: t('library.question', { n: number }), go: () => go([String(number)]) })
  return (
    <>
      <LevelHeader crumbs={crumbs} title={t('library.question', { n: number })} hint={label} />
      <QuestionEditor catechismId={id} shortTitle={index.data.shortTitle} number={number} />
    </>
  )
}

function QuestionEditor({ catechismId, shortTitle, number }: { catechismId: string; shortTitle: string; number: number }) {
  const api = useApi()
  const qc = useQueryClient()
  const max = useScreenLimit()
  const param = { id: catechismId, number: String(number) }
  const record = useQuery({
    queryKey: ['catechism', catechismId, number],
    queryFn: () => jsonOrNull(api.api.v1.library.catechisms[':id'][':number'].$get({ param }))
  })
  const original = record.isSuccess ? (record.data ?? { question: '', answer: '', refs: '' }) : null
  const body = original && { question: original.question, answer: original.answer, refs: original.refs }
  const { draft, set, dirty, reset } = useDraft(body, String(number))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const save = useMutation({
    mutationFn: () => json(api.api.v1.library.catechisms[':id'][':number'].$put({ param, json: draft! })),
    onMutate: () => setStatus('saving'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['catechism', catechismId] })
      await qc.invalidateQueries({ queryKey: ['collections'] })
      reset()
      setStatus('saved')
    },
    onError: () => setStatus('error')
  })
  if (!draft) return <Loading error={record.error} />
  const slides = slidesOf({ kind: 'catechism', catechism: { shortTitle }, item: { number, question: draft.question, answer: draft.answer } }, max)
  const edit = (patch: Partial<typeof draft>) => (set(patch), setStatus('idle'))
  return (
    <>
      <div className="editor">
        <TextField label={t('field.question')} value={draft.question} onChange={(question) => edit({ question })} />
        <TextArea label={t('field.answer')} value={draft.answer} rows={6} onChange={(answer) => edit({ answer })} />
      </div>
      <Leaf
        slides={slides}
        max={max}
        editable
        dirty={dirty}
        status={status}
        onSave={() => save.mutate()}
        onDiscard={reset}
        item={record.data || status === 'saved' ? { collection: `catechism:${catechismId}`, itemRef: String(number) } : undefined}
      />
    </>
  )
}
