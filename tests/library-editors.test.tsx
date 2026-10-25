// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { createTestApi } from './helpers/test-api'

afterEach(cleanup)

function renderLibrary() {
  const api = createTestApi()
  render(<App initialTab="library" api={api.client} />)
  return api
}
const aside = () => screen.getByRole('complementary', { name: 'Biblioteca' })
const openCollection = async (name: RegExp) => userEvent.click(await within(aside()).findByRole('button', { name }))
const preview = () => screen.getByRole('region', { name: /Como fica na transmissão/ })
const cardHeaders = () => [...preview().querySelectorAll('.slide-card-head')].map((e) => e.textContent)

describe('Leaf (US4.9) — Bible passage preview, read only', () => {
  it('previews the selected passage; can be presented; no save buttons', async () => {
    renderLibrary()
    await userEvent.click(await screen.findByRole('button', { name: 'Hebreus' }))
    await userEvent.click(screen.getByRole('button', { name: '12' }))
    await userEvent.click(await screen.findByRole('button', { name: /^14\s*Segui/ }))
    await userEvent.click(screen.getByRole('button', { name: /^15\s*atentando/ }))
    expect(cardHeaders()).toEqual(['Hebreus 12.14', 'Hebreus 12.15 (1/2)', 'Hebreus 12.15 (2/2)'])
    expect(within(preview()).getByText('Como fica na transmissão · 3 telas')).toBeInTheDocument()
    expect(within(preview()).getByText(/Quebra automática nas pausas · até 96 caracteres/)).toBeInTheDocument()
    expect(within(preview()).getByRole('button', { name: 'Apresentar agora' })).toBeEnabled()
    expect(within(preview()).queryByRole('button', { name: 'Salvar' })).toBeNull()
  })
})

