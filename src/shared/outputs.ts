/**
 * Outputs (PLAN.md → E7 → Saídas): each output is its own URL (`/overlay/<slug>`,
 * `/overlay/resources/<slug>`) bound to a set of collections, so OBS can have one Browser Source —
 * and one layout — per kind of content. They are data (`settings.outputs`), set up by the operator.
 */
import { z } from 'zod'
import { DEFAULT_STYLE, PayloadStyle, toPayload, type Payload, type PayloadSource } from './payload'

/** Path words used by the routes themselves. */
export const RESERVED_SLUGS: readonly string[] = ['resources', 'events', 'health', 'fonts']

/** `songbook:hnc` (exact), `songbook:*` (every document of a kind) or `creeds`. */
export const CollectionBinding = z.string().regex(/^(?:(?:bible|songbook|confession|catechism):(?:[a-z0-9-]{1,40}|\*)|creeds)$/)

export const Output = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .refine((s) => !RESERVED_SLUGS.includes(s), 'reserved slug'),
  name: z.string().trim().min(1).max(60),
  collections: z.array(CollectionBinding).max(50),
  style: PayloadStyle
})
export type Output = z.infer<typeof Output>

/** Unique slugs; each exact collection or kind binding in at most one output. */
export const Outputs = z
  .array(Output)
  .max(20)
  .superRefine((outputs, ctx) => {
    const slugs = new Set<string>()
    const bound = new Set<string>()
    for (const o of outputs) {
      if (slugs.has(o.slug)) ctx.addIssue({ code: 'custom', message: `duplicate slug ${o.slug}` })
      slugs.add(o.slug)
      for (const c of o.collections) {
        if (bound.has(c)) ctx.addIssue({ code: 'custom', message: `${c} is bound to more than one output` })
        bound.add(c)
      }
    }
  })

/**
 * The app's groups: Bible, songs (psalter and hymnals), doctrine. The style holds a layout for
 * running text and one for songs (Holyrics values: bottom/15 rows, middle/24 rows).
 */
export const DEFAULT_OUTPUTS: readonly Output[] = [
  { slug: 'bible', name: 'Bíblia', collections: ['bible:*'], style: DEFAULT_STYLE },
  { slug: 'songs', name: 'Salmos e hinos', collections: ['songbook:*'], style: DEFAULT_STYLE },
  { slug: 'doctrine', name: 'Doutrina', collections: ['creeds', 'confession:*', 'catechism:*'], style: DEFAULT_STYLE }
]

/** The output a collection belongs to: an exact binding wins over a kind binding. */
export function outputFor(collection: string, outputs: readonly Output[]): Output | null {
  const exact = outputs.find((o) => o.collections.includes(collection))
  if (exact) return exact
  const kind = collection.split(':')[0]
  return outputs.find((o) => o.collections.includes(`${kind}:*`)) ?? null
}

/**
 * Payload of one output: the screen on the air when its item belongs to the output, `CLEAR`
 * otherwise. Without an output (`/overlay/resources`) everything goes, with the default style.
 */
export function outputPayload(source: PayloadSource, output: Output | null, outputs: readonly Output[], seq: number): Payload {
  if (!output) return toPayload(source, DEFAULT_STYLE, seq)
  const mine = source.collection !== null && outputFor(source.collection, outputs)?.slug === output.slug
  return toPayload(mine ? source : { collection: null, slide: null }, output.style, seq)
}
