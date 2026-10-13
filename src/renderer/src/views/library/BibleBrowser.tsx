/** Bible (read only): books (OT/NT) → chapters → verses, with passage selection. */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/i18n'
import { bibleUnits, fitSections, sectionUnits } from '@shared/sections'
import { slidesOf, type BiblePassage } from '@shared/slides'
import { SectionStrip, useCapacity } from '../../components/Sections'
import { bibleItemRef } from '@shared/bible-ref'
import { json, useApi } from '../../api'
import { Leaf, useScreenLimit } from './leaf'
import { Grid, LevelHeader, Loading, type Crumb } from './parts'

/** Verses shown at once before the list can be measured (most chapters fit). */
const VERSES_FALLBACK = 40

export interface Passage {
  book: string
  chapter: number
  from: number
  to: number
}

interface Props {
  version: string
  label: string
  path: string[]
  go: (path: string[]) => void
  /** Selected passage (prototype `selA`/`selB`), or null. */
  onSelect?: (passage: Passage | null) => void
}

export function BibleBrowser({ version, label, path, go, onSelect }: Props) {
  const api = useApi()
  const books = useQuery({
    queryKey: ['bible', version, 'books'],
    queryFn: () => json(api.api.v1.library.bible[':version'].books.$get({ param: { version } }))
  })
  const [book, chapterParam] = path
  const chapter = Number(chapterParam)
  const verses = useQuery({
    queryKey: ['bible', version, book, chapter],
    enabled: Boolean(book && chapter),
    queryFn: () =>
      json(api.api.v1.library.bible[':version'][':book'][':chapter'].$get({ param: { version, book, chapter: String(chapter) } }))
  })
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null)
  const max = useScreenLimit()
  // Long chapters one section at a time (E11): as many verses as fit, cut at the suggested parts.
  const list = useRef<HTMLDivElement>(null)
  const capacity = useCapacity(list, { reserve: 40, key: `${book}:${chapter}`, fallback: VERSES_FALLBACK })
  const [shown, setShown] = useState({ key: '', section: 0 })
  // Report the passage after each change (functional updates keep rapid clicks consistent).
  useEffect(() => {
    onSelect?.(sel && book ? { book, chapter, from: sel.a, to: sel.b } : null)
  }, [sel, book, chapter, onSelect])
  const goPath = (p: string[]) => {
    setSel(null)
    go(p)
  }
  const sections = verses.data ? fitSections(bibleUnits(book, chapter, verses.data.map((v) => ({ number: v.number, weight: 1 }))), capacity) : []
  const current = shown.key === `${book}:${chapter}` && shown.section < sections.length ? shown.section : 0
  const section = sections[current]
  const inSection = (n: number) => !section || section.from === undefined || (n >= section.from && n <= section.to!)

  if (!books.data) return <Loading error={books.error} />
  const info = books.data.find((b) => b.book === book)
  const crumbs: Crumb[] = [{ label, go: () => goPath([]) }]

  if (!info)
    return (
      <>
        <LevelHeader crumbs={crumbs} title={label} hint={t('library.chooseBook')} />
        <div className="lib-grids">
          {(['OT', 'NT'] as const).map((testament) => (
            <Grid
              key={testament}
              kind="name"
              title={t(testament === 'OT' ? 'library.oldTestament' : 'library.newTestament')}
              items={books.data
                .filter((b) => b.testament === testament)
                .map((b) => ({ key: b.book, label: b.name, tip: b.book, filled: true, go: () => goPath([b.book]) }))}
            />
          ))}
        </div>
      </>
    )

  crumbs.push({ label: info.name, go: () => goPath([info.book]) })
  if (!chapter)
    return (
      <>
        <LevelHeader crumbs={crumbs} title={info.name} hint={t('library.chooseChapter')} />
        <div className="lib-grids">
          <Grid
            kind="num"
            title={info.chapters === 1 ? t('library.chapterCount.one') : t('library.chapterCount.other', { n: info.chapters })}
            items={Array.from({ length: info.chapters }, (_, i) => ({
              key: String(i + 1),
              label: String(i + 1),
              filled: true,
              go: () => goPath([info.book, String(i + 1)])
            }))}
          />
        </div>
      </>
    )

  crumbs.push({ label: t('library.chapter', { n: chapter }), go: () => goPath([info.book, String(chapter)]) })
  const hint = !sel ? t('library.versesHint.start') : sel.a === sel.b ? t('library.versesHint.extend') : t('library.versesHint.restart')
  // First click starts a passage; the next one extends it; any click after a range restarts.
  const click = (v: number) =>
    setSel((prev) => (!prev || prev.a !== prev.b ? { a: v, b: v } : { a: Math.min(prev.a, v), b: Math.max(prev.a, v) }))
  return (
    <>
      <LevelHeader crumbs={crumbs} title={`${info.name} ${chapter}`} hint={hint} />
      {!verses.data ? (
        <Loading error={verses.error} />
      ) : (
        <>
          <SectionStrip sections={sections} current={current} onPick={(i) => setShown({ key: `${book}:${chapter}`, section: i })} />
          <div className="verses" ref={list}>
            {verses.data.filter((v) => inSection(v.number)).map((v) => {
              const inSel = sel !== null && v.number >= sel.a && v.number <= sel.b
              return (
                <button key={v.number} type="button" className="verse" aria-pressed={inSel} onClick={() => click(v.number)}>
                  <span className="verse-n">{v.number}</span>
                  <span className="verse-t">{v.text}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
      {sel && verses.data && (
        <Leaf
          slides={slidesOf({ kind: 'bible', item: passage(info.book, chapter, verses.data, sel) }, max)}
          units={sectionUnits({ kind: 'bible', item: passage(info.book, chapter, verses.data, sel) }, max)}
          max={max}
          editable={false}
          item={{ collection: `bible:${version}`, itemRef: bibleItemRef({ book: info.book, chapter, from: sel.a, to: sel.b }) }}
        />
      )}
    </>
  )
}

const passage = (book: string, chapter: number, verses: BiblePassage['verses'], sel: { a: number; b: number }): BiblePassage => ({
  book,
  chapter,
  verses: verses.filter((v) => v.number >= sel.a && v.number <= sel.b)
})
