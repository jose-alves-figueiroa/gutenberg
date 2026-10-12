import { useState } from 'react'
import { ApiProvider, type ApiClient } from './api'
import { NavigationContext } from './navigation'
import { ServiceProvider } from './service'
import { Nav } from './components/Nav'
import type { ConnStatus, TabId } from './tabs'
import { ConnectionView, LibraryView, LiturgyView, PresentView } from './views/Views'

const VIEWS: Record<TabId, () => React.JSX.Element> = {
  liturgy: LiturgyView,
  library: LibraryView,
  present: PresentView,
  connection: ConnectionView
}

interface AppProps {
  initialTab?: TabId
  /** Static until phase 7 (obs-websocket). */
  conn?: ConnStatus
  ip?: string
  /** API client (tests inject one over the in-process server). */
  api?: ApiClient
}

export function App({ initialTab = 'liturgy', conn = 'online', ip = '192.168.0.12', api }: AppProps) {
  const [tab, setTab] = useState<TabId>(initialTab)
  const Current = VIEWS[tab]
  return (
    <ApiProvider client={api}>
      <ServiceProvider>
        <NavigationContext.Provider value={setTab}>
          <div className="app">
            <Nav tab={tab} onTab={setTab} conn={conn} ip={ip} />
            <Current />
          </div>
        </NavigationContext.Provider>
      </ServiceProvider>
    </ApiProvider>
  )
}
