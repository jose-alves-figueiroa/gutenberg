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

function renderApp(tab: 'library' | 'liturgy') {
  const api = createTestApi()
  render(<App initialTab={tab} api={api.client} />)
  return api
}
const search = () => screen.getByRole('searchbox', { name: 'Buscar na coleção' })
const resultRows = () => [...document.querySelectorAll('.lib-row-sub')].map((e) => e.textContent)

describe('Library search (E12)', () => {
  it('Bible: a reference opens the chapter, a name lists books', async () => {
    renderApp('library')
    await screen.findByRole('button', { name: 'Hebreus' })
    expect(search()).toHaveAttribute('placeholder', 'Livro ou referência, ex.: sl 119')
    await userEvent.type(search(), 'hebr')
    expect(resultRows()).toEqual(['Hebreus'])
    await userEvent.clear(search())
    await userEvent.type(search(), 'hb 12{enter}')
    expect(search()).toHaveValue('')
    expect(await screen.findByRole('heading', { level: 2, name: /Capítulo 12|Hebreus 12/ })).toBeInTheDocument()
  })

  it('songbook: number with version opens the song', async () => {
    renderApp('library')
    await userEvent.click(await screen.findByRole('button', { name: /Salmos genebrinos/ }))
    expect(search()).toHaveAttribute('placeholder', 'Número ou título, ex.: 42B')
    await userEvent.type(search(), '133b')
    await waitFor(() => expect(resultRows()).toEqual(['Salmo 133B']))
    expect(screen.getByRole('heading', { level: 2, name: 'Busca: 133b' })).toBeInTheDocument()
    expect(screen.getByText('1 resultado em Salmos genebrinos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Salmo 133B/ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Salmo 133B' })).toBeInTheDocument()
    expect(search()).toHaveValue('')
  })

  it('nothing found; Escape clears', async () => {
    renderApp('library')
    await userEvent.click(await screen.findByRole('button', { name: /Salmos genebrinos/ }))
    await userEvent.type(search(), 'zzz')
    expect(await screen.findByText('Nada encontrado.')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(screen.getByText('150 salmos')).toBeInTheDocument()
  })
})

describe('Library v2 (E16)', () => {
  it('the Bible lists the 66 books; those without text are faded', async () => {
    renderApp('library')
    await screen.findByRole('button', { name: 'Hebreus' })
    expect(document.querySelectorAll('.lib-grid--name .cell')).toHaveLength(66)
    expect(screen.getByRole('button', { name: 'Gênesis' })).toHaveClass('cell--empty')
    expect(screen.getByRole('button', { name: 'Hebreus' })).not.toHaveClass('cell--empty')
  })

  it('a hymn without a number shows "s/nº"', async () => {
    renderApp('library')
    await userEvent.click(await screen.findByRole('button', { name: /Hinário Novo Cântico/ }))
    const labels = await screen.findAllByText('s/nº')
    for (const l of labels) expect(l).toHaveClass('lib-row-label--muted')
  })
})

describe('services, most recent first (E12)', () => {
  it('lists the newest service first and selects it', async () => {
    renderApp('liturgy')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo culto' }))
    const name = await screen.findByRole('textbox', { name: 'Nome do culto' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Primeiro{enter}')
    await within(screen.getByRole('complementary', { name: 'Cultos' })).findByRole('button', { name: /Primeiro/ })
    await userEvent.click(screen.getByRole('button', { name: 'Novo culto' }))
    const aside = screen.getByRole('complementary', { name: 'Cultos' })
    await waitFor(() => expect([...aside.querySelectorAll('.lit-service-name')].map((e) => e.textContent)).toEqual(['Novo culto', 'Primeiro']))
    expect(within(aside).getByRole('button', { name: /Novo culto\s*0 itens/ })).toHaveAttribute('aria-current', 'true')
  })
})
