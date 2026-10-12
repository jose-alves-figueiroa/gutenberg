// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { createTestApi } from './helpers/test-api'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderApp(tab: 'liturgy' | 'library' = 'liturgy', seed?: (db: ReturnType<typeof createTestApi>['db']) => void) {
  const api = createTestApi()
  seed?.(api.db)
  render(<App initialTab={tab} api={api.client} />)
  return api
}
const aside = () => screen.getByRole('complementary', { name: 'Cultos' })
const rows = () => [...document.querySelectorAll('.lit-row')].map((r) => [r.querySelector('.lit-n')?.textContent, r.querySelector('.lit-title')?.textContent, r.querySelector('.lit-meta')?.textContent])
const items = (db: ReturnType<typeof createTestApi>['db']) =>
  db.prepare('SELECT position, moment, collection, item_ref AS ref FROM liturgy_items ORDER BY position').all()

describe('Liturgy (US5.2)', () => {
  it('creates and renames a service', async () => {
    renderApp()
    expect(await screen.findByText('Nenhum culto ainda — crie o primeiro.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Novo culto' }))
    const name = await screen.findByRole('textbox', { name: 'Nome do culto' })
    expect(name).toHaveValue('Novo culto')
    expect(screen.getByText('Nenhum item ainda — adicione abaixo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apresentar este culto/ })).toBeEnabled()
    await userEvent.clear(name)
    await userEvent.type(name, 'Domingo 12/10 · manhã{enter}')
    await waitFor(() => expect(within(aside()).getByRole('button', { name: /Domingo 12\/10 · manhã/ })).toHaveAttribute('aria-current', 'true'))
    expect(within(aside()).getByText('0 itens')).toBeInTheDocument()
  })

  it('adds items by Bible reference and by collection search, edits, moves, removes', async () => {
    const { db } = renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo culto' }))
    const picker = await screen.findByRole('region', { name: 'Adicionar à liturgia' })
    const search = within(picker).getByRole('textbox', { name: 'Buscar na coleção' })
    expect(search).toHaveAttribute('placeholder', 'Referência — ex.: hb 12.14-15')

    await userEvent.type(search, 'hebr')
    await userEvent.click(within(picker).getByRole('button', { name: 'Hebreus' }))
    expect(search).toHaveValue('Hb ')
    await userEvent.type(search, '12.14-15')
    await userEvent.click(within(picker).getByRole('button', { name: 'Adicionar Hebreus 12.14–15' }))
    await waitFor(() => expect(rows()).toEqual([['01', 'Hebreus 12.14–15', 'Bíblia ARA · 3 telas']]))
    expect(search).toHaveValue('')

    await userEvent.click(within(picker).getByRole('button', { name: 'Salmos genebrinos' }))
    expect(search).toHaveAttribute('placeholder', 'Número ou título')
    await userEvent.type(search, '133')
    await userEvent.click(await within(picker).findByRole('button', { name: 'Salmo 133B' }))
    await userEvent.click(within(picker).getByRole('button', { name: 'Credos' }))
    await userEvent.click(await within(picker).findByRole('button', { name: 'Credo Apostólico' }))
    await waitFor(() => expect(rows().map((r) => r[1])).toEqual(['Hebreus 12.14–15', 'Salmo 133B', 'Credo Apostólico']))

    const moment = screen.getAllByRole('textbox', { name: 'Momento' })[0]
    await userEvent.type(moment, 'Leitura{enter}')
    await waitFor(() => expect(items(db)[0]).toMatchObject({ moment: 'Leitura', collection: 'bible:ara', ref: 'Hb:12:14-15' }))

    expect(screen.getAllByRole('button', { name: 'Subir' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Descer' })[2]).toBeDisabled()
    await userEvent.click(screen.getAllByRole('button', { name: 'Descer' })[0])
    await waitFor(() => expect(rows().map((r) => r[1])).toEqual(['Salmo 133B', 'Hebreus 12.14–15', 'Credo Apostólico']))
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[0])
    await waitFor(() => expect(rows()).toEqual([['01', 'Hebreus 12.14–15', 'Bíblia ARA · 3 telas'], ['02', 'Credo Apostólico', 'Credos · 7 telas']]))
    expect(within(aside()).getByText('2 itens')).toBeInTheDocument()
  })

  it('deletes a service after confirmation', async () => {
    const { db } = renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo culto' }))
    await screen.findByRole('textbox', { name: 'Nome do culto' })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir culto' }))
    expect(db.prepare('SELECT count(*) AS n FROM services').get()).toEqual({ n: 1 })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir culto' }))
    expect(await screen.findByText('Nenhum culto ainda — crie o primeiro.')).toBeInTheDocument()
    expect(db.prepare('SELECT count(*) AS n FROM services').get()).toEqual({ n: 0 })
  })
})

describe('Library → "Adicionar à liturgia" (US5.3)', () => {
  it('adds the selected passage to the current service', async () => {
    const { db } = renderApp('library', (d) => d.prepare("INSERT INTO services (name) VALUES ('Domingo')").run())
    await userEvent.click(await screen.findByRole('button', { name: 'Hebreus' }))
    await userEvent.click(screen.getByRole('button', { name: '12' }))
    await userEvent.click(await screen.findByRole('button', { name: /^15\s*atentando/ }))
    const add = screen.getByRole('button', { name: 'Adicionar à liturgia' })
    await waitFor(() => expect(add).toBeEnabled())
    await userEvent.click(add)
    expect(await screen.findByText('Adicionado a Domingo')).toBeInTheDocument()
    expect(items(db)).toEqual([{ position: 1, moment: '', collection: 'bible:ara', ref: 'Hb:12:15' }])
  })

  it('cannot add while there is no service', async () => {
    renderApp('library')
    await userEvent.click(await screen.findByRole('button', { name: /Credos/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Credo Apostólico' }))
    expect(screen.getByRole('button', { name: 'Adicionar à liturgia' })).toBeDisabled()
  })
})
