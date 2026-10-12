import { BooksIcon, ListNumbersIcon, PlugsConnectedIcon, PresentationIcon, type Icon } from '@phosphor-icons/react'
import { t } from '@shared/i18n'

export type TabId = 'liturgy' | 'library' | 'present' | 'connection'

export const TABS: readonly { id: TabId; icon: Icon }[] = [
  { id: 'liturgy', icon: ListNumbersIcon },
  { id: 'library', icon: BooksIcon },
  { id: 'present', icon: PresentationIcon },
  { id: 'connection', icon: PlugsConnectedIcon }
]

export const tabLabel = (id: TabId): string => t(`tabs.${id}`)

export type ConnStatus = 'online' | 'unstable' | 'offline'

/** Connection indicator look in the nav (README → Nav; prototype `conn`). */
export const CONN_VIEW: Record<ConnStatus, { dot: string; fg: string; label: () => string; short: (ip: string) => string }> = {
  online: {
    dot: 'var(--color-accent)',
    fg: 'var(--color-text)',
    label: () => t('connection.online.label'),
    short: (ip) => `${ip} · 18 ms`
  },
  unstable: {
    dot: 'var(--color-neutral-500)',
    fg: 'var(--color-text)',
    label: () => t('connection.unstable.label'),
    short: (ip) => `${ip} · 640 ms`
  },
  offline: {
    dot: 'var(--color-accent-2)',
    fg: 'var(--color-accent-2-700)',
    label: () => t('connection.offline.label'),
    short: (ip) => t('connection.offline.short', { ip })
  }
}
