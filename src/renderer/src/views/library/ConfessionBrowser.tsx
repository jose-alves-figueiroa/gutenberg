/** Confessions: chapters (title + "k de N seções") → sections (grid) → editor (running text). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { t } from '@shared/i18n'
import { slidesOf } from '@shared/slides'
import { json, jsonOrNull, useApi } from '../../api'
import { Leaf, useDraft, useScreenLimit, type SaveStatus } from './leaf'
import { Grid, LevelHeader, List, Loading, TextArea, type Crumb } from './parts'

interface Props {
  id: string
  label: string
  shortTitle: string
  path: string[]
  go: (path: string[]) => void
}

export function ConfessionBrowser({ id, label, shortTitle, path, go }: Props) {
  const api = useApi()
  const chapters = useQuery({
    queryKey: ['confession', id, 'chapters'],
    queryFn: () => json(api.api.v1.library.confessions[':id'].chapters.$get({ param: { id } }))
  })
  const [chapterId, sectionId] = path
  if (!chapters.data) return <Loading error={chapters.error} />
  const crumbs: Crumb[] = [{ label, go: () => go([]) }]
  const chapter = chapters.data.find((c) => c.chapter === chapterId)

  if (!chapter)
    return (
      <>
        <LevelHeader crumbs={crumbs} title={label} hint={t('library.chooseChapter')} />
        <List
          rows={chapters.data.map((c) => ({
            key: c.chapter,
            label: c.chapter,
            sub: c.title,
            meta: t('library.sectionsOf', { k: c.sections.length, n: c.expected ?? c.sections.length }),
            faded: c.sections.length === 0,
            go: () => go([c.chapter])
          }))}
        />
      </>
    )

  crumbs.push({ label: t('library.chapter', { n: chapter.chapter }), go: () => go([chapter.chapter]) })
  if (!sectionId) {
    const numbered = Array.from({ length: chapter.expected ?? 0 }, (_, i) => String(i + 1))
    const labels = [...numbered, ...chapter.sections.filter((s) => !numbered.includes(s))]
    return (
      <>
        <LevelHeader crumbs={crumbs} title={`${chapter.chapter}. ${chapter.title}`} hint={t('library.chooseSection')} />
        <div className="lib-grids">
          <Grid
            kind="num"
            title={labels.length === 1 ? t('library.sectionCount.one') : t('library.sectionCount.other', { n: labels.length })}
            items={labels.map((s) => {
              const filled = chapter.sections.includes(s)
              return { key: s, label: s, filled, tip: filled ? undefined : t('library.notRegistered'), go: () => go([chapter.chapter, s]) }
            })}
          />
        </div>
      </>
    )
  }

  crumbs.push({ label: t('library.section', { n: sectionId }), go: () => go([chapter.chapter, sectionId]) })
  return (
    <>
      <LevelHeader crumbs={crumbs} title={`${shortTitle} ${chapter.chapter}.${sectionId}`} hint={chapter.title} />
      <SectionEditor confessionId={id} shortTitle={shortTitle} chapter={chapter.chapter} chapterTitle={chapter.title} section={sectionId} />
    </>
  )
}

function SectionEditor({ confessionId, shortTitle, chapter, chapterTitle, section }: { confessionId: string; shortTitle: string; chapter: string; chapterTitle: string; section: string }) {
  const api = useApi()
  const qc = useQueryClient()
  const max = useScreenLimit()
  const param = { id: confessionId, chapter, section }
  const record = useQuery({
    queryKey: ['confession', confessionId, chapter, section],
    queryFn: () => jsonOrNull(api.api.v1.library.confessions[':id'][':chapter'][':section'].$get({ param }))
  })
  const original = record.isSuccess ? (record.data ?? { chapterTitle, text: '', refs: '' }) : null
  const body = original && { chapterTitle: original.chapterTitle, text: original.text, refs: original.refs }
  const { draft, set, dirty, reset } = useDraft(body, `${chapter}.${section}`)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const save = useMutation({
    mutationFn: () => json(api.api.v1.library.confessions[':id'][':chapter'][':section'].$put({ param, json: draft! })),
    onMutate: () => setStatus('saving'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['confession', confessionId] })
      await qc.invalidateQueries({ queryKey: ['collections'] })
      reset()
      setStatus('saved')
    },
    onError: () => setStatus('error')
  })
  if (!draft) return <Loading error={record.error} />
  const slides = slidesOf({ kind: 'confession', confession: { shortTitle }, chapter, item: { id: section, text: draft.text } }, max)
  return (
    <>
      <div className="editor">
        <TextArea label={t('field.sectionText')} value={draft.text} rows={8} onChange={(text) => (set({ text }), setStatus('idle'))} />
      </div>
      <Leaf
        slides={slides}
        max={max}
        editable
        dirty={dirty}
        status={status}
        onSave={() => save.mutate()}
        onDiscard={reset}
        item={record.data || status === 'saved' ? { collection: `confession:${confessionId}`, itemRef: `${chapter}.${section}` } : undefined}
      />
    </>
  )
}