describe('Confessions (US4.5) and unregistered sections (US4.8)', () => {
  it('chapters → sections → editor; edit, discard, save', async () => {
    const { db } = renderLibrary()
    await openCollection(/Confissão de Westminster/)
    const row = await screen.findByRole('button', { name: /Da Escritura Sagrada/ })
    expect(row).toHaveTextContent('2 de 10 seções')
    await userEvent.click(row)
    expect(screen.getByRole('heading', { level: 2, name: '1. Da Escritura Sagrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).not.toHaveClass('cell--empty')
    expect(screen.getByRole('button', { name: '3' })).toHaveClass('cell--empty')

    await userEvent.click(screen.getByRole('button', { name: '1' }))
    expect(screen.getByRole('heading', { level: 2, name: 'CFW 1.1' })).toBeInTheDocument()
    const text = await screen.findByRole('textbox', { name: 'Texto corrido da seção' })
    expect(cardHeaders().every((h) => h === 'CFW 1.1')).toBe(true)
    const save = within(preview()).getByRole('button', { name: 'Salvar' })
    const discard = within(preview()).getByRole('button', { name: 'Descartar' })
    expect([save, discard].map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, true])

    const before = (text as HTMLTextAreaElement).value
    await userEvent.type(text, ' Fim.')
    expect(screen.getByRole('status')).toHaveTextContent('Alterações não salvas')
    await userEvent.click(discard)
    expect((text as HTMLTextAreaElement).value).toBe(before)

    await userEvent.clear(text)
    await userEvent.type(text, 'Texto revisado.')
    await userEvent.click(save)
    expect(await screen.findByText('Salvo; vale para todas as liturgias')).toBeInTheDocument()
    expect(db.prepare("SELECT text FROM confession_sections WHERE confession_id='wcf' AND chapter='1' AND section='1'").get()).toEqual({
      text: 'Texto revisado.'
    })
  })

  it('an unregistered section opens blank and is created only on save', async () => {
    const { db } = renderLibrary()
    await openCollection(/Confissão de Westminster/)
    await userEvent.click(await screen.findByRole('button', { name: /Da Escritura Sagrada/ }))
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    const text = await screen.findByRole('textbox', { name: 'Texto corrido da seção' })
    expect(text).toHaveValue('')
    expect(db.prepare("SELECT count(*) AS n FROM confession_sections WHERE chapter='1' AND section='3'").get()).toEqual({ n: 0 })
    await userEvent.type(text, 'Terceira seção.')
    await userEvent.click(within(preview()).getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Salvo; vale para todas as liturgias')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('button', { name: 'Capítulo 1' }))
    expect(await screen.findByRole('button', { name: '3' })).not.toHaveClass('cell--empty')
  })
})

describe('Catechisms (US4.6)', () => {
  it('grid of 107 questions; fills an unregistered one', async () => {
    renderLibrary()
    await openCollection(/Breve Catecismo/)
    expect(await screen.findByText('107 perguntas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).not.toHaveClass('cell--empty')
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pergunta 4' })).toBeInTheDocument()
    await userEvent.type(await screen.findByRole('textbox', { name: 'Pergunta' }), 'Que é Deus?')
    await userEvent.type(screen.getByRole('textbox', { name: 'Resposta' }), 'Deus é espírito.')
    expect(cardHeaders()).toEqual(['Breve Catecismo · P. 4 · pergunta', 'Breve Catecismo · P. 4'])
    await userEvent.click(within(preview()).getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Salvo; vale para todas as liturgias')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('button', { name: 'Breve Catecismo' }))
    expect(await screen.findByRole('button', { name: '4' })).not.toHaveClass('cell--empty')
  })
})

describe('Songbooks and creeds (US4.7)', () => {
  it('Psalter: 150 psalms → versions → new version, 2-line screens', async () => {
    const { db } = renderLibrary()
    await openCollection(/Salmos genebrinos/)
    expect(await screen.findByText('150 salmos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveClass('cell--empty')
    await userEvent.click(screen.getByRole('button', { name: '133' }))
    const rows = screen.getAllByRole('button').filter((b) => b.classList.contains('lib-row'))
    expect(rows.map((r) => r.querySelector('.lib-row-label')?.textContent)).toEqual(['133A', '133B'])

    await userEvent.click(screen.getByRole('button', { name: 'Nova versão' }))
    expect(screen.getByRole('textbox', { name: 'Versão' })).toHaveValue('C')
    await userEvent.type(screen.getByRole('textbox', { name: /^Letra/ }), 'um{enter}dois{enter}três')
    expect(cardHeaders()).toEqual(['Salmo 133C', 'Salmo 133C'])
    expect(within(preview()).getByText('Estrofes definem as telas · 2 versos por tela')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Salvo; vale para todas as liturgias')
    expect(db.prepare("SELECT title, lyrics FROM songs WHERE id = 'psalter-133C'").get()).toEqual({ title: 'Salmo 133C', lyrics: 'um\ndois\ntrês' })
    expect(screen.getByRole('heading', { level: 2, name: 'Salmo 133C' })).toBeInTheDocument()
  })

  it('Hymnal: list → editor with title header', async () => {
    renderLibrary()
    await openCollection(/Hinário Novo Cântico/)
    expect(await screen.findByRole('button', { name: 'Novo hino' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Castelo forte/ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Castelo forte' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Castelo forte')
    expect(cardHeaders()).toEqual(['Castelo forte', 'Castelo forte'])
  })

  it('Creeds: list → editor → save', async () => {
    const { db } = renderLibrary()
    await openCollection(/Credos/)
    await userEvent.click(await screen.findByRole('button', { name: 'Credo Apostólico' }))
    const title = screen.getByRole('textbox', { name: 'Título' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Credo dos Apóstolos')
    expect(cardHeaders().every((h) => h === 'Credo dos Apóstolos')).toBe(true)
    await userEvent.click(within(preview()).getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Salvo; vale para todas as liturgias')
    expect(db.prepare("SELECT title FROM creeds WHERE id='apostles'").get()).toEqual({ title: 'Credo dos Apóstolos' })
  })
})
