/**
 * App updates (PLAN.md → E10). The app reads the published GitHub Releases; no server of our own.
 * - `auto`: Windows and Linux download in the background and install when the app quits;
 * - `notify`: macOS without a Developer ID can't install updates, so it only tells there is one;
 * - `off`: development builds.
 */
export type UpdateMode = 'auto' | 'notify' | 'off'

export type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdateState {
  mode: UpdateMode
  /** Installed version. */
  version: string
  status: UpdateStatus
  /** Newest published version, once known. */
  latest: string | null
  /** Download progress, 0–100. */
  percent: number | null
  error: string | null
  /** Last finished check (ms since epoch). */
  checkedAt: number | null
}

/** Checks again every 6 h while the app stays open. */
export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000

/** Where the operator downloads a version by hand (macOS). */
export const RELEASES_URL = 'https://github.com/jose-alves-figueiroa/gutenberg/releases/latest'

/** A newer version is known: shown in the nav. */
export const hasUpdate = (s: Pick<UpdateState, 'status'>): boolean => s.status === 'available' || s.status === 'downloading' || s.status === 'ready'
