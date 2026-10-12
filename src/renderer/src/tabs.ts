import { BooksIcon, ListNumbersIcon, PlugsConnectedIcon, PresentationIcon, type Icon } from '@phosphor-icons/react'
import type { ConnStatus } from '@shared/connection'
import { t } from '@shared/i18n'

export type TabId = 'liturgy' | 'library' | 'present' | 'connection'

export const TABS: readonly { id: TabId; icon: Icon }[] = [
  { id: 'liturgy', icon: ListNumbersIcon },
  { id: 'library', icon: BooksIcon },
  { id: 'present', icon: PresentationIcon },
  { id: 'connection', icon: PlugsConnectedIcon }
]

export const tabLabel = (id: TabId): string => t(`tabs.${id}`)

export type { ConnStatus } from '@shared/connection'

/** Connection indicator look (README → Nav and Conexão; prototype `conn`). */
export const CONN_VIEW: Record<ConnStatus, { dot: string; fg: string; label: () => string; title: () => string; note: () => string }> = {
  online: {
    dot: 'var(--color-accent)',
    fg: 'var(--color-text)',
    label: () => t('connection.online.label'),
    title: () => t('connection.online.title'),
    note: () => t('connection.online.note')
  },
  unstable: {
    dot: 'var(--color-neutral-500)',
    fg: 'var(--color-text)',
    label: () => t('connection.unstable.label'),
    title: () => t('connection.unstable.title'),
    note: () => t('connection.unstable.note')
  },
  offline: {
    dot: 'var(--color-accent-2)',
    fg: 'var(--color-accent-2-700)',
    label: () => t('connection.offline.label'),
    title: () => t('connection.offline.title'),
    note: () => t('connection.offline.note')
  }
}

/** Short text next to the nav indicator: OBS address and latency, or what we wait for. */
export function connShort(status: ConnStatus, obsIp: string | null, rtt: number | null, url: string): string {
  if (status === 'offline') return t('connection.offline.short', { ip: obsIp ?? url })
  return rtt === null ? (obsIp ?? '') : `${obsIp ?? ''} · ${rtt} ms`
}
