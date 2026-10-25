// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FALLBACK_PAGE_SIZE, List, type ListRow } from '@renderer/views/library/parts'

afterEach(cleanup)

const rows = (n: number, go = () => {}): ListRow[] =>
  Array.from({ length: n }, (_, i) => ({ key: String(i + 1), label: String(i + 1), sub: `Hino ${i + 1}`, go }))
const labels = () => [...document.querySelectorAll('.lib-row-label')].map((e) => e.textContent)
const status = () => screen.getByText(/^Página \d+ de \d+$/).textContent

describe('paged list (US9.1)', () => {
  it('shows one page at a time with previous/next', async () => {
    render(<List rows={rows(30)} />)
    expect(labels()).toHaveLength(FALLBACK_PAGE_SIZE)
    expect(status()).toBe('Página 1 de 3')
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(labels()[0]).toBe('13')
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(labels()).toEqual(['25', '26', '27', '28', '29', '30'])
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(status()).toBe('Página 1 de 3')
  })

  it('has no pager when everything fits', () => {
    render(<List rows={rows(5)} />)
    expect(labels()).toHaveLength(5)
    expect(screen.queryByRole('navigation', { name: 'Páginas' })).toBeNull()
  })

  it('pages with ← and →, but not while typing', async () => {
    render(
      <>
        <input aria-label="busca" />
        <List rows={rows(30)} />
      </>
    )
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(status()).toBe('Página 3 de 3')
    await userEvent.keyboard('{ArrowLeft}')
    expect(status()).toBe('Página 2 de 3')
    await userEvent.click(screen.getByRole('textbox', { name: 'busca' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(status()).toBe('Página 2 de 3')
  })

  it('remembers the page when coming back from an item', async () => {
    const go = vi.fn()
    const { unmount } = render(<List pageKey="songbook:test" rows={rows(30, go)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await userEvent.click(screen.getByRole('button', { name: /Hino 15/ }))
    expect(go).toHaveBeenCalled()
    unmount()
    render(<List pageKey="songbook:test" rows={rows(30, go)} />)
    expect(status()).toBe('Página 2 de 3')
  })

  it('fits the rows to the window height', () => {
    const rect = (top: number, height: number) => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) })
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('lib-list') ? rect(200, 0) : rect(0, 40)
    })
    window.innerHeight = 1088
    render(<List rows={rows(100)} />)
    // (1088 − 200 − 88) / 40 = 20 rows
    expect(labels()).toHaveLength(20)
    expect(status()).toBe('Página 1 de 5')
    window.innerHeight = 568
    act(() => void window.dispatchEvent(new Event('resize')))
    expect(labels()).toHaveLength(7)
    spy.mockRestore()
  })
})
