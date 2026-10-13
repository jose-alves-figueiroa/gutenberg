// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { App } from '@renderer/App'
import { FALLBACK_CAPACITY, useCapacity } from '@renderer/components/Sections'
import { createTestApi } from './helpers/test-api'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPsalm119() {
  const api = createTestApi()
  const insert = api.db.prepare("INSERT INTO bible_verses (version, book, chapter, verse, text) VALUES ('ARA', 'Sl', 119, ?, ?)")
  for (let v = 1; v <= 176; v++) insert.run(v, `Versículo ${v} do salmo.`)
  render(<App initialTab="library" api={api.client} />)
  return api
}
const strips = () => screen.getAllByRole('navigation', { name: 'Seções' })
const verses = () => [...document.querySelectorAll('.verse-n')].map((e) => e.textContent)

describe('long chapters in the Library (US11.2, US11.3)', () => {
  it('verses one section at a time; a passage can cross sections; its preview too', async () => {
    renderPsalm119()
    await userEvent.click(await screen.findByRole('button', { name: 'Salmos' }))
    await userEvent.click(screen.getByRole('button', { name: '119' }))
    await screen.findByRole('navigation', { name: 'Seções' })
    // 40 verses before measuring: five letters per section.
    expect(within(strips()[0]).getAllByRole('button')[0]).toHaveTextContent('Álefe–He1–40')
    expect(verses()).toHaveLength(40)
    await userEvent.click(screen.getByRole('button', { name: /^37\s*Versículo 37/ }))
    await userEvent.click(within(strips()[0]).getByRole('button', { name: /Vau/ }))
    expect(verses()[0]).toBe('41')
    await userEvent.click(screen.getByRole('button', { name: /^44\s*Versículo 44/ }))
    const preview = screen.getByRole('region', { name: /Como fica na transmissão · 8 telas/ })
    expect(within(preview).queryByRole('navigation')).toBeNull()
    expect(preview.querySelectorAll('.slide-card')).toHaveLength(8)
  })

  it('a long passage preview is cut at the suggested parts (12 screens fit)', async () => {
    renderPsalm119()
    await userEvent.click(await screen.findByRole('button', { name: 'Salmos' }))
    await userEvent.click(screen.getByRole('button', { name: '119' }))
    await userEvent.click(await screen.findByRole('button', { name: /^5\s*Versículo 5/ }))
    await userEvent.click(screen.getByRole('button', { name: /^20\s*Versículo 20/ }))
    const preview = screen.getByRole('region', { name: /Como fica na transmissão · 16 telas/ })
    // Álefe 5–8 and Bete fit together.
    const previewStrip = within(preview).getByRole('navigation', { name: 'Seções' })
    expect(within(previewStrip).getAllByRole('button').map((b) => b.textContent)).toEqual(['Álefe–Bete5–16', 'Guímel17–20'])
    expect(preview.querySelectorAll('.slide-card')).toHaveLength(12)
    await userEvent.click(within(previewStrip).getByRole('button', { name: /Guímel/ }))
    expect(preview.querySelectorAll('.slide-card')).toHaveLength(4)
  })
})

describe('capacity (E11)', () => {
  function Probe({ n }: { n: number }) {
    const ref = useRef<HTMLDivElement>(null)
    const capacity = useCapacity(ref, { reserve: 100 })
    return (
      <div>
        <output>{capacity}</output>
        <div ref={ref}>
          {Array.from({ length: n }, (_, i) => (
            <span key={i} className="cell" data-i={i} />
          ))}
        </div>
      </div>
    )
  }

  it('columns × rows of average height between the top and the window bottom', () => {
    // Three columns of 90 px cards starting at 100 px.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = Number(this.dataset.i ?? -1)
      const rect = i < 0 ? { top: 100, height: 0 } : { top: 100 + Math.floor(i / 3) * 90, height: 90 }
      return { ...rect, bottom: rect.top + rect.height, left: 0, right: 0, width: 0, x: 0, y: rect.top, toJSON: () => ({}) }
    })
    window.innerHeight = 650
    render(<Probe n={6} />)
    // (650 − 100 − 100) / 90 = 5 rows × 3 columns
    expect(screen.getByRole('status').textContent).toBe('15')
    window.innerHeight = 380
    act(() => void window.dispatchEvent(new Event('resize')))
    expect(screen.getByRole('status').textContent).toBe('6')
  })

  it('falls back when nothing can be measured', () => {
    render(<Probe n={3} />)
    expect(screen.getByRole('status').textContent).toBe(String(FALLBACK_CAPACITY))
  })
})
