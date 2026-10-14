// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { LOG_FALLBACK } from '@renderer/views/connection/ConnectionView'
import { createTestApi } from './helpers/test-api'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const LAN = { incoming: { socket: { remoteAddress: '::ffff:10.0.0.5' } } }

async function renderConnection(health?: string) {
  const api = createTestApi()
  if (health) await api.app.request(`/api/v1/health?${health}`, {}, LAN)
  render(<App initialTab="connection" api={api.client} />)
  await screen.findByText('192.168.0.12')
  return api
}

/** The outputs are on their own page (US13.3: the tab never scrolls). */
async function openOutputs() {
  await userEvent.click(await screen.findByRole('button', { name: /^Saídas/ }))
  return screen.findByRole('region', { name: 'Saídas' })
}

const outputs = () => screen.getByRole('region', { name: 'Saídas' })
const stored = (db: ReturnType<typeof createTestApi>['db']) =>
  JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'outputs'").get() as { value: string }).value)

describe('Connection tab (US7.2)', () => {
  it('shows the state, OBS address, latency and the log', async () => {
    await renderConnection('output=bible&rtt=18')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Conectado')
    const dl = document.querySelector('.con-dl')!
    expect(dl).toHaveTextContent('Endereço IP10.0.0.5')
    expect(dl).toHaveTextContent('Porta8484')
    expect(dl).toHaveTextContent('Latência18 ms')
    expect(screen.getByText('Conectado a 10.0.0.5 (bible)')).toBeInTheDocument()
    expect(screen.getByText('192.168.0.12')).toBeInTheDocument()
  })

  it('without overlays: "Sem resposta"', async () => {
    await renderConnection()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sem resposta')
  })

  it('lists the default outputs with their URLs to copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await renderConnection('output=bible&rtt=18')
    expect(screen.queryByRole('region', { name: 'Saídas' })).toBeNull()
    await openOutputs()
    const bible = within(outputs()).getByRole('article', { name: 'Bíblia' })
    expect(bible).toHaveTextContent('http://192.168.0.12:8484/overlay/bible')
    expect(bible).toHaveTextContent('http://192.168.0.12:8484/overlay/resources/bible')
    expect(bible).toHaveTextContent('Todas as Bíblias')
    expect(bible).toHaveTextContent('OBS conectado')
    expect(within(outputs()).getByRole('article', { name: 'Salmos e hinos' })).toHaveTextContent('OBS sem resposta')
    await userEvent.click(within(bible).getByRole('button', { name: 'Copiar http://192.168.0.12:8484/overlay/bible' }))
    expect(writeText).toHaveBeenCalledWith('http://192.168.0.12:8484/overlay/bible')
  })

  it('the port accepts only digits (up to 5) and Reconectar applies it', async () => {
    const { db } = await renderConnection()
    const port = screen.getByRole('textbox', { name: 'Porta' })
    await userEvent.clear(port)
    await userEvent.type(port, '85a85123')
    expect(port).toHaveValue('85851')
    await userEvent.clear(port)
    await userEvent.type(port, '8585')
    await userEvent.click(screen.getByRole('button', { name: /Reconectar/ }))
    expect(await screen.findByText('Servidor na porta 8585')).toBeInTheDocument()
    expect(db.prepare("SELECT value FROM settings WHERE key = 'http_port'").get()).toEqual({ value: '8585' })
  })

  it('Testar logs the result', async () => {
    await renderConnection()
    await userEvent.click(screen.getByRole('button', { name: /Testar/ }))
    expect(await screen.findByText('Teste: nenhum overlay respondeu')).toBeInTheDocument()
  })

  it('the log pages its entries instead of growing (US13.3)', async () => {
    const { app } = await renderConnection()
    for (let i = 0; i < 10; i++) await app.request('/api/v1/connection/test', { method: 'POST' }, { incoming: { socket: { remoteAddress: '127.0.0.1' } } })
    await userEvent.click(screen.getByRole('button', { name: /Testar/ }))
    const rows = () => document.querySelectorAll('.con-log-row')
    expect(await screen.findByText('1 de 2')).toBeInTheDocument()
    expect(rows()).toHaveLength(LOG_FALLBACK)
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(rows()).toHaveLength(11 - LOG_FALLBACK)
  })

  it('creates an output, binding a single songbook taken from the kind', async () => {
    const { db } = await renderConnection()
    await openOutputs()
    await userEvent.click(within(outputs()).getByRole('button', { name: /Nova saída/ }))
    const form = within(outputs()).getByRole('form')
    await userEvent.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Salmos')
    await userEvent.type(within(form).getByRole('textbox', { name: 'Endereço (/overlay/…)' }), 'Salmos!')
    expect(within(form).getByRole('textbox', { name: 'Endereço (/overlay/…)' })).toHaveValue('salmos')
    expect(within(form).getByRole('checkbox', { name: /Todos os hinários e saltérios\s*· em Salmos e hinos/ })).toBeDisabled()
    await userEvent.click(within(form).getByRole('checkbox', { name: 'Salmos genebrinos' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar saída' }))
    await waitFor(() => expect(stored(db).map((o: { slug: string }) => o.slug)).toEqual(['bible', 'songs', 'doctrine', 'salmos']))
    expect(stored(db)[3].collections).toEqual(['songbook:psalter'])
    expect(await within(outputs()).findByRole('article', { name: 'Salmos' })).toHaveTextContent('/overlay/salmos')
  })

  it('rejects a reserved or repeated slug', async () => {
    await renderConnection()
    await openOutputs()
    await userEvent.click(within(outputs()).getByRole('button', { name: /Nova saída/ }))
    const form = within(outputs()).getByRole('form')
    await userEvent.type(within(form).getByRole('textbox', { name: 'Nome' }), 'X')
    const slug = within(form).getByRole('textbox', { name: 'Endereço (/overlay/…)' })
    await userEvent.type(slug, 'bible')
    expect(within(form).getByText('Outra saída já usa este endereço.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Salvar saída' })).toBeDisabled()
    await userEvent.clear(slug)
    await userEvent.type(slug, 'events')
    expect(within(form).getByText(/são reservados/)).toBeInTheDocument()
  })

  it('edits the style of an output and removes another', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { db } = await renderConnection()
    await openOutputs()
    const songs = within(outputs()).getByRole('article', { name: 'Salmos e hinos' })
    await userEvent.click(within(songs).getByRole('button', { name: 'Editar' }))
    const form = within(outputs()).getByRole('form')
    await userEvent.selectOptions(within(form).getByRole('combobox', { name: 'Posição vertical: Músicas' }), 'bottom')
    const font = within(form).getByRole('textbox', { name: 'Fonte' })
    await userEvent.clear(font)
    await userEvent.type(font, 'Source Serif 4')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar saída' }))
    await waitFor(() => expect(stored(db)[1].style).toMatchObject({ font: 'Source Serif 4', music: { valign: 'bottom' } }))
    await userEvent.click(within(await within(outputs()).findByRole('article', { name: 'Doutrina' })).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(stored(db).map((o: { slug: string }) => o.slug)).toEqual(['bible', 'songs']))
  })
})
