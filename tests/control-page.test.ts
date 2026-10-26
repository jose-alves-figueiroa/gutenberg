// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPresenter } from '../src/main/present/presenter'
import { addItem, createService } from '../src/main/liturgy/repository'
import { createServerApp } from '../src/main/server/app'
import { controlHtml } from '../src/main/server/control'
import { createRemote } from '../src/main/server/remote'
import { createTestApi } from './helpers/test-api'

const LAN = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

/** The phone page in this jsdom document, its fetch going to an in-process Gutenberg. */
function openPage() {
  const api = createTestApi()
  const s = createService(api.db, 'Domingo')
  addItem(api.db, s.id, { collection: 'creeds', itemRef: 'apostles', moment: 'Credo' })
  const presenter = createPresenter(api.db)
  const remote = createRemote(api.db)
  const app = createServerApp(api.db, { presenter, remote })
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => Promise.resolve(app.request(input, init, LAN)))
  const html = controlHtml()
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'))
  new Function(html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>')))()
  return { remote, presenter }
}
const $ = (id: string) => document.getElementById(id)!
const key = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.key')].find((b) => b.textContent === label)!
const settle = () => new Promise((r) => setTimeout(r, 30))

describe('phone page (US17.2)', () => {
  it('pairs with the PIN typed on its keypad, then shows on the air and up next', async () => {
    const { remote } = openPage()
    expect($('pair').classList.contains('hidden')).toBe(false)
    for (const d of remote.info().pin) key(d).click()
    expect(($('pair-go') as HTMLButtonElement).disabled).toBe(false)
    $('pair-go').click()
    await settle()
    expect($('control').classList.contains('hidden')).toBe(false)
    expect(localStorage.getItem('gutenberg.control.token')).toMatch(/^[0-9a-f]{64}$/)
    expect($('air-kicker').textContent).toBe('No ar · Credo · tela 1 de 7')
    expect($('air-title').textContent).toBe('Credo Apostólico')
    expect($('next-lines').textContent).toContain('seu único Filho')
    $('next-btn').click()
    await settle()
    expect($('air-kicker').textContent).toBe('No ar · Credo · tela 2 de 7')
    $('blank').click()
    await settle()
    expect($('air-kicker').textContent).toBe('Tela limpa')
    expect($('blank').textContent).toBe('Mostrar texto')
  })

  it('the Faixas tab sends a band and takes it off (US18.2)', async () => {
    const { remote, presenter } = openPage()
    for (const d of remote.info().pin) key(d).click()
    $('pair-go').click()
    await settle()
    $('tab-bands').click()
    const culto = [...document.querySelectorAll<HTMLButtonElement>('#list .item')].find((b) => b.textContent?.includes('Culto Matutino'))!
    culto.click()
    await settle()
    expect(presenter.view().state.band).toMatchObject({ title: 'Culto Matutino' })
    expect($('air-kicker').textContent).toBe('Faixa no ar · Culto')
    $('clear-band').click()
    await settle()
    expect(presenter.view().state.band).toBeNull()
    expect($('air-kicker').textContent).toBe('Nenhuma faixa no ar')
  })

  it('a wrong PIN says so and keeps pairing', async () => {
    const { remote } = openPage()
    const wrong = remote.info().pin === '000000' ? '111111' : '000000'
    for (const d of wrong) key(d).click()
    $('pair-go').click()
    await settle()
    expect($('pin-error').textContent).toBe('PIN incorreto ou vencido')
    expect($('control').classList.contains('hidden')).toBe(true)
  })
})
