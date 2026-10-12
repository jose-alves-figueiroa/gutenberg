import type { ReactNode } from 'react'
import type { TabId } from '../tabs'

function View({ id, grid, children }: { id: TabId; grid: string; children: ReactNode }) {
  return (
    <main className="view" role="tabpanel" id={`view-${id}`} aria-labelledby={`tab-${id}`}>
      <div className={`view-grid view-grid--${grid}`}>{children}</div>
    </main>
  )
}

export function LiturgiaView() {
  return (
    <View id="liturgia" grid="liturgia">
      <aside>
        <h6 className="text-muted">Cultos</h6>
      </aside>
      <section className="view-main">
        <h6 className="kicker">Liturgia</h6>
        <h2>Liturgia</h2>
        <p className="empty-note">Os cultos e a ordem dos itens aparecem aqui.</p>
      </section>
    </View>
  )
}

export function BibliotecaView() {
  return (
    <View id="biblioteca" grid="biblioteca">
      <aside>
        <h6 className="text-muted">Coleções</h6>
      </aside>
      <section className="view-main">
        <h6 className="kicker">Biblioteca</h6>
        <h2>Biblioteca</h2>
        <p className="empty-note">Bíblia, hinário, salmos e textos de doutrina.</p>
      </section>
    </View>
  )
}

export function ApresentarView() {
  return (
    <View id="apresentar" grid="apresentar">
      <aside>
        <h6 className="text-muted">Itens</h6>
      </aside>
      <section>
        <h6 className="kicker">Apresentar</h6>
        <h2>Apresentar</h2>
        <p className="empty-note">As telas do item no ar aparecem aqui.</p>
      </section>
    </View>
  )
}

export function ConexaoView() {
  return (
    <View id="conexao" grid="conexao">
      <section>
        <h6 className="kicker">Conexão</h6>
        <h2>Conexão</h2>
        <p className="empty-note">Estado da ligação com o OBS e registro de eventos.</p>
      </section>
    </View>
  )
}
