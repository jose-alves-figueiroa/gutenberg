// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'

afterEach(cleanup)

describe('Nav', () => {
  it('mostra a marca e as 4 abas na ordem do design', () => {
    render(<App />)
    expect(screen.getByText('Gutenberg')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Liturgia', 'Biblioteca', 'Apresentar', 'Conexão'])
  })

  it('abre em Liturgia com a aba marcada como ativa', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Liturgia' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-liturgia')
  })

  it('troca a view ao clicar numa aba', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('tab', { name: 'Biblioteca' }))
    expect(screen.getByRole('tab', { name: 'Biblioteca' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Liturgia' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { level: 2, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('clicar no status da conexão abre a aba Conexão', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /OBS conectado/ }))
    expect(screen.getByRole('tab', { name: 'Conexão' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'view-conexao')
  })

  it('mostra o IP e a latência no status', () => {
    render(<App ip="10.0.0.5" />)
    expect(screen.getByText('10.0.0.5 · 18 ms')).toBeInTheDocument()
  })

  it.each([
    ['instavel', 'Conexão instável'],
    ['offline', 'OBS sem resposta']
  ] as const)('status %s mostra "%s"', (conn, label) => {
    render(<App conn={conn} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('tem o campo de busca rápida', () => {
    render(<App />)
    expect(screen.getByRole('searchbox', { name: 'Busca rápida' })).toBeInTheDocument()
  })
})
