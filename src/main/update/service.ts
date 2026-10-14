/**
 * Update service (PLAN.md → US10.2): wraps electron-updater's `autoUpdater` behind a small
 * interface, so the routes and tests don't depend on Electron. Never installs on its own while
 * the app is open: `auto` installs when the app quits (or on "Reiniciar e atualizar"); `dmg`
 * (macOS, E13) downloads the `.dmg` through a `DmgInstaller` and installs only on that button.
 */
import { UPDATE_INTERVAL_MS, releaseFileUrl, type UpdateMode, type UpdateState } from '../../shared/update'

/** What `update-available` says about the new version (part of electron-updater's UpdateInfo). */
export interface UpdateInfo {
  version: string
  files?: readonly { url: string; sha512: string; size?: number }[]
}

/** A release file to download: absolute URL and the sha512 (base64) from `latest-mac.yml`. */
export interface ReleaseFile {
  url: string
  sha512: string
  size?: number
}

/** The macOS side of `dmg` mode (see dmg.ts). */
export interface DmgInstaller {
  /** Downloads the file and checks its sha512; resolves with the local path. */
  download(file: ReleaseFile, version: string, onProgress: (percent: number) => void): Promise<string>
  /** Quits and swaps the app for the one in the `.dmg` (or opens the `.dmg` when it can't). */
  install(path: string): void
}

/** The part of electron-updater's AppUpdater the service uses. */
export interface Updater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
  on(event: 'checking-for-update', listener: () => void): unknown
  on(event: 'update-available', listener: (info: UpdateInfo) => void): unknown
  on(event: 'update-not-available' | 'update-downloaded', listener: (info: { version: string }) => void): unknown
  on(event: 'download-progress', listener: (progress: { percent: number }) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
}

export interface UpdateService {
  state(): UpdateState
  /** Checks now; errors (offline…) end up in the state, never thrown. */
  check(): Promise<UpdateState>
  /** Restarts into the downloaded version; false when there is none ready. */
  install(): boolean
  /** Checks now and every 6 h; returns a stop function. */
  start(): () => void
}

export function createUpdateService(opts: {
  version: string
  mode: UpdateMode
  updater?: Updater
  /** Required by `dmg` mode; without it the mode is off. */
  dmg?: DmgInstaller
  now?: () => number
}): UpdateService {
  const now = opts.now ?? Date.now
  const { updater, dmg } = opts
  const mode: UpdateMode = !updater || (opts.mode === 'dmg' && !dmg) ? 'off' : opts.mode
  let state: UpdateState = { mode, version: opts.version, status: 'idle', latest: null, percent: null, error: null, checkedAt: null }
  const set = (patch: Partial<UpdateState>) => (state = { ...state, ...patch })
  const failed = (err: Error) => {
    // Nothing published yet (or only drafts): there is nothing newer.
    if (/no published versions/i.test(err.message)) return set({ status: 'current', latest: null, error: null, checkedAt: now() })
    // A failed download keeps what is known; a failed check (offline…) shows the error's first line.
    const error = err.message.split('\n')[0].slice(0, 200)
    set({ status: state.latest && state.latest !== opts.version ? 'available' : 'error', error, checkedAt: now() })
  }

  if (updater) {
    updater.autoDownload = mode === 'auto'
    updater.autoInstallOnAppQuit = mode === 'auto'
    updater.on('checking-for-update', () => set({ status: 'checking', error: null }))
    updater.on('update-not-available', () => set({ status: 'current', latest: opts.version, checkedAt: now() }))
    updater.on('update-available', (info) => {
      set({ status: 'downloading', latest: info.version, percent: 0, checkedAt: now() })
      if (mode === 'dmg') downloadDmg(info)
    })
    updater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent) }))
    updater.on('update-downloaded', (info) => set({ status: 'ready', latest: info.version, percent: 100 }))
    updater.on('error', failed)
  }

  // macOS: the `.dmg` of the new version, once downloaded and checked.
  let dmgFile: string | null = null
  const downloadDmg = (info: UpdateInfo) => {
    const file = info.files?.find((f) => f.url.endsWith('.dmg'))
    if (!dmg || !file) return failed(new Error('no .dmg in latest-mac.yml'))
    dmg
      .download({ ...file, url: releaseFileUrl(info.version, file.url) }, info.version, (percent) => set({ percent: Math.round(percent) }))
      .then((path) => {
        dmgFile = path
        set({ status: 'ready', percent: 100 })
      })
      .catch(failed)
  }

  let checking: Promise<UpdateState> | null = null
  const check = () => {
    if (!updater || state.status === 'downloading' || state.status === 'ready') return Promise.resolve(state)
    checking ??= updater
      .checkForUpdates()
      .catch(failed)
      .then(() => state)
      .finally(() => (checking = null))
    return checking
  }

  return {
    state: () => state,
    check,
    install() {
      if (!updater || state.status !== 'ready') return false
      if (mode === 'dmg') {
        if (!dmg || !dmgFile) return false
        dmg.install(dmgFile)
        return true
      }
      if (mode !== 'auto') return false
      // Silent on Windows (the installer already knows the options); runs the new version after.
      updater.quitAndInstall(true, true)
      return true
    },
    start() {
      if (!updater) return () => {}
      void check()
      const timer = setInterval(() => void check(), UPDATE_INTERVAL_MS)
      return () => clearInterval(timer)
    }
  }
}
