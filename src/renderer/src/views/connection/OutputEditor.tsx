/**
 * Form for one output (design v2 → Conexão › editor de saída): name and URL slug, then three
 * parts (collections, text, band) beside a live 16:9 preview drawn by the overlay page itself.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '@shared/i18n'
import { RESERVED_SLUGS, type Output } from '@shared/outputs'
import { DEFAULT_STYLE, toPayload, type PayloadStyle } from '@shared/payload'
import { sceneFontPx } from '@shared/overlay-view'
import { useApi } from '../../api'

interface CollectionInfo {
  kind: string
  id: string
  title: string
}

interface Props {
  initial: Output
  /** The other outputs: their slugs and collections are taken. */
  others: Output[]
  collections: CollectionInfo[]
  saving: boolean
  onSave: (output: Output) => void
  onCancel: () => void
}

const KINDS = ['bible', 'songbook', 'confession', 'catechism'] as const
const TABS = ['collections', 'text', 'band'] as const
const HALIGN = ['left', 'center', 'right'] as const
const WIDTHS = ['full', 'fit'] as const
const STROKES = ['none', 'thin', 'thick'] as const
const SAMPLES = ['text', 'music'] as const

/** "Every document of a kind" (`songbook:*`). */
export const kindLabel = (kind: string): string =>
  KINDS.includes(kind as (typeof KINDS)[number]) ? t(`outputs.kind.${kind as (typeof KINDS)[number]}`) : `${kind}:*`

/** "Faixa inferior · 12 linhas · fundo 78%" (the output cards). */
export const styleSummary = (style: PayloadStyle): string =>
  t('outputs.summary', { position: t(`outputs.position.${style.text.valign}`), n: style.text.fontMaxRows, opacity: style.band.opacity })

/** Bindings offered: every document of a kind, then each document (creeds is a single one). */
function bindings(collections: CollectionInfo[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  for (const kind of KINDS) {
    out.push({ value: `${kind}:*`, label: kindLabel(kind) })
    for (const c of collections.filter((x) => x.kind === kind)) out.push({ value: `${kind}:${c.id}`, label: c.title })
  }
  out.push({ value: 'creeds', label: collections.find((x) => x.kind === 'creeds')?.title ?? 'creeds' })
  return out
}

/** A segmented choice (radio buttons in the `.seg` look). */
function Seg<T extends string>({ name, label, value, options, text, onChange }: { name: string; label: string; value: T; options: readonly T[]; text: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((v) => (
        <label key={v} className="seg-opt">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
          {text(v)}
        </label>
      ))}
    </div>
  )
}

function Range({ id, label, value, min, max, onChange }: { id: string; label: ReactNode; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" className="out-range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

const SAMPLE_SLIDES = {
  text: { collection: 'bible:ara', slide: { header: 'Hebreus 12.15 (2/3)', lines: ['nem haja alguma raiz de amargura que,', 'brotando, vos perturbe,'] } },
  music: { collection: 'songbook:hnc', slide: { header: 'Castelo forte', lines: ['Castelo forte é nosso Deus,', 'espada e bom escudo;'] } }
}

/** The overlay page in preview mode (`/overlay?preview`), fed the sample screen with this style. */
function OverlayPreview({ style, sample }: { style: PayloadStyle; sample: (typeof SAMPLES)[number] }) {
  const api = useApi()
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const src = `${new URL(api.overlay.$url().toString()).origin}/overlay?preview`
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage(toPayload(SAMPLE_SLIDES[sample], style, 1), '*')
  }, [ready, style, sample])
  return <iframe ref={frame} className="out-preview" title={t('outputs.previewFrame')} src={src} onLoad={() => setReady(true)} />
}

