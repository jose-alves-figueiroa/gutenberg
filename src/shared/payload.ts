/**
 * The screen sent to OBS (PLAN.md → E7): the same `{ "map": { … } }` the Holyrics JSON has, so the
 * current overlay keeps working, but with clean values — no HTML, `&nbsp;`, `(RA)` or
 * `text-force-update`, at most 2 lines — plus `seq` and `lines`.
 */
import { z } from 'zod'
import { toLine } from './clean'
import type { Slide } from './slides'

export type PayloadType = 'BIBLE' | 'MUSIC' | 'CREED' | 'CONFESSION' | 'CATECHISM' | 'CLEAR'

const KIND_TYPE: Record<string, PayloadType> = {
  bible: 'BIBLE',
  songbook: 'MUSIC',
  creeds: 'CREED',
  confession: 'CONFESSION',
  catechism: 'CATECHISM'
}

/** Payload type of a collection reference (`bible:ara` → BIBLE, `songbook:hnc` → MUSIC). */
export const payloadType = (collection: string): PayloadType => KIND_TYPE[collection.split(':')[0]] ?? 'CLEAR'

const color = z.string().regex(/^#[0-9a-f]{6}$/i)
const halign = z.enum(['left', 'center', 'right'])
const valign = z.enum(['top', 'middle', 'bottom'])
const rows = z.string().regex(/^\d{1,3}$/)
const short = z.string().trim().min(1).max(60)

/** Visual settings carried in every payload (the overlay draws with them, as Holyrics does). */
export const PayloadStyle = z.object({
  color,
  background: color,
  font: short,
  bold: z.boolean(),
  halign,
  /** Running text: Bible and doctrine. */
  text: z.object({ valign, fontMaxRows: rows }),
  music: z.object({ valign, fontMaxRows: rows }),
  alert: z.object({
    velocity: z.string().regex(/^\d{1,4}$/),
    height: z.string().regex(/^\d{1,3}%$/),
    bold: z.boolean(),
    background: color,
    font: short,
    color
  })
})
export type PayloadStyle = z.infer<typeof PayloadStyle>

/** The values in the Holyrics example (design/proposals/v1/reference). */
export const DEFAULT_STYLE: PayloadStyle = {
  color: '#FAFAFA',
  background: '#FFFFFF',
  font: 'Open Sans',
  bold: false,
  halign: 'center',
  text: { valign: 'bottom', fontMaxRows: '15' },
  music: { valign: 'middle', fontMaxRows: '24' },
  alert: { velocity: '160', height: '15%', bold: false, background: '#000000', font: 'Arial', color: '#FAFAFA' }
}

export interface SongCredits {
  title: string
  artist: string
  author: string
  copyright: string
}

export interface PayloadSource {
  /** Collection of the item on the air; null when nothing is on the air ("Limpar tela"). */
  collection: string | null
  slide: Slide | null
  credits?: SongCredits
}

export interface Payload {
  map: Record<string, string | boolean | number | string[]>
}

const MAX_LINES = 2

export function toPayload(source: PayloadSource, style: PayloadStyle, seq: number): Payload {
  const type = source.slide && source.collection ? payloadType(source.collection) : 'CLEAR'
  const lines = type === 'CLEAR' ? [] : source.slide!.lines.map(toLine).filter(Boolean).slice(0, MAX_LINES)
  const layout = type === 'MUSIC' ? style.music : style.text
  const map: Payload['map'] = {
    type,
    header: type === 'CLEAR' ? '' : toLine(source.slide!.header),
    text: lines.join('\n'),
    lines,
    seq,
    key_ok: 'true',
    key_error: '',
    display_errors: '_true',
    attention: false,
    color: style.color,
    background: style.background,
    font: style.font,
    bold: style.bold,
    valign: layout.valign,
    halign: style.halign,
    font_max_rows: layout.fontMaxRows,
    max_html_types: '3',
    alert_velocity: style.alert.velocity,
    alert_height: style.alert.height,
    alert_bold: style.alert.bold,
    alert_background: style.alert.background,
    alert_font: style.alert.font,
    alert_color: style.alert.color
  }
  if (type === 'MUSIC') {
    const c = source.credits
    map.$system_var_music_title = toLine(c?.title ?? '')
    map.$system_var_music_artist = toLine(c?.artist ?? '')
    map.$system_var_music_author = toLine(c?.author ?? '')
    map.$system_var_music_copyright = toLine(c?.copyright ?? '')
  }
  return { map }
}
