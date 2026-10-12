import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { CONN_VIEW, TABS, type ConnStatus, type TabId } from '../tabs'

interface NavProps {
  tab: TabId
  onTab: (tab: TabId) => void
  conn: ConnStatus
  ip: string
}

export function Nav({ tab, onTab, conn, ip }: NavProps) {
  const c = CONN_VIEW[conn]
  return (
    <nav className="nav app-nav">
      <span className="nav-brand">Gutenberg</span>
      <div className="nav-tabs" role="tablist" aria-label="Seções">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-controls={`view-${id}`}
            aria-selected={tab === id}
            className="nav-tab"
            onClick={() => onTab(id)}
          >
            <Icon size={18} weight="duotone" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="quick-search">
        {/* Busca rápida: só o campo na Fase 1; a lógica entra na Fase 6. */}
        <label className="quick-search-box">
          <MagnifyingGlassIcon size={17} weight="duotone" aria-hidden />
          <input className="quick-search-input" type="search" aria-label="Busca rápida" placeholder="Buscar: hb 12.14, bc 1, sg 133…" />
        </label>
      </div>
      <button type="button" className="nav-status" onClick={() => onTab('conexao')} aria-label={`${c.label} — abrir Conexão`}>
        <span className="status-dot" style={{ background: c.dot }} />
        <span style={{ color: c.fg }}>{c.label}</span>
        <span className="text-muted">{c.short(ip)}</span>
      </button>
    </nav>
  )
}
