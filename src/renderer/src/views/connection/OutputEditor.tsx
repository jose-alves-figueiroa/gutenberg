/** Form for one output: name, URL slug, bound collections and the payload style sent to OBS. */
import { useState } from 'react'
import { t } from '@shared/i18n'
import { RESERVED_SLUGS, type Output } from '@shared/outputs'

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

/** "Every document of a kind" (`songbook:*`). */
export const kindLabel = (kind: string): string =>
  KINDS.includes(kind as (typeof KINDS)[number]) ? t(`outputs.kind.${kind as (typeof KINDS)[number]}`) : `${kind}:*`
const VALIGN = ['top', 'middle', 'bottom'] as const
const HALIGN = ['left', 'center', 'right'] as const

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

export function OutputEditor({ initial, others, collections, saving, onSave, onCancel }: Props) {
  const [o, setO] = useState<Output>(initial)
  const taken = new Map(others.flatMap((x) => x.collections.map((c) => [c, x.name] as const)))
  const slugTaken = others.some((x) => x.slug === o.slug)
  const slugOk = /^[a-z0-9-]{1,32}$/.test(o.slug) && !RESERVED_SLUGS.includes(o.slug) && !slugTaken
  const style = o.style
  const setStyle = (patch: Partial<Output['style']>) => setO({ ...o, style: { ...style, ...patch } })
  const toggle = (value: string, on: boolean) =>
    setO({ ...o, collections: on ? [...o.collections, value] : o.collections.filter((c) => c !== value) })

  return (
    <form
      className="con-output con-output--edit"
      aria-label={t('outputs.editing', { name: initial.name || t('outputs.new') })}
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...o, name: o.name.trim() })
      }}
    >
      <div className="con-form-row">
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
      <fieldset className="con-fieldset">
        <legend className="text-muted">{t('outputs.collections')}</legend>
        {bindings(collections).map((b) => {
          const owner = taken.get(b.value)
          return (
            <label key={b.value} className={b.value.endsWith(':*') ? 'con-check con-check--kind' : 'con-check'}>
              <input type="checkbox" checked={o.collections.includes(b.value)} disabled={!!owner} onChange={(e) => toggle(b.value, e.target.checked)} />
              {b.label}
              {owner && <span className="text-muted">{` · ${t('outputs.inOther', { name: owner })}`}</span>}
            </label>
          )
        })}
      </fieldset>
      <fieldset className="con-fieldset con-style">
        <legend className="text-muted">{t('outputs.style')}</legend>
        <label className="con-inline">
          {t('outputs.color')}
          <input type="color" value={style.color} onChange={(e) => setStyle({ color: e.target.value.toUpperCase() })} />
        </label>
        <label className="con-inline">
          {t('outputs.background')}
          <input type="color" value={style.background} onChange={(e) => setStyle({ background: e.target.value.toUpperCase() })} />
        </label>
        <label className="con-inline">
          {t('outputs.font')}
          <input className="input" value={style.font} maxLength={60} onChange={(e) => setStyle({ font: e.target.value })} />
        </label>
        <label className="con-inline">
          <input type="checkbox" checked={style.bold} onChange={(e) => setStyle({ bold: e.target.checked })} />
          {t('outputs.bold')}
        </label>
        <label className="con-inline">
          {t('outputs.halign')}
          <select className="input" value={style.halign} onChange={(e) => setStyle({ halign: e.target.value as Output['style']['halign'] })}>
            {HALIGN.map((v) => (
              <option key={v} value={v}>
                {t(`outputs.align.${v}`)}
              </option>
            ))}
          </select>
        </label>
        {(['text', 'music'] as const).map((k) => (
          <span key={k} className="con-inline">
            <span>{t(`outputs.layout.${k}`)}</span>
            <select
              className="input"
              aria-label={t('outputs.valignOf', { kind: t(`outputs.layout.${k}`) })}
              value={style[k].valign}
              onChange={(e) => setStyle({ [k]: { ...style[k], valign: e.target.value as Output['style']['text']['valign'] } })}
            >
              {VALIGN.map((v) => (
                <option key={v} value={v}>
                  {t(`outputs.align.${v}`)}
                </option>
              ))}
            </select>
            <input
              className="input con-rows"
              inputMode="numeric"
              aria-label={t('outputs.rowsOf', { kind: t(`outputs.layout.${k}`) })}
              value={style[k].fontMaxRows}
              onChange={(e) => setStyle({ [k]: { ...style[k], fontMaxRows: e.target.value.replace(/\D/g, '').slice(0, 3) } })}
            />
          </span>
        ))}
      </fieldset>
      <div className="con-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !slugOk || !o.name.trim() || !style.font.trim() || !style.text.fontMaxRows || !style.music.fontMaxRows}>
          {t('outputs.save')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('outputs.cancel')}
        </button>
      </div>
    </form>
  )
}
