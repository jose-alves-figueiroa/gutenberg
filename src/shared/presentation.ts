/**
 * Presentation state and commands (README → "Apresentar"; prototype `goLive`, `step`, `present`,
 * `dropAdhoc`). Pure: the main process keeps the state, persists it and resolves the sequence —
 * the ad hoc item ("Avulso", on top) followed by the service's items.
 */
import { z } from 'zod'
import { CollectionRef } from './library-schemas'

export interface AdhocItem {
  collection: string
  itemRef: string
}

export interface PresentationState {
  /** Service being presented; null → the first service. */
  serviceId: number | null
  /** Item presented outside the liturgy ("Avulso"); it comes first in the sequence. */
  adhoc: AdhocItem | null
  /** Index of the live item in the sequence. */
  live: number
  /** Index of the live screen inside that item. */
  slide: number
  /** "Limpar tela": nothing is shown, the position is kept. */
  blank: boolean
  /** Bumped on every command, so OBS can ignore stale screens (E7). */
  seq: number
}

export const INITIAL_PRESENTATION: PresentationState = { serviceId: null, adhoc: null, live: 0, slide: 0, blank: false, seq: 0 }

const ref = { collection: CollectionRef, itemRef: z.string().trim().min(1).max(60) }

export const PresentCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('service'), serviceId: z.number().int().positive() }),
  z.object({ type: z.literal('go'), index: z.number().int().min(0), slide: z.number().int().min(0) }),
  z.object({ type: z.literal('step'), delta: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ type: z.literal('blank'), blank: z.boolean() }),
  z.object({ type: z.literal('adhoc'), ...ref }),
  z.object({ type: z.literal('dropAdhoc') })
])
export type PresentCommand = z.infer<typeof PresentCommand>

export const PresentationStateSchema = z.object({
  serviceId: z.number().int().positive().nullable(),
  adhoc: z.object(ref).nullable(),
  live: z.number().int().min(0),
  slide: z.number().int().min(0),
  blank: z.boolean(),
  seq: z.number().int().min(0)
})

const lastSlide = (counts: readonly number[], i: number) => Math.max(0, (counts[i] ?? 0) - 1)

/** Keeps `live`/`slide` inside the sequence (it changes when the liturgy or the library is edited). */
export function clampPosition(state: PresentationState, counts: readonly number[]): PresentationState {
  if (counts.length === 0) return state.live === 0 && state.slide === 0 ? state : { ...state, live: 0, slide: 0 }
  const live = Math.min(state.live, counts.length - 1)
  const slide = Math.min(state.slide, lastSlide(counts, live))
  return live === state.live && slide === state.slide ? state : { ...state, live, slide }
}

/**
 * Applies a command. `counts` holds the screens of each sequence item (ad hoc first) before the
 * command. Every command bumps `seq`.
 */
export function applyCommand(state: PresentationState, cmd: PresentCommand, counts: readonly number[]): PresentationState {
  const next = (patch: Partial<PresentationState>): PresentationState => ({ ...state, ...patch, seq: state.seq + 1 })
  switch (cmd.type) {
    case 'service':
      return next({ serviceId: cmd.serviceId, adhoc: null, live: 0, slide: 0, blank: false })
    case 'adhoc':
      return next({ adhoc: { collection: cmd.collection, itemRef: cmd.itemRef }, live: 0, slide: 0, blank: false })
    case 'dropAdhoc':
      if (!state.adhoc) return state
      return next({ adhoc: null, live: Math.max(0, state.live - 1), slide: state.live === 0 ? 0 : state.slide })
    case 'blank':
      return next({ blank: cmd.blank })
    case 'go': {
      if (counts.length === 0) return state
      const live = Math.min(cmd.index, counts.length - 1)
      return next({ live, slide: Math.min(cmd.slide, lastSlide(counts, live)), blank: false })
    }
    case 'step': {
      if (counts.length === 0) return state
      const { live: li0, slide: si0 } = clampPosition(state, counts)
      let live = li0
      let slide = si0 + cmd.delta
      if (slide >= (counts[li0] ?? 0) && li0 < counts.length - 1) {
        live = li0 + 1
        slide = 0
      } else if (slide < 0 && li0 > 0) {
        live = li0 - 1
        slide = lastSlide(counts, live)
      }
      if (live === li0) slide = Math.max(0, Math.min(slide, lastSlide(counts, live)))
      return next({ live, slide, blank: false })
    }
  }
}
