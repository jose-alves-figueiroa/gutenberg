/**
 * Songbooks. With an item label (the Psalter): grid 1–150 → versions/parts → editor, plus the
 * unnumbered canticles; otherwise (HNC…): list → editor. Paths: [] · ['ps', n] · ['song', id] ·
 * ['new'] / ['new', n].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Song } from '@shared/data-model'
import { t } from '@shared/i18n'
import { lyricsToStanzas } from '@shared/lyrics'
import type { SongRecord, SongbookInfo, SongSummary } from '@shared/library-schemas'
import { REQUIRED } from '@shared/requirements'
import { slidesOf, songHeader } from '@shared/slides'
import { json, jsonOrNull, useApi } from '../../api'
import { Leaf, useDraft, useScreenLimit, type SaveStatus } from './leaf'
import { Grid, LevelHeader, List, Loading, TextArea, TextField, type Crumb } from './parts'

interface Props {
  id: string
  label: string
  path: string[]
  go: (path: string[]) => void
}

const psalmOf = (s: Pick<SongSummary, 'number'>) => s.number.split('.')[0]

export function SongbookBrowser({ id, label, path, go }: Props) {
  const api = useApi()
  // A new song is saved, then reopened by id: keep the "saved" confirmation across that remount.
  const [created, setCreated] = useState<string | null>(null)
  const book = useQuery({ queryKey: ['songbook', id], queryFn: () => json(api.api.v1.library.songbooks[':id'].$get({ param: { id } })) })
  if (!book.data) return <Loading error={book.error} />
  const { info, songs } = book.data
  const psalter = Boolean(info.itemLabel)
  const crumbs: Crumb[] = [{ label, go: () => go([]) }]
  const [step, arg] = path
  const songRow = (s: SongSummary) => ({
    key: s.id,
    label: psalter ? `${s.number}${s.version}` : s.number || '—',
    sub: psalter ? s.firstLine || '—' : s.title,
    meta: s.author,
    go: () => go(['song', s.id])
  })

  if (!step) {
    if (!psalter)
      return (
        <>
          <LevelHeader
            crumbs={crumbs}
            title={label}
            hint={t('library.songs')}
            action={<button type="button" className="btn btn-secondary" onClick={() => go(['new'])}>{t('library.newSong')}</button>}
          />
          <List pageKey={`songbook:${id}`} rows={songs.map(songRow)} />
        </>
      )
    const counts = new Map<string, number>()
    for (const s of songs) if (s.number) counts.set(psalmOf(s), (counts.get(psalmOf(s)) ?? 0) + 1)
    const unnumbered = songs.filter((s) => !s.number)
    return (
      <>
        <LevelHeader crumbs={crumbs} title={label} hint={t('library.choosePsalm')} />
        <div className="lib-grids">
          <Grid
            kind="num"
            title={t('library.psalmCount', { n: REQUIRED.psalter.psalms })}
            items={Array.from({ length: REQUIRED.psalter.psalms }, (_, i) => {
              const n = String(i + 1)
              const k = counts.get(n) ?? 0
              const tip = k === 0 ? t('library.noVersion') : k === 1 ? t('library.versionCount.one') : t('library.versionCount.other', { n: k })
              return { key: n, label: n, filled: k > 0, tip, go: () => go(['ps', n]) }
            })}
          />
          {unnumbered.length > 0 && <List pageKey={`songbook:${id}:unnumbered`} rows={unnumbered.map((s) => ({ ...songRow(s), label: '', sub: s.title }))} />}
        </div>
      </>
    )
  }

  if (step === 'ps') {
    const versions = songs.filter((s) => psalmOf(s) === arg)
    crumbs.push({ label: t('library.psalm', { n: arg }), go: () => go(['ps', arg]) })
    return (
      <>
        <LevelHeader
          crumbs={crumbs}
          title={t('library.psalm', { n: arg })}
          hint={versions.length ? t('library.chooseVersion') : t('library.noVersionYet')}
          action={<button type="button" className="btn btn-secondary" onClick={() => go(['new', arg])}>{t('library.newVersion')}</button>}
        />
        <List rows={versions.map(songRow)} />
      </>
    )
  }

  const existing = step === 'song' ? songs.find((s) => s.id === arg) : undefined
  const psalm = existing ? psalmOf(existing) : step === 'new' ? arg : undefined
  if (psalter && psalm) crumbs.push({ label: t('library.psalm', { n: psalm }), go: () => go(['ps', psalm]) })
  return (
    <SongEditor
      key={path.join('/')}
      info={info}
      songId={existing?.id}
      template={blankSong(info, songs, psalm)}
      crumbs={crumbs}
      initialStatus={existing && existing.id === created ? 'saved' : 'idle'}
      onCreated={(newId) => {
        setCreated(newId)
        go(['song', newId])
      }}
    />
  )
}

function blankSong(info: SongbookInfo, songs: SongSummary[], psalm?: string): SongRecord {
  const taken = songs.filter((s) => psalm && psalmOf(s) === psalm).map((s) => s.version)
  const version = psalm ? (['A', 'B', 'C', 'D', 'E', 'F'].find((v) => !taken.includes(v)) ?? '') : ''
  return {
    id: '',
    songbookId: info.id,
    number: psalm ?? '',
    version,
    title: info.itemLabel ? '' : t('library.newSong'),
    versification: '',
    author: '',
    artist: '',
    copyright: '',
    lyrics: ''
  }
}

/** SongRecord (lyrics as text) → Song (stanzas) for slidesOf/songHeader. */
function toSong(r: SongRecord): Song {
  return {
    format: 1,
    id: r.id,
    songbook: r.songbookId,
    number: r.number,
    version: r.version,
    title: r.title,
    versification: r.versification,
    credits: { author: r.author, artist: r.artist, copyright: r.copyright },
    stanzas: lyricsToStanzas(r.lyrics),
    source: { name: 'edited' }
  }
}

