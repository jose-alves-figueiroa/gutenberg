// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'

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
    expect(screen.getByRole('heading', { level: 2, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('clicking the connection status opens the Connection tab', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /OBS conectado/ }))
    expect(screen.getByRole('tab', { name: 'Conexão' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-connection')
  })

  it('shows IP and latency in the status', () => {
    render(<App ip="10.0.0.5" />)
    expect(screen.getByText('10.0.0.5 · 18 ms')).toBeInTheDocument()
  })

  it.each([
    ['unstable', 'Conexão instável'],
    ['offline', 'OBS sem resposta']
  ] as const)('status %s shows "%s"', (conn, label) => {
    render(<App conn={conn} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('has the quick search field', () => {
    render(<App />)
    expect(screen.getByRole('searchbox', { name: 'Busca rápida' })).toBeInTheDocument()
  })
})
