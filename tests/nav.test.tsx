// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { createTestApi } from './helpers/test-api'

afterEach(cleanup)

describe('Nav', () => {
  it('shows the brand and the 4 tabs in design order', () => {
    render(<App />)
    expect(screen.getByText('Gutenberg')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Liturgia', 'Biblioteca', 'Apresentar', 'Conexão'])
  })

  it('opens on Liturgy with that tab selected', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Liturgia' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-liturgy')
  })

  it('switches the view when a tab is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('tab', { name: 'Biblioteca' }))
    expect(screen.getByRole('tab', { name: 'Biblioteca' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Liturgia' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-library')
  })

  it('clicking the connection status opens the Connection tab', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /OBS sem resposta/ }))
    expect(screen.getByRole('tab', { name: 'Conexão' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-connection')
  })

  /** An overlay on 10.0.0.5 reporting `rtt` ms (as the /overlay page does every 2 s). */
  async function withOverlay(rtt?: number) {
    const api = createTestApi()
    if (rtt !== undefined)
      await api.app.request(`/api/v1/health?output=bible&rtt=${rtt}`, {}, { incoming: { socket: { remoteAddress: '::ffff:10.0.0.5' } } })
    render(<App api={api.client} />)
    return api
  }

  it('shows the OBS address and latency when an overlay answers', async () => {
    await withOverlay(18)
    expect(await screen.findByText('10.0.0.5 · 18 ms')).toBeInTheDocument()
    expect(screen.getByText('OBS conectado')).toBeInTheDocument()
  })

  it('a slow overlay (> 500 ms) is "Conexão instável"', async () => {
    await withOverlay(640)
    expect(await screen.findByText('Conexão instável')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.5 · 640 ms')).toBeInTheDocument()
  })

  it('no overlay → "OBS sem resposta", waiting on this computer', async () => {
    await withOverlay()
    expect(await screen.findByText('tentando 192.168.0.12:8484')).toBeInTheDocument()
    expect(screen.getByText('OBS sem resposta')).toBeInTheDocument()
  })

  it('has the quick search field', () => {
    render(<App />)
    expect(screen.getByRole('combobox', { name: 'Busca rápida' })).toBeInTheDocument()
  })
})