export function OutputEditor({ initial, others, collections, saving, onSave, onCancel }: Props) {
  const [o, setO] = useState<Output>(initial)
  const [tab, setTab] = useState<(typeof TABS)[number]>('collections')
  const [sample, setSample] = useState<(typeof SAMPLES)[number]>('text')
  const taken = new Map(others.flatMap((x) => x.collections.map((c) => [c, x.name] as const)))
  const slugTaken = others.some((x) => x.slug === o.slug)
  const slugOk = /^[a-z0-9-]{1,32}$/.test(o.slug) && !RESERVED_SLUGS.includes(o.slug) && !slugTaken
  const style = o.style
  const setStyle = (patch: Partial<PayloadStyle>) => setO({ ...o, style: { ...style, ...patch } })
  const setBand = (patch: Partial<PayloadStyle['band']>) => setStyle({ band: { ...style.band, ...patch } })
  const toggle = (value: string, on: boolean) =>
    setO({ ...o, collections: on ? [...o.collections, value] : o.collections.filter((c) => c !== value) })
  const rows = (k: 'text' | 'music') => Number(style[k].fontMaxRows) || Number(DEFAULT_STYLE[k].fontMaxRows)
  const setRows = (k: 'text' | 'music', n: number) => setStyle({ [k]: { ...style[k], fontMaxRows: String(n) } })
  const fonts = [...new Set([DEFAULT_STYLE.font, style.font])]

  return (
    <form
      className="out-editor"
      aria-label={t('outputs.editing', { name: initial.name || t('outputs.new') })}
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...o, name: o.name.trim() })
      }}
    >
      <div className="out-form">
        <div className="out-pair">
          <div className="field">
            <label htmlFor="out-name">{t('outputs.name')}</label>
            <input id="out-name" className="input" value={o.name} maxLength={60} onChange={(e) => setO({ ...o, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="out-slug">{t('outputs.slug')}</label>
            <input
              id="out-slug"
              className="input"
              value={o.slug}
              maxLength={32}
              aria-invalid={!slugOk}
              onChange={(e) => setO({ ...o, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            />
          </div>
        </div>
        {!slugOk && o.slug && <p className="con-error">{slugTaken ? t('outputs.slugTaken') : t('outputs.slugInvalid')}</p>}
        <Seg name="out-tab" label={t('outputs.tabs')} value={tab} options={TABS} text={(v) => t(`outputs.tab.${v}`)} onChange={setTab} />

        {tab === 'collections' && (
          <div className="out-checks" role="group" aria-label={t('outputs.collections')}>
            {bindings(collections).map((b) => {
              const owner = taken.get(b.value)
              const kindOn = b.value.includes(':') && !b.value.endsWith(':*') && o.collections.includes(`${b.value.split(':')[0]}:*`)
              return (
                <label key={b.value} className={b.value.endsWith(':*') ? 'con-check con-check--kind' : 'con-check'}>
                  <input
                    type="checkbox"
                    checked={o.collections.includes(b.value) || kindOn}
                    disabled={!!owner || kindOn}
                    onChange={(e) => toggle(b.value, e.target.checked)}
                  />
                  {b.label}
                  {owner && <span className="text-muted">{` · ${t('outputs.inOther', { name: owner })}`}</span>}
                </label>
              )
            })}
          </div>
        )}

        {tab === 'text' && (
          <div className="out-part">
            <div className="out-row">
              <div className="field out-grow">
                <label htmlFor="out-font">{t('outputs.font')}</label>
                <select id="out-font" className="input" value={style.font} onChange={(e) => setStyle({ font: e.target.value })}>
                  {fonts.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="out-color">{t('outputs.color')}</label>
                <input id="out-color" type="color" className="out-color" value={style.color} onChange={(e) => setStyle({ color: e.target.value.toUpperCase() })} />
              </div>
              <label className="out-check">
                <input type="checkbox" checked={style.bold} onChange={(e) => setStyle({ bold: e.target.checked })} />
                {t('outputs.bold')}
              </label>
            </div>
            <div className="field">
              <span className="out-label">{t('outputs.halign')}</span>
              <Seg name="out-halign" label={t('outputs.halign')} value={style.halign} options={HALIGN} text={(v) => t(`outputs.align.${v}`)} onChange={(halign) => setStyle({ halign })} />
            </div>
            <Range id="out-rows-text" label={t('outputs.rowsText', { n: rows('text'), px: sceneFontPx(rows('text')) })} value={rows('text')} min={6} max={20} onChange={(n) => setRows('text', n)} />
            <Range id="out-rows-music" label={t('outputs.rowsMusic', { n: rows('music'), px: sceneFontPx(rows('music')) })} value={rows('music')} min={6} max={20} onChange={(n) => setRows('music', n)} />
            <p className="text-muted out-note">{t('outputs.rowsHint')}</p>
          </div>
        )}

        {tab === 'band' && (
          <div className="out-part">
            <div className="out-row">
              <div className="field">
                <label htmlFor="out-background">{t('outputs.background')}</label>
                <input id="out-background" type="color" className="out-color" value={style.background} onChange={(e) => setStyle({ background: e.target.value.toUpperCase() })} />
              </div>
              <div className="out-grow">
                <Range id="out-opacity" label={t('outputs.opacity', { n: style.band.opacity })} value={style.band.opacity} min={0} max={100} onChange={(opacity) => setBand({ opacity })} />
              </div>
            </div>
            <div className="field">
              <span className="out-label">{t('outputs.width')}</span>
              <Seg name="out-width" label={t('outputs.width')} value={style.band.width} options={WIDTHS} text={(v) => t(`outputs.width.${v}`)} onChange={(width) => setBand({ width })} />
            </div>
            <div className="out-pair">
              <Range id="out-margin-x" label={t('outputs.marginX', { n: style.band.marginX })} value={style.band.marginX} min={0} max={20} onChange={(marginX) => setBand({ marginX })} />
              <Range id="out-margin-y" label={t('outputs.marginY', { n: style.band.marginY })} value={style.band.marginY} min={0} max={20} onChange={(marginY) => setBand({ marginY })} />
            </div>
            <div className="out-row">
              <div className="field">
                <span className="out-label">{t('outputs.stroke')}</span>
                <Seg name="out-stroke" label={t('outputs.stroke')} value={style.stroke} options={STROKES} text={(v) => t(`outputs.stroke.${v}`)} onChange={(stroke) => setStyle({ stroke })} />
              </div>
              <label className="out-check">
                <input type="checkbox" checked={style.shadow} onChange={(e) => setStyle({ shadow: e.target.checked })} />
                {t('outputs.shadow')}
              </label>
            </div>
          </div>
        )}

        <div className="con-actions out-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !slugOk || !o.name.trim()}>
            {t('outputs.save')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('outputs.cancel')}
          </button>
        </div>
      </div>

      <div className="out-preview-col">
        <div className="out-preview-head">
          <span className="text-muted out-kicker">{t('outputs.preview')}</span>
          <Seg name="out-sample" label={t('outputs.sample')} value={sample} options={SAMPLES} text={(v) => t(`outputs.sample.${v}`)} onChange={setSample} />
        </div>
        <OverlayPreview style={style} sample={sample} />
        <span className="text-muted out-note">
          {t(`outputs.caption.${sample}`, { n: rows(sample), px: sceneFontPx(rows(sample)), header: Math.round(sceneFontPx(rows(sample)) / 2) })}
        </span>
      </div>
    </form>
  )
}
