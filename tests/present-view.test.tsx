// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { addItem, createService } from '../src/main/liturgy/repository'
import type { TabId } from '@renderer/tabs'
import { createTestApi } from './helpers/test-api'

afterEach(cleanup)

function renderApp(tab: TabId = 'present', withService = true) {
  const api = createTestApi()
  if (withService) {
    const s = createService(api.db, 'Domingo')
    addItem(api.db, s.id, { collection: 'catechism:wsc', itemRef: '1', moment: 'Catecismo' })
    addItem(api.db, s.id, { collection: 'creeds', itemRef: 'apostles', moment: 'Confissão de fé' })
  }
  render(<App initialTab={tab} api={api.client} />)
  return api
}

const aside = () => screen.getByRole('complementary', { name: 'Itens' })
const cards = () => [...document.querySelectorAll('.pres-slide')]
const liveCard = () => document.querySelector('.pres-slide--live')
const stored = (db: ReturnType<typeof createTestApi>['db']) =>
  JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'presentation_state'").get() as { value: string }).value)

describe('Present (US6.2)', () => {
  it('lists the items and shows the live item’s screens', async () => {
    renderApp()
    expect(await within(aside()).findByText('Breve Catecismo · P. 1')).toBeInTheDocument()
    expect(within(aside()).getByText('Credo Apostólico')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 6 })).toHaveTextContent('Domingo')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Breve Catecismo · P. 1')
    expect(screen.getByText('Catecismo · Breve Catecismo')).toBeInTheDocument()
    expect(liveCard()).toHaveTextContent('no ar')
    expect(cards()[1]).toHaveTextContent('a seguir')
  })

  it('Próximo walks the screens and crosses into the next item; Anterior goes back', async () => {
    const { db } = renderApp()
    await within(aside()).findByText('Credo Apostólico')
    const next = screen.getByRole('button', { name: /Próximo/ })
    await userEvent.click(next)
    await waitFor(() => expect(cards()[1]).toHaveClass('pres-slide--live'))
    expect(next).toHaveTextContent('Confissão de fé · Credo Apostólico')
    await userEvent.click(next)
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Credo Apostólico'))
    expect(cards()[0]).toHaveClass('pres-slide--live')
    await userEvent.click(screen.getByRole('button', { name: /Anterior/ }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Breve Catecismo · P. 1'))
    expect(stored(db)).toMatchObject({ live: 0, slide: 1, seq: 3 })
  })

  it('keyboard arrows step outside text fields', async () => {
    renderApp()
    await within(aside()).findByText('Credo Apostólico')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(cards()[1]).toHaveClass('pres-slide--live'))
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(cards()[0]).toHaveClass('pres-slide--live'))
  })

  it('clicking an item only views it; clicking a screen puts it on the air', async () => {
    renderApp()
    await userEvent.click(await within(aside()).findByText('Credo Apostólico'))
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Credo Apostólico')
    expect(liveCard()).toBeNull()
    await userEvent.click(cards()[2])
    await waitFor(() => expect(cards()[2]).toHaveClass('pres-slide--live'))
    expect(cards()[3]).toHaveTextContent('a seguir')
  })

  it('Limpar tela hides the screen and Mostrar texto brings it back', async () => {
    const { db } = renderApp()
    await within(aside()).findByText('Credo Apostólico')
    await userEvent.click(screen.getByRole('button', { name: 'Limpar tela' }))
    await screen.findByRole('button', { name: 'Mostrar texto' })
    expect(liveCard()).toBeNull()
    expect(within(aside()).queryByText('no ar')).toBeNull()
    expect(stored(db).blank).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar texto' }))
    await waitFor(() => expect(liveCard()).not.toBeNull())
  })

  it('the last screen says "Fim da liturgia"', async () => {
    renderApp()
    await userEvent.click(await within(aside()).findByText('Credo Apostólico'))
    const last = cards().at(-1)!
    await userEvent.click(last)
    await waitFor(() => expect(screen.getByRole('button', { name: /Próximo/ })).toHaveTextContent('Fim da liturgia'))
  })

  it('without services shows the empty state', async () => {
    renderApp('present', false)
    expect(await screen.findByText(/Nenhum item/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Liturgia vazia')
    expect(screen.getByRole('button', { name: /Próximo/ })).toBeDisabled()
  })
})

