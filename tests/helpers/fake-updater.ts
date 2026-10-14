/** A stand-in for electron-updater's autoUpdater: tests fire its events by hand. */
import { EventEmitter } from 'node:events'
import type { DmgInstaller, ReleaseFile, Updater } from '../../src/main/update/service'

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

/** A stand-in for the macOS `.dmg` installer: downloads resolve or fail when the test says. */
export function createFakeDmg() {
  let finish: ((path: string) => void) | null = null
  let fail: ((err: Error) => void) | null = null
  const fake = {
    downloads: [] as { url: string; version: string }[],
    installs: [] as string[],
    progress: (() => {}) as (percent: number) => void,
    download(file: ReleaseFile, version: string, onProgress: (percent: number) => void) {
      fake.downloads.push({ url: file.url, version })
      fake.progress = onProgress
      return new Promise<string>((resolve, reject) => {
        finish = resolve
        fail = reject
      })
    },
    finish: (path: string) => finish?.(path),
    fail: (err: Error) => fail?.(err),
    install(path: string) {
      fake.installs.push(path)
    }
  }
  return fake satisfies DmgInstaller
}
