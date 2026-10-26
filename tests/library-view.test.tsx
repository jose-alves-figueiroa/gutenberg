// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { createTestApi } from './helpers/test-api'

afterEach(cleanup)

function renderLibrary() {
  const api = createTestApi()
  render(<App initialTab="library" api={api.client} />)
  return api
}

describe('Library — collections (US4.3)', () => {
  it('lists collections in the 3 groups, Bible first, then the band lists (design v2)', async () => {
    renderLibrary()
    const aside = screen.getByRole('complementary', { name: 'Biblioteca' })
    await within(aside).findByRole('button', { name: /Bíblia ARA/ })
    expect(within(aside).getAllByRole('heading', { level: 6 }).map((h) => h.textContent)).toEqual(['Bíblia', 'Hinário e salmos', 'Doutrina', 'Faixas'])
    expect(within(aside).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Bíblia ARA1',
      'Hinário Novo Cântico2',
      'Salmos genebrinos5',
      'Credos2',
      'Confissão de Westminster2',
      'Breve Catecismo3',
      'Catecismo Maior1',
      'Cultos e reuniões',
      'Sacramentos',
      'Pregadores'
    ])
    expect(within(aside).getByRole('button', { name: /Bíblia ARA/ })).toHaveAttribute('aria-current', 'true')
  })
})

describe('Library — Faixas (US18.1)', () => {
  it('edits the service bands as data: rename, add, remove, save', async () => {
    const { db } = renderLibrary()
    const aside = screen.getByRole('complementary', { name: 'Biblioteca' })
    await userEvent.click(await within(aside).findByRole('button', { name: 'Cultos e reuniões' }))
    const titles = await screen.findAllByRole('textbox', { name: 'Nome na faixa' })
    expect(titles.map((i) => (i as HTMLInputElement).value)).toEqual(['Culto Matutino', 'Culto Vespertino', 'Escola Bíblica Dominical', 'Reunião de Doutrina'])
    expect(screen.getByTitle('Prévia da saída no OBS')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remover Reunião de Doutrina' }))
    await userEvent.click(screen.getByRole('button', { name: /Novo culto ou reunião/ }))
    const added = screen.getAllByRole('textbox', { name: 'Nome na faixa' }).at(-1)!
    await userEvent.clear(added)
    await userEvent.type(added, 'Culto de Ação de Graças')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => {
      const stored = JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'bands'").get() as { value: string }).value)
      expect(stored.services.map((e: { title: string }) => e.title)).toEqual(['Culto Matutino', 'Culto Vespertino', 'Escola Bíblica Dominical', 'Culto de Ação de Graças'])
    })
  })

  it('preachers have only a name', async () => {
    renderLibrary()
    const aside = screen.getByRole('complementary', { name: 'Biblioteca' })
    await userEvent.click(await within(aside).findByRole('button', { name: 'Pregadores' }))
    await userEvent.click(await screen.findByRole('button', { name: /Novo pregador/ }))
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Novo pregador')
    expect(screen.queryByRole('textbox', { name: 'Linha de apoio (opcional)' })).toBeNull()
  })
})

describe('Library — Bible (US4.4)', () => {
  it('book → chapter → verses, with breadcrumb and passage selection', async () => {
    renderLibrary()
    expect(await screen.findByRole('heading', { level: 2, name: 'Bíblia ARA' })).toBeInTheDocument()
    expect(screen.getByText('Escolha o livro')).toBeInTheDocument()
    expect(screen.getByText('Novo Testamento')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Hebreus' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Hebreus' })).toBeInTheDocument()
    expect(screen.getByText('13 capítulos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '12' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Hebreus 12' })).toBeInTheDocument()
    const v14 = await screen.findByRole('button', { name: /^14\s*Segui a paz/ })
    const v15 = screen.getByRole('button', { name: /^15\s*atentando/ })
    expect(screen.getByText('Clique no primeiro versículo e depois no último, para um trecho')).toBeInTheDocument()

    await userEvent.click(v14)
    expect(v14).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Clique em outro versículo para estender o trecho')).toBeInTheDocument()
    await userEvent.click(v15)
    expect([v14, v15].map((v) => v.getAttribute('aria-pressed'))).toEqual(['true', 'true'])
    expect(screen.getByText('Clique em um versículo para recomeçar')).toBeInTheDocument()
    await userEvent.click(v15)
    expect([v14, v15].map((v) => v.getAttribute('aria-pressed'))).toEqual(['false', 'true'])

    const crumbs = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(within(crumbs).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bíblia ARA', 'Hebreus', 'Capítulo 12'])
    expect(within(crumbs).getByRole('button', { name: 'Capítulo 12' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(crumbs).getByRole('button', { name: 'Hebreus' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Hebreus' })).toBeInTheDocument()
  })

  it('rapid clicks in the same tick still build the passage', async () => {
    renderLibrary()
    await userEvent.click(await screen.findByRole('button', { name: 'Hebreus' }))
    await userEvent.click(screen.getByRole('button', { name: '12' }))
    const v14 = await screen.findByRole('button', { name: /^14\s*Segui a paz/ })
    const v15 = screen.getByRole('button', { name: /^15\s*atentando/ })
    act(() => {
      v14.click()
      v15.click()
    })
    expect([v14, v15].map((v) => v.getAttribute('aria-pressed'))).toEqual(['true', 'true'])
  })

  it('switching collection resets the path', async () => {
    renderLibrary()
    await userEvent.click(await screen.findByRole('button', { name: 'Hebreus' }))
    await userEvent.click(screen.getByRole('button', { name: /Breve Catecismo/ }))
    await userEvent.click(screen.getByRole('button', { name: /Bíblia ARA/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Bíblia ARA' })).toBeInTheDocument()
  })
})
