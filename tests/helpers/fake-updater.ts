/** A stand-in for electron-updater's autoUpdater: tests fire its events by hand. */
import { EventEmitter } from 'node:events'
import type { Updater } from '../../src/main/update/service'

export function createFakeUpdater(onCheck: (u: FakeUpdater) => void = () => {}) {
  const events = new EventEmitter()
  const fake = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    checks: 0,
    installs: [] as [boolean | undefined, boolean | undefined][],
    emit: (event: string, arg?: unknown) => events.emit(event, arg),
    on(event: string, listener: (arg: never) => void) {
      events.on(event, listener as (arg: unknown) => void)
      return fake
    },
    async checkForUpdates() {
      fake.checks++
      events.emit('checking-for-update')
      onCheck(fake)
      return null
    },
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean) {
      fake.installs.push([isSilent, isForceRunAfter])
    }
  }
  return fake satisfies Updater
}
export type FakeUpdater = ReturnType<typeof createFakeUpdater>