describe('Presenting from other tabs (US6.2)', () => {
  it('"Apresentar este culto" opens Present on the first screen of that service', async () => {
    renderApp('liturgy')
    await userEvent.click(await screen.findByRole('button', { name: /Apresentar este culto/ }))
    expect(await screen.findByRole('tabpanel')).toHaveAttribute('id', 'view-present')
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Breve Catecismo · P. 1')
  })

  it('"Apresentar agora" in the Library presents the item as Avulso without touching the liturgy', async () => {
    const { db } = renderApp('library')
    await userEvent.click(await screen.findByRole('button', { name: /Credos/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Credo Niceno/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Apresentar agora' }))
    await screen.findByRole('complementary', { name: 'Itens' })
    expect(await within(aside()).findByText('Avulso')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Credo Niceno')
    expect(liveCard()).not.toBeNull()
    expect(db.prepare('SELECT count(*) AS n FROM liturgy_items').get()).toEqual({ n: 2 })
    await userEvent.click(within(aside()).getByRole('button', { name: 'Tirar item avulso' }))
    await waitFor(() => expect(within(aside()).queryByText('Avulso')).toBeNull())
  })
})

describe('Quick search (US6.3)', () => {
  const field = () => screen.getByRole('combobox', { name: 'Busca rápida' })
  const options = () => screen.queryAllByRole('option').map((o) => o.textContent)

  it('book → tag → chapter.verse → Enter presents as Avulso', async () => {
    renderApp('liturgy')
    await userEvent.type(field(), '1')
    expect(options().slice(0, 3)).toEqual(['1Sm1 SamuelBíblia', '1Rs1 ReisBíblia', '1Cr1 CrônicasBíblia'])
    await userEvent.clear(field())
    await userEvent.type(field(), 'hebr{enter}')
    expect(screen.getByText('Hebreus', { selector: '.quick-search-tag' })).toBeInTheDocument()
    expect(field()).toHaveAttribute('placeholder', 'capítulo.versículo')
    await userEvent.type(field(), '12.14')
    expect(options()[0]).toContain('Hebreus 12.14')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('tabpanel')).toHaveAttribute('id', 'view-present')
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Hebreus 12.14')
    expect(within(aside()).getByText('Avulso')).toBeInTheDocument()
    expect(field()).toHaveValue('')
  })

  it('Backspace on an empty field drops the book; Esc cancels', async () => {
    renderApp('liturgy')
    await userEvent.type(field(), 'hebr{enter}')
    expect(document.querySelector('.quick-search-tag')).not.toBeNull()
    await userEvent.keyboard('{Backspace}')
    expect(document.querySelector('.quick-search-tag')).toBeNull()
    await userEvent.type(field(), 'hb{Escape}')
    expect(field()).toHaveValue('')
  })

  it('direct reference and collection prefixes', async () => {
    renderApp('liturgy')
    await userEvent.type(field(), 'hb 12.14-15')
    expect(options()).toEqual(['Hebreus 12.14–15Enter apresentaBíblia'])
    await userEvent.clear(field())
    await userEvent.type(field(), 'bc 1')
    await waitFor(() => expect(options()[0]).toMatch(/^Breve Catecismo · P\. 1Qual/))
    await userEvent.clear(field())
    await userEvent.type(field(), 'credo')
    await waitFor(() => expect(options().length).toBe(2))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Credo Niceno')
  })
})

describe('long items in sections (E11)', () => {
  function renderPsalm119() {
    const api = createTestApi()
    const insert = api.db.prepare("INSERT INTO bible_verses (version, book, chapter, verse, text) VALUES ('ARA', 'Sl', 119, ?, ?)")
    for (let v = 1; v <= 176; v++) insert.run(v, `Versículo ${v} do salmo.`)
    const s = createService(api.db, 'Domingo')
    addItem(api.db, s.id, { collection: 'bible:ARA', itemRef: 'Sl:119', moment: 'Leitura' })
    addItem(api.db, s.id, { collection: 'creeds', itemRef: 'apostles', moment: 'Credo' })
    render(<App initialTab="present" api={api.client} />)
    return api
  }
  const strip = () => screen.getByRole('navigation', { name: 'Seções' })
  const pressed = () => within(strip()).getByRole('button', { pressed: true })

  it('shows one section at a time, named after the suggested parts, following the air', async () => {
    renderPsalm119()
    await screen.findByRole('navigation', { name: 'Seções' })
    // 12 screens fit (fallback): the 8-verse parts stay one per section.
    expect(within(strip()).getAllByRole('button')).toHaveLength(22)
    expect(pressed()).toHaveTextContent('Álefe1–8')
    expect(cards()).toHaveLength(8)
    expect(cards()[0]).toHaveTextContent('Salmos 119.1')
    const next = screen.getByRole('button', { name: /Próximo/ })
    for (let i = 0; i < 7; i++) await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(cards()[7]).toHaveClass('pres-slide--live'))
    expect(next).toHaveTextContent('Bete · Versículo 9 do salmo.')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(pressed()).toHaveTextContent('Bete9–16'))
    expect(cards()[0]).toHaveTextContent('Salmos 119.9')
    expect(liveCard()).toHaveTextContent('Salmos 119.9')
  })

  it('Shift+arrows jump a section; picking a section only looks', async () => {
    const { db } = renderPsalm119()
    await screen.findByRole('navigation', { name: 'Seções' })
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}')
    await waitFor(() => expect(pressed()).toHaveTextContent('Guímel17–24'))
    expect(stored(db)).toMatchObject({ live: 0, slide: 16 })
    await userEvent.click(within(strip()).getByRole('button', { name: /Tau/ }))
    expect(cards()[0]).toHaveTextContent('Salmos 119.169')
    expect(liveCard()).toBeNull()
    expect(stored(db)).toMatchObject({ slide: 16 })
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    await waitFor(() => expect(pressed()).toHaveTextContent('Bete9–16'))
    expect(liveCard()).toHaveTextContent('Salmos 119.9')
  })

  it('short items have no strip', async () => {
    renderApp()
    await within(aside()).findByText('Credo Apostólico')
    expect(screen.queryByRole('navigation', { name: 'Seções' })).toBeNull()
  })
})
