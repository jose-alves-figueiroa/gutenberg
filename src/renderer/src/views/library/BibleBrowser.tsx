/** Bible (read only): books (OT/NT) → chapters → verses, with passage selection. */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/i18n'
import { bibleUnits, fitSections } from '@shared/sections'
import { slidesOf, type BiblePassage } from '@shared/slides'
import { SectionStrip } from '../../components/Sections'
import { bibleItemRef } from '@shared/bible-ref'
import { BOOKS } from '@shared/collections'
import { json, useApi } from '../../api'
import { Leaf, useScreenLimit } from './leaf'
import { Grid, LevelHeader, Loading, useBox, type Crumb } from './parts'

/** Column size before it can be measured (tests, first paint): most chapters fit in one section. */
const COLUMN_FALLBACK = { width: 600, height: 4000 }
/** Below the verses: the view's bottom padding. */
const VERSES_RESERVE = 24
/** The strip of sections above the verses (32 px buttons and 15 px below), when there is one. */
const STRIP_HEIGHT = 47

/**
 * Design v2 → Bíblia › capítulo: a verse takes `12 + 24 × lines` px, with
 * `(column width − 52) / 8.4` characters per line (16/24 px text beside the number).
 */
export const verseHeight = (text: string, columnWidth: number): number =>
  12 + 24 * Math.max(1, Math.ceil(text.length / Math.max(10, (columnWidth - 52) / 8.4)))

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
  // Chapters one section at a time (E11, design v2): as many verses as fit the column's height.
  const list = useRef<HTMLDivElement>(null)
  // Measured again once the verses arrive (the list mounts with them).
  const column = useBox(list, VERSES_RESERVE, `${book}:${chapter}:${verses.data ? 'ready' : 'loading'}`, COLUMN_FALLBACK)
  const [shown, setShown] = useState({ key: '', section: 0 })
  // Report the passage after each change (functional updates keep rapid clicks consistent).
  useEffect(() => {
    onSelect?.(sel && book ? { book, chapter, from: sel.a, to: sel.b } : null)
  }, [sel, book, chapter, onSelect])
  const goPath = (p: string[]) => {
    setSel(null)
    go(p)
  }
  const units = verses.data ? bibleUnits(book, chapter, verses.data.map((v) => ({ number: v.number, weight: verseHeight(v.text, column.width) }))) : []
  const whole = fitSections(units, column.height)
  const sections = whole.length > 1 ? fitSections(units, column.height - STRIP_HEIGHT) : whole
  const holds = (n: number) => (x: (typeof sections)[number]) => x.from === undefined || (n >= x.from && n <= x.to!)
  // The section of the selection opens first.
  const own = shown.key === `${book}:${chapter}` && shown.section < sections.length ? shown.section : -1
  const current = own >= 0 ? own : sel ? Math.max(0, sections.findIndex(holds(sel.a))) : 0
  const section = sections[current]
  const inSection = (n: number) => !section || holds(n)(section)
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
              items={(testament === 'OT' ? BOOKS.slice(0, 39) : BOOKS.slice(39)).map(([abbrev, name]) => {
                const has = books.data.some((b) => b.book === abbrev)
                // Design v2: all 66 books; one without text in this Bible is faded and does nothing.
                return { key: abbrev, label: name, tip: abbrev, filled: has, go: () => has && goPath([abbrev]) }
              })}
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
      <div className="bib-chapter">
        <div className="bib-verses" ref={list}>
          {!verses.data ? (
            <Loading error={verses.error} />
          ) : (
            <>
              <SectionStrip sections={sections} current={current} onPick={(i) => setShown({ key: `${book}:${chapter}`, section: i })} />
              <div className="verses">
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
        </div>
        <div className="bib-aside">
          {sel && verses.data && (
            <Leaf
              aside
              slides={slidesOf({ kind: 'bible', item: passage(info.book, chapter, verses.data, sel) }, max)}
              max={max}
              editable={false}
              item={{ collection: `bible:${version}`, itemRef: bibleItemRef({ book: info.book, chapter, from: sel.a, to: sel.b }) }}
            />
          )}
        </div>
      </div>
    </>
  )
}

const passage = (book: string, chapter: number, verses: BiblePassage['verses'], sel: { a: number; b: number }): BiblePassage => ({
  book,
  chapter,
  verses: verses.filter((v) => v.number >= sel.a && v.number <= sel.b)
})
