/**
 * Remote control from a phone (PLAN.md → E17, design v2 → Conexão › Controle remoto and Celular):
 * pairing by a 6-digit PIN shown in the app, the commands a paired device may send, and the
 * compact view of the presentation it shows (on the air and up next, decision 3).
 */
import { z } from 'zod'
import type { Slide } from './slides'

/** A PIN lasts this long; a new one is drawn after it expires or after a pairing. */
export const PIN_TTL_MS = 5 * 60_000
/** Wrong PINs in a row before the PIN is drawn again (guessing 6 digits stays impractical). */
export const PIN_ATTEMPTS = 5

export const PairBody = z.object({
  pin: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(1).max(60),
  platform: z.string().trim().max(30).default('')
})
export type PairBody = z.infer<typeof PairBody>

/** What a phone may do: the screens of the liturgy and "Limpar tela" (never change the service). */
export const RemoteCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('go'), index: z.number().int().min(0), slide: z.number().int().min(0) }),
  z.object({ type: z.literal('step'), delta: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ type: z.literal('blank'), blank: z.boolean() })
])
export type RemoteCommand = z.infer<typeof RemoteCommand>

export interface RemoteDevice {
  id: string
  name: string
  platform: string
  pairedAt: number
  lastSeen: number
}

/** A screen as the phone shows it. */
export interface RemoteScreen {
  /** Moment (`Confissão de fé`) or empty. */
  moment: string
  title: string
  header: string
  lines: string[]
  /** 0-based position and count in its item (`tela 1 de 8`). */
  slide: number
  slides: number
}

export interface RemoteView {
  service: string
  items: { moment: string; title: string }[]
  live: number
  blank: boolean
  onAir: RemoteScreen | null
  upNext: RemoteScreen | null
}

interface ViewItem {
  moment: string
  title: string
  slides: Slide[]
}

/** The phone's view of the presentation (from the main process's PresentView). */
export function remoteView(view: {
  service: { name: string } | null
  items: ViewItem[]
  state: { live: number; slide: number; blank: boolean }
}): RemoteView {
  const { live, slide, blank } = view.state
  const screen = (index: number, at: number): RemoteScreen | null => {
    const item = view.items[index]
    const s = item?.slides[at]
    return item && s ? { moment: item.moment, title: item.title, header: s.header, lines: s.lines, slide: at, slides: item.slides.length } : null
  }
  const item = view.items[live]
  const next = item && slide + 1 < item.slides.length ? screen(live, slide + 1) : screen(live + 1, 0)
  return {
    service: view.service?.name ?? '',
    items: view.items.map((i) => ({ moment: i.moment, title: i.title })),
    live,
    blank,
    onAir: blank ? null : screen(live, slide),
    upNext: next
  }
}
