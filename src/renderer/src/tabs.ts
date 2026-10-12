import { BooksIcon, ListNumbersIcon, PlugsConnectedIcon, PresentationIcon, type Icon } from '@phosphor-icons/react'

export type TabId = 'liturgia' | 'biblioteca' | 'apresentar' | 'conexao'

export const TABS: readonly { id: TabId; label: string; icon: Icon }[] = [
  { id: 'liturgia', label: 'Liturgia', icon: ListNumbersIcon },
  { id: 'biblioteca', label: 'Biblioteca', icon: BooksIcon },
  { id: 'apresentar', label: 'Apresentar', icon: PresentationIcon },
  { id: 'conexao', label: 'Conexão', icon: PlugsConnectedIcon }
]

export type ConnStatus = 'online' | 'instavel' | 'offline'

/** Aparência do indicador de conexão na nav (README → Nav / protótipo `conn`). */
export const CONN_VIEW: Record<ConnStatus, { dot: string; fg: string; label: string; short: (ip: string) => string }> = {
  online: { dot: 'var(--color-accent)', fg: 'var(--color-text)', label: 'OBS conectado', short: (ip) => `${ip} · 18 ms` },
  instavel: { dot: 'var(--color-neutral-500)', fg: 'var(--color-text)', label: 'Conexão instável', short: (ip) => `${ip} · 640 ms` },
  offline: { dot: 'var(--color-accent-2)', fg: 'var(--color-accent-2-700)', label: 'OBS sem resposta', short: (ip) => `tentando ${ip}` }
}
