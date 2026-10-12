import { useState } from 'react'
import { Nav } from './components/Nav'
import type { ConnStatus, TabId } from './tabs'
import { ApresentarView, BibliotecaView, ConexaoView, LiturgiaView } from './views/Views'

const VIEWS: Record<TabId, () => React.JSX.Element> = {
  liturgia: LiturgiaView,
  biblioteca: BibliotecaView,
  apresentar: ApresentarView,
  conexao: ConexaoView
}

interface AppProps {
  initialTab?: TabId
  /** Estado estático até a Fase 7 (obs-websocket). */
  conn?: ConnStatus
  ip?: string
}

export function App({ initialTab = 'liturgia', conn = 'online', ip = '192.168.0.12' }: AppProps) {
  const [tab, setTab] = useState<TabId>(initialTab)
  const Current = VIEWS[tab]
  return (
    <div className="app">
      <Nav tab={tab} onTab={setTab} conn={conn} ip={ip} />
      <Current />
    </div>
  )
}
