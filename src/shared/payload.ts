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

/** The band behind the text (design v2): opacity and margins in %, full width or fitted to the text. */
const Band = z.object({
  opacity: z.number().int().min(0).max(100),
  marginX: z.number().int().min(0).max(20),
  marginY: z.number().int().min(0).max(20),
  width: z.enum(['full', 'fit'])
})

const StyleFields = z.object({
  color,
  /** Band colour (`background` in the Holyrics map). */
  background: color,
  font: short,
  bold: z.boolean(),
  halign,
  /** Running text: Bible and doctrine. */
  text: z.object({ valign, fontMaxRows: rows }),
  music: z.object({ valign, fontMaxRows: rows }),
  band: Band,
  stroke: z.enum(['none', 'thin', 'thick']),
  shadow: z.boolean(),
  alert: z.object({
    velocity: z.string().regex(/^\d{1,4}$/),
    height: z.string().regex(/^\d{1,3}%$/),
    bold: z.boolean(),
    background: color,
    font: short,
    color
  })
})

/** The Holyrics defaults the app shipped with before design v2 (a white band, Open Sans, 15/24 rows). */
const HOLYRICS = { background: '#FFFFFF', font: 'Open Sans', text: '15', music: '24' }

/**
 * Visual settings carried in every payload (the overlay draws with them). A style saved before
 * design v2 has no `band`: it gets the v2 band, and whatever still holds the Holyrics default
 * (white band, Open Sans, 15/24 rows) moves to the v2 default, so the text stays legible.
 */
export const PayloadStyle = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || 'band' in value) return value
  const old = value as Record<string, unknown> & { text?: { fontMaxRows?: string }; music?: { fontMaxRows?: string } }
  const upper = (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v)
  return {
    ...old,
    background: upper(old.background) === HOLYRICS.background ? DEFAULT_STYLE.background : old.background,
    font: old.font === HOLYRICS.font ? DEFAULT_STYLE.font : old.font,
    text: old.text && { ...old.text, fontMaxRows: old.text.fontMaxRows === HOLYRICS.text ? DEFAULT_STYLE.text.fontMaxRows : old.text.fontMaxRows },
    music: old.music && { ...old.music, fontMaxRows: old.music.fontMaxRows === HOLYRICS.music ? DEFAULT_STYLE.music.fontMaxRows : old.music.fontMaxRows },
    band: DEFAULT_STYLE.band,
    stroke: DEFAULT_STYLE.stroke,
    shadow: DEFAULT_STYLE.shadow
  }
}, StyleFields)
export type PayloadStyle = z.infer<typeof StyleFields>

/**
 * Design v2 (design/proposals/v2/handoff/README.md → Overlay): Source Serif 4, 12 rows for text
 * (69 px in a 1080 scene) and 10 for songs, a dark band at 78 %, 6 % side margin, 5 % from the
 * bottom. The other values are those of the Holyrics example (design/proposals/v1/reference).
 */
export const DEFAULT_STYLE: PayloadStyle = {
  color: '#FAFAFA',
  background: '#141212',
  font: 'Source Serif 4',
  bold: false,
  halign: 'center',
  text: { valign: 'bottom', fontMaxRows: '12' },
  music: { valign: 'middle', fontMaxRows: '10' },
  band: { opacity: 78, marginX: 6, marginY: 5, width: 'full' },
  stroke: 'none',
  shadow: true,
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
    alert_color: style.alert.color,
    // Extras of design v2 (a Holyrics overlay ignores them).
    band_opacity: style.band.opacity,
    band_margin_x: style.band.marginX,
    band_margin_y: style.band.marginY,
    band_width: style.band.width,
    text_stroke: style.stroke,
    text_shadow: style.shadow
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
