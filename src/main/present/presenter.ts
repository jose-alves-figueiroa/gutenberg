/**
 * The presentation, owned by the main process: state persisted in the `settings` table (survives a
 * restart), commands from the operator UI, and the live screen that OBS will receive (E7).
 */
import {
  INITIAL_PRESENTATION,
  PresentationStateSchema,
  applyCommand,
  clampPosition,
  type PresentCommand,
  type PresentationState
} from '../../shared/presentation'
import { DEFAULT_OUTPUTS, Outputs, outputPayload, type Output } from '../../shared/outputs'
import type { Payload, SongCredits } from '../../shared/payload'
import type { Slide } from '../../shared/slides'
import { SETTINGS } from '../db/build'
import type { SqlDatabase } from '../db/schema'
import { resolveItem } from '../library/items'
import * as repo from '../library/repository'
import * as liturgy from '../liturgy/repository'

export interface PresentItem {
  /** Liturgy moment; empty for the ad hoc item (the UI labels it "Avulso"). */
  moment: string
  collection: string
  itemRef: string
  title: string
  collectionLabel: string
  slides: Slide[]
  missing: boolean
  adhoc: boolean
  credits?: SongCredits
}

export interface PresentView {
  state: PresentationState
  service: { id: number; name: string } | null
  items: PresentItem[]
  /** The screen on the air; null with "Limpar tela" or nothing to show. */
  onAir: (Slide & { item: number; slide: number }) | null
}

export interface Presenter {
  view(): PresentView
  command(cmd: PresentCommand): PresentView
  /**
   * The screen on the air in the Holyrics-compatible format OBS reads (E7), for one output
   * (`CLEAR` when the item is not bound to it) or, without a slug, for everything. Null for an
   * unknown output.
   */
  payload(slug?: string): Payload | null
  /** Tells subscribers the screen may have changed (a library or liturgy edit). */
  notify(): void
  subscriberCount(): number
  /** Called after every command and notify (E7 pushes the new screen to OBS). */
  subscribe(listener: (view: PresentView) => void): () => void
}

function load(db: SqlDatabase): PresentationState {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS.presentationState) as { value: string } | undefined
  if (!row) return INITIAL_PRESENTATION
  try {
    const parsed = PresentationStateSchema.safeParse(JSON.parse(row.value))
    return parsed.success ? parsed.data : INITIAL_PRESENTATION
  } catch {
    return INITIAL_PRESENTATION
  }
}

/** Outputs saved in settings by the operator, or the defaults (bible, songs, doctrine). */
export function outputs(db: SqlDatabase): readonly Output[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS.outputs) as { value: string } | undefined
  if (!row) return DEFAULT_OUTPUTS
  try {
    const parsed = Outputs.safeParse(JSON.parse(row.value))
    return parsed.success ? parsed.data : DEFAULT_OUTPUTS
  } catch {
    return DEFAULT_OUTPUTS
  }
}

function save(db: SqlDatabase, state: PresentationState): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`
  ).run(SETTINGS.presentationState, JSON.stringify(state))
}

export function createPresenter(db: SqlDatabase): Presenter {
  let state = load(db)
  const listeners = new Set<(view: PresentView) => void>()

  const sequence = (s: PresentationState) => {
    const max = repo.settings(db).screenCharLimit
    const all = liturgy.services(db)
    const summary = all.find((x) => x.id === s.serviceId) ?? all[0] ?? null
    const rows = summary
      ? (db
          .prepare('SELECT moment, collection, item_ref FROM liturgy_items WHERE service_id = ? ORDER BY position')
          .all(summary.id) as { moment: string; collection: string; item_ref: string }[])
      : []
    const items: PresentItem[] = []
    if (s.adhoc) {
      const r = resolveItem(db, s.adhoc.collection, s.adhoc.itemRef, max)
      items.push({ moment: '', ...pick(r), adhoc: true })
    }
    for (const row of rows) items.push({ moment: row.moment, ...pick(resolveItem(db, row.collection, row.item_ref, max)), adhoc: false })
    return { service: summary && { id: summary.id, name: summary.name }, items }
  }

  const view = (): PresentView => {
    const { service, items } = sequence(state)
    const s = clampPosition(state, items.map((i) => i.slides.length))
    const slide = s.blank ? undefined : items[s.live]?.slides[s.slide]
    return { state: s, service, items, onAir: slide ? { ...slide, item: s.live, slide: s.slide } : null }
  }

  return {
    view,
    payload(slug) {
      const all = outputs(db)
      const output = slug === undefined ? null : all.find((o) => o.slug === slug)
      if (output === undefined) return null
      const v = view()
      const item = v.onAir ? v.items[v.onAir.item] : undefined
      return outputPayload({ collection: item?.collection ?? null, slide: v.onAir, credits: item?.credits }, output, all, v.state.seq)
    },
    command(cmd) {
      const counts = sequence(state).items.map((i) => i.slides.length)
      const next = applyCommand(state, cmd, counts)
      if (next !== state) {
        state = next
        save(db, state)
      }
      const v = view()
      for (const l of listeners) l(v)
      return v
    },
    subscriberCount: () => listeners.size,
    notify() {
      const v = view()
      for (const l of listeners) l(v)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

const pick = (r: ReturnType<typeof resolveItem>) => ({
  collection: r.collection,
  itemRef: r.itemRef,
  title: r.title,
  collectionLabel: r.collectionLabel,
  slides: r.slides,
  missing: r.missing,
  ...(r.credits ? { credits: r.credits } : {})
})
