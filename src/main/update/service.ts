/**
 * Update service (PLAN.md → US10.2): wraps electron-updater's `autoUpdater` behind a small
 * interface, so the routes and tests don't depend on Electron. Never installs on its own while
 * the app is open: `auto` installs when the app quits (or on "Reiniciar e atualizar").
 */
import { UPDATE_INTERVAL_MS, type UpdateMode, type UpdateState } from '../../shared/update'

/** The part of electron-updater's AppUpdater the service uses. */
export interface Updater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
  on(event: 'checking-for-update', listener: () => void): unknown
  on(event: 'update-available' | 'update-not-available' | 'update-downloaded', listener: (info: { version: string }) => void): unknown
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

export function createUpdateService(opts: { version: string; mode: UpdateMode; updater?: Updater; now?: () => number }): UpdateService {
  const now = opts.now ?? Date.now
  const { updater } = opts
  const mode: UpdateMode = updater ? opts.mode : 'off'
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
    updater.on('update-available', (info) =>
      set({ status: mode === 'auto' ? 'downloading' : 'available', latest: info.version, percent: mode === 'auto' ? 0 : null, checkedAt: now() })
    )
    updater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent) }))
    updater.on('update-downloaded', (info) => set({ status: 'ready', latest: info.version, percent: 100 }))
    updater.on('error', failed)
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
      if (!updater || mode !== 'auto' || state.status !== 'ready') return false
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
