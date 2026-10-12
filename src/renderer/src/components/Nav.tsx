import { t } from '@shared/i18n'
import { useConnection } from '../connection'
import { CONN_VIEW, TABS, connShort, tabLabel, type TabId } from '../tabs'
import { QuickSearch } from './QuickSearch'

interface NavProps {
  tab: TabId
  onTab: (tab: TabId) => void
}

export function Nav({ tab, onTab }: NavProps) {
  const conn = useConnection().data
  const status = conn?.status ?? 'offline'
  const c = CONN_VIEW[status]
  const label = c.label()
  const clients = conn ? [...conn.outputs.flatMap((o) => o.clients), ...conn.all.clients] : []
  const obsIp = clients.find((x) => x.status !== 'offline')?.ip ?? clients[0]?.ip ?? null
  const url = conn ? `${conn.addresses[0] ?? '127.0.0.1'}:${conn.port}` : '…'
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
        <span className="text-muted">{connShort(status, obsIp, conn?.rtt ?? null, url)}</span>
      </button>
    </nav>
  )
}
