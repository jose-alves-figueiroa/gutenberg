// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@renderer/App'
import { createUpdateService, type DmgInstaller } from '../src/main/update/service'
import type { UpdateMode } from '../src/shared/update'
import { createFakeDmg, createFakeUpdater, type FakeUpdater } from './helpers/fake-updater'
import { createTestApi } from './helpers/test-api'

afterEach(cleanup)

function renderWith(mode: UpdateMode, onCheck: (u: FakeUpdater) => void, dmg?: DmgInstaller) {
  const updater = createFakeUpdater(onCheck)
  const updates = createUpdateService({ version: '0.1.0', mode, updater, dmg })
  const api = createTestApi({ updates })
  render(<App initialTab="connection" api={api.client} />)
  return { updater, updates }
}
const section = () => screen.findByRole('region', { name: 'Atualizações' })

describe('updates in the Connection tab and the nav (US10.3)', () => {
  it('shows the version, checks and offers to restart when the download is ready', async () => {
    const { updater } = renderWith('auto', (u) => u.emit('update-not-available', { version: '0.1.0' }))
    const s = await section()
    expect(s).toHaveTextContent('Versão instalada0.1.0')
    expect(within(s).getByRole('status')).toHaveTextContent('Ainda não verificado')
    await userEvent.click(within(s).getByRole('button', { name: 'Verificar atualizações' }))
    expect(await within(s).findByText('Você está na versão mais recente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Atualização/ })).toBeNull()

    updater.emit('update-available', { version: '0.2.0' })
    updater.emit('update-downloaded', { version: '0.2.0' })
    await userEvent.click(within(s).getByRole('button', { name: 'Verificar atualizações' }))
    expect(await within(s).findByText('Versão 0.2.0 pronta; instala ao fechar o Gutenberg')).toBeInTheDocument()
    await userEvent.click(within(s).getByRole('button', { name: 'Reiniciar e atualizar' }))
    expect(updater.installs).toHaveLength(1)
  })

  it('macOS: downloads by itself, then offers to restart; a notice in the nav', async () => {
    const files = [{ url: 'Gutenberg-0.2.0-mac-arm64.dmg', sha512: 'abc' }]
    const dmg = createFakeDmg()
    const { updates } = renderWith('dmg', (u) => u.emit('update-available', { version: '0.2.0', files }), dmg)
    await updates.check()
    const s = await section()
    expect(s).toHaveTextContent('só é instalada quando você clica em Reiniciar e atualizar')
    dmg.progress(50)
    await userEvent.click(within(s).getByRole('button', { name: 'Verificar atualizações' }))
    expect(await within(s).findByText('Baixando a versão 0.2.0… 50%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualização 0.2.0' })).toBeInTheDocument()
    dmg.finish('/tmp/Gutenberg-0.2.0.dmg')
    await vi.waitFor(() => expect(updates.state().status).toBe('ready'))
    await userEvent.click(within(s).getByRole('button', { name: 'Verificar atualizações' }))
    expect(await within(s).findByText('Versão 0.2.0 baixada; clique em Reiniciar e atualizar')).toBeInTheDocument()
    await userEvent.click(within(s).getByRole('button', { name: 'Reiniciar e atualizar' }))
    expect(dmg.installs).toEqual(['/tmp/Gutenberg-0.2.0.dmg'])
  })

  it('development builds say updates are off', async () => {
    const api = createTestApi()
    render(<App initialTab="connection" api={api.client} />)
    const s = await section()
    expect(s).toHaveTextContent('Atualização desligada nesta versão de desenvolvimento')
    expect(within(s).queryByRole('button')).toBeNull()
  })
})
