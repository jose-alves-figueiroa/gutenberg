import { t } from '@shared/i18n'
import { QuickSearch } from './QuickSearch'
import { CONN_VIEW, TABS, tabLabel, type ConnStatus, type TabId } from '../tabs'

interface NavProps {
  tab: TabId
  onTab: (tab: TabId) => void
  conn: ConnStatus
  ip: string
}

export function Nav({ tab, onTab, conn, ip }: NavProps) {
  const c = CONN_VIEW[conn]
  const label = c.label()
  return (
    <nav className="nav app-nav">
      <span className="nav-brand">{t('app.brand')}</span>
      <div className="nav-tabs" role="tablist" aria-label={t('nav.sections')}>
        {TABS.map(({ id, icon: Icon }) => (
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
            {tabLabel(id)}
          </button>
        ))}
      </div>
      <QuickSearch />
      <button
        type="button"
        className="nav-status"
        onClick={() => onTab('connection')}
        aria-label={t('nav.openConnection', { status: label })}
      >
        <span className="status-dot" style={{ background: c.dot }} />
        <span style={{ color: c.fg }}>{label}</span>
        <span className="text-muted">{c.short(ip)}</span>
      </button>
    </nav>
  )
}
