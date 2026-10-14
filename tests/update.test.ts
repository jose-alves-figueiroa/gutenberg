import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUpdateService } from '../src/main/update/service'
import { UPDATE_INTERVAL_MS, hasUpdate } from '../src/shared/update'
import { createFakeDmg, createFakeUpdater } from './helpers/fake-updater'
import { createTestApi } from './helpers/test-api'

afterEach(() => vi.useRealTimers())

const LOCAL = { incoming: { socket: { remoteAddress: '127.0.0.1' } } }
const LAN = { incoming: { socket: { remoteAddress: '::ffff:10.0.0.5' } } }

describe('update service (US10.2)', () => {
  it('Windows/Linux: downloads in the background and installs when the app quits', async () => {
    const updater = createFakeUpdater((u) => u.emit('update-available', { version: '0.2.0' }))
    const updates = createUpdateService({ version: '0.1.0', mode: 'auto', updater, now: () => 1000 })
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(await updates.check()).toMatchObject({ status: 'downloading', latest: '0.2.0', percent: 0, checkedAt: 1000 })
    updater.emit('download-progress', { percent: 41.7 })
    expect(updates.state()).toMatchObject({ status: 'downloading', percent: 42 })
    updater.emit('update-downloaded', { version: '0.2.0' })
    expect(updates.state()).toMatchObject({ status: 'ready', percent: 100 })
    expect(hasUpdate(updates.state())).toBe(true)
    // No second check while one is ready; installing restarts into the new version.
    await updates.check()
    expect(updater.checks).toBe(1)
    expect(updates.install()).toBe(true)
    expect(updater.installs).toEqual([[true, true]])
  })

  it('macOS: downloads the .dmg of the release and installs only on the button', async () => {
    const files = [{ url: 'Gutenberg-0.2.0-mac-arm64.dmg', sha512: 'abc', size: 10 }]
    const updater = createFakeUpdater((u) => u.emit('update-available', { version: '0.2.0', files }))
    const dmg = createFakeDmg()
    const updates = createUpdateService({ version: '0.1.0', mode: 'dmg', updater, dmg })
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(await updates.check()).toMatchObject({ mode: 'dmg', status: 'downloading', latest: '0.2.0', percent: 0 })
    expect(dmg.downloads).toEqual([
      { url: 'https://github.com/jose-alves-figueiroa/gutenberg/releases/download/v0.2.0/Gutenberg-0.2.0-mac-arm64.dmg', version: '0.2.0' }
    ])
    dmg.progress(41.7)
    expect(updates.state()).toMatchObject({ status: 'downloading', percent: 42 })
    expect(updates.install()).toBe(false)
    dmg.finish('/tmp/Gutenberg-0.2.0.dmg')
    await vi.waitFor(() => expect(updates.state()).toMatchObject({ status: 'ready', percent: 100 }))
    expect(updater.checks).toBe(1)
    expect(updates.install()).toBe(true)
    expect(dmg.installs).toEqual(['/tmp/Gutenberg-0.2.0.dmg'])
    expect(updater.installs).toEqual([])
  })

  it('macOS: a failed download keeps the version known and the next check tries again', async () => {
    const files = [{ url: 'Gutenberg-0.2.0-mac-arm64.dmg', sha512: 'abc' }]
    const updater = createFakeUpdater((u) => u.emit('update-available', { version: '0.2.0', files }))
    const dmg = createFakeDmg()
    const updates = createUpdateService({ version: '0.1.0', mode: 'dmg', updater, dmg })
    await updates.check()
    dmg.fail(new Error('sha512 checksum mismatch'))
    await vi.waitFor(() => expect(updates.state()).toMatchObject({ status: 'available', latest: '0.2.0', error: 'sha512 checksum mismatch' }))
    await updates.check()
    expect(dmg.downloads).toHaveLength(2)
    // A release without a .dmg can't be downloaded; without an installer the mode is off.
    const none = createUpdateService({ version: '0.1.0', mode: 'dmg', updater: createFakeUpdater((u) => u.emit('update-available', { version: '0.2.0', files: [] })), dmg })
    expect(await none.check()).toMatchObject({ status: 'available', error: 'no .dmg in latest-mac.yml' })
    expect(createUpdateService({ version: '0.1.0', mode: 'dmg', updater }).state().mode).toBe('off')
  })

  it('up to date, offline and failed downloads', async () => {
    let next: 'current' | 'offline' = 'current'
    const updater = createFakeUpdater((u) => {
      if (next === 'current') u.emit('update-not-available', { version: '0.1.0' })
      else throw new Error('net::ERR_INTERNET_DISCONNECTED')
    })
    const updates = createUpdateService({ version: '0.1.0', mode: 'auto', updater })
    expect(await updates.check()).toMatchObject({ status: 'current', latest: '0.1.0' })
    next = 'offline'
    expect(await updates.check()).toMatchObject({ status: 'error', error: 'net::ERR_INTERNET_DISCONNECTED' })
    // A download that fails keeps the known version, so the operator can still see it.
    updater.emit('update-available', { version: '0.2.0' })
    updater.emit('error', new Error('sha512 checksum mismatch'))
    expect(updates.state()).toMatchObject({ status: 'available', latest: '0.2.0', error: 'sha512 checksum mismatch' })
  })

  it('nothing published yet counts as up to date; long errors keep their first line', async () => {
    let message = 'No published versions on GitHub'
    const updater = createFakeUpdater(() => {
      throw new Error(message)
    })
    const updates = createUpdateService({ version: '0.1.0', mode: 'auto', updater })
    expect(await updates.check()).toMatchObject({ status: 'current', error: null })
    message = 'HttpError: 503\n"method: GET url: https://github.com/…"\n    at stack'
    expect(await updates.check()).toMatchObject({ status: 'error', error: 'HttpError: 503' })
  })

  it('checks on start and every 6 hours', async () => {
    vi.useFakeTimers()
    const updater = createFakeUpdater((u) => u.emit('update-not-available', { version: '0.1.0' }))
    const stop = createUpdateService({ version: '0.1.0', mode: 'auto', updater }).start()
    expect(updater.checks).toBe(1)
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL_MS)
    expect(updater.checks).toBe(2)
    stop()
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL_MS)
    expect(updater.checks).toBe(2)
  })

  it('development builds (no updater) are off', async () => {
    const updates = createUpdateService({ version: '0.1.0', mode: 'auto' })
    expect(await updates.check()).toMatchObject({ mode: 'off', status: 'idle' })
    expect(updates.install()).toBe(false)
    expect(updates.start).not.toThrow()
  })
})

describe('update routes (US10.3)', () => {
  it('state, check and install, local only', async () => {
    const updater = createFakeUpdater((u) => u.emit('update-available', { version: '0.2.0' }))
    const { app } = createTestApi({ updates: createUpdateService({ version: '0.1.0', mode: 'auto', updater }) })
    expect(await (await app.request('/api/v1/update', {}, LOCAL)).json()).toMatchObject({ version: '0.1.0', status: 'idle' })
    expect((await app.request('/api/v1/update/install', { method: 'POST' }, LOCAL)).status).toBe(409)
    expect(await (await app.request('/api/v1/update/check', { method: 'POST' }, LOCAL)).json()).toMatchObject({ status: 'downloading' })
    updater.emit('update-downloaded', { version: '0.2.0' })
    expect((await app.request('/api/v1/update/install', { method: 'POST' }, LOCAL)).status).toBe(200)
    expect(updater.installs).toHaveLength(1)
    expect((await app.request('/api/v1/update', {}, LAN)).status).toBe(403)
    expect((await app.request('/api/v1/update/install', { method: 'POST' }, LAN)).status).toBe(403)
  })
})
