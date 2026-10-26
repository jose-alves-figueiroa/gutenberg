/**
 * Bands that are not supporting text (PLAN.md → E18, design v2 → Biblioteca › Faixas, Apresentar ›
 * Faixas, Overlay): the service or meeting, the sacraments and the sermon. The lists are data
 * (settings), not code: adding "Culto de Ação de Graças" is an edit in the Library. A band goes to
 * the "Faixas" output and never shares the air with a text screen (decision 1).
 */
import { z } from 'zod'

export const BandKind = z.enum(['service', 'sacrament', 'sermon'])
export type BandKind = z.infer<typeof BandKind>

const line = z.string().trim().max(120)

/** The band on the air: kind, kicker (`CULTO`), title and the supporting line. */
export const Band = z.object({
  kind: BandKind,
  kicker: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  subtitle: line
})
export type Band = z.infer<typeof Band>

const Entry = z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), title: z.string().trim().min(1).max(120), subtitle: line })
export type BandEntry = z.infer<typeof Entry>

export const BandLibrary = z.object({
  services: z.array(Entry).max(50),
  sacraments: z.array(Entry).max(20),
  preachers: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), name: z.string().trim().min(1).max(120) })).max(100)
})
export type BandLibrary = z.infer<typeof BandLibrary>

/** The lists the app starts with (design v2). An empty supporting line means the service's date. */
export const DEFAULT_BANDS: BandLibrary = {
  services: [
    { id: 'morning', title: 'Culto Matutino', subtitle: '' },
    { id: 'evening', title: 'Culto Vespertino', subtitle: '' },
    { id: 'sunday-school', title: 'Escola Bíblica Dominical', subtitle: '' },
    { id: 'doctrine', title: 'Reunião de Doutrina', subtitle: '' }
  ],
  sacraments: [
    { id: 'baptism', title: 'Batismo', subtitle: '' },
    { id: 'lords-supper', title: 'Santa Ceia do Senhor', subtitle: '1 Coríntios 11.23–26' }
  ],
  preachers: []
}

/** The sermon of a service (Liturgia › Pregação). */
export const Sermon = z.object({
  preacher: z.string().trim().max(120),
  title: z.string().trim().max(120),
  text: z.string().trim().max(120)
})
export type Sermon = z.infer<typeof Sermon>

/** "Domingo, 12 de outubro" (the supporting line of a service band left empty). */
export const longDate = (date: Date): string => {
  const s = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** A band of the Library lists; `kicker` comes from i18n (`CULTO`, `SACRAMENTO`). */
export function entryBand(kind: 'service' | 'sacrament', kicker: string, entry: BandEntry, today: Date): Band {
  return { kind, kicker, title: entry.title, subtitle: entry.subtitle || (kind === 'service' ? longDate(today) : '') }
}

/** The sermon band: preacher, then "“title” · text" (either may be missing). */
export function sermonBand(kicker: string, sermon: Sermon): Band | null {
  if (!sermon.preacher) return null
  const parts = [sermon.title && `“${sermon.title}”`, sermon.text].filter(Boolean)
  return { kind: 'sermon', kicker, title: sermon.preacher, subtitle: parts.join(' · ') }
}

/** The kicker of each kind of band, in the operator's language (from i18n). */
export type Kickers = Record<BandKind, string>

/**
 * The bands the operator can send (Apresentar › Faixas and the phone), in order: services and
 * meetings, sacraments, then the sermon of the service being presented when it has a preacher.
 */
export function bandChoices(library: BandLibrary, sermon: Sermon | null, kickers: Kickers, today: Date): Band[] {
  const preaching = sermon ? sermonBand(kickers.sermon, sermon) : null
  return [
    ...library.services.map((e) => entryBand('service', kickers.service, e, today)),
    ...library.sacraments.map((e) => entryBand('sacrament', kickers.sacrament, e, today)),
    ...(preaching ? [preaching] : [])
  ]
}

/** Same band (the one on the air is marked in the lists). */
export const sameBand = (a: Band | null | undefined, b: Band | null | undefined): boolean =>
  Boolean(a && b && a.kind === b.kind && a.title === b.title && a.subtitle === b.subtitle)
