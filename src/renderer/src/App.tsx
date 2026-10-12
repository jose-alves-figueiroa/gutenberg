import { useState } from 'react'
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
}

export function App({ initialTab = 'liturgy', conn = 'online', ip = '192.168.0.12' }: AppProps) {
  const [tab, setTab] = useState<TabId>(initialTab)
  const Current = VIEWS[tab]
  return (
    <div className="app">
      <Nav tab={tab} onTab={setTab} conn={conn} ip={ip} />
      <Current />
    </div>
  )
}