interface EditorProps {
  info: SongbookInfo
  songId?: string
  template: SongRecord
  crumbs: Crumb[]
  initialStatus: SaveStatus
  onCreated: (id: string) => void
}

function SongEditor({ info, songId, template, crumbs, initialStatus, onCreated }: EditorProps) {
  const api = useApi()
  const qc = useQueryClient()
  const max = useScreenLimit()
  const record = useQuery({
    queryKey: ['song', songId],
    enabled: Boolean(songId),
    queryFn: () => jsonOrNull(api.api.v1.library.songs[':id'].$get({ param: { id: songId! } }))
  })
  const original = songId ? (record.data ?? null) : template
  const { draft, set, dirty, reset } = useDraft(original, songId ?? 'new')
  const [status, setStatus] = useState<SaveStatus>(initialStatus)
  const psalter = Boolean(info.itemLabel)
  const save = useMutation({
    mutationFn: () => {
      const d = draft!
      const title = psalter && d.number ? `${info.itemLabel} ${d.number}${d.version}` : d.title
      return json(api.api.v1.library.songs.$put({ json: { ...d, title } }))
    },
    onMutate: () => setStatus('saving'),
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ['songbook', info.id] })
      await qc.invalidateQueries({ queryKey: ['song', saved.id] })
      await qc.invalidateQueries({ queryKey: ['collections'] })
      reset()
      setStatus('saved')
      if (!songId) onCreated(saved.id)
    },
    onError: () => setStatus('error')
  })
  if (!draft) return <Loading error={record.error} />
  const song = toSong(draft)
  const header = songHeader(info, song)
  const version = draft.version ? t('library.version', { v: draft.version }) : t('library.singleVersion')
  const trail: Crumb[] = [...crumbs, { label: psalter ? version : draft.title || header }]
  const edit = (patch: Partial<SongRecord>) => (set(patch), setStatus('idle'))
  return (
    <>
      <LevelHeader crumbs={trail} title={header || t('library.newSong')} hint={draft.author} />
      <div className="editor">
        {psalter ? (
          <div className="editor-row editor-row--psalm">
            <TextField label={t('field.psalm')} value={draft.number} onChange={(number) => edit({ number })} />
            <TextField label={t('field.version')} value={draft.version} onChange={(version) => edit({ version: version.toUpperCase() })} />
            <TextField label={t('field.versification')} value={draft.versification} onChange={(versification) => edit({ versification })} />
          </div>
        ) : (
          <>
            <div className="editor-row editor-row--hymn">
              <TextField label={t('field.number')} value={draft.number} onChange={(number) => edit({ number })} />
              <TextField label={t('field.title')} value={draft.title} onChange={(title) => edit({ title })} />
            </div>
            <TextField label={t('field.author')} value={draft.author} onChange={(author) => edit({ author })} />
          </>
        )}
        <TextArea label={t('field.lyrics')} value={draft.lyrics} rows={14} onChange={(lyrics) => edit({ lyrics })} />
      </div>
      <Leaf
        slides={slidesOf({ kind: 'song', songbook: info, item: song }, max)}
        song
        max={max}
        editable
        dirty={dirty}
        status={status}
        onSave={() => save.mutate()}
        onDiscard={reset}
        item={songId ? { collection: `songbook:${info.id}`, itemRef: songId } : undefined}
      />
    </>
  )
}
