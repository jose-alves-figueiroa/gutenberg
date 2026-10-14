/**
 * App updates (PLAN.md → E10). The app reads the published GitHub Releases; no server of our own.
 * - `auto`: Windows, Linux and macOS signed with a Developer ID download in the background and
 *   install when the app quits;
 * - `dmg`: macOS without a Developer ID can't use Squirrel.Mac, so the app downloads the `.dmg` itself
 *   and, on "Reiniciar e atualizar", swaps its own bundle (E13);
 * - `off`: development builds.
 */
export type UpdateMode = 'auto' | 'dmg' | 'off'

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

/**
 * How a packaged build updates (PLAN.md → E14): macOS signed with a Developer ID
 * (`GUTENBERG_MAC_SIGNING=developer-id`) updates like the others; an ad-hoc build downloads the `.dmg`.
 */
export function updateMode(platform: string, macSigning: string | undefined): UpdateMode {
  return platform === 'darwin' && macSigning !== 'developer-id' ? 'dmg' : 'auto'
}

/** Checks again every 6 h while the app stays open. */
export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000

/** Files of the published GitHub Releases, by tag (`v<version>/<file>`). */
export const RELEASES_DOWNLOAD_URL = 'https://github.com/jose-alves-figueiroa/gutenberg/releases/download'

/** Where a release file is downloaded: `latest-mac.yml` lists it by name, relative to its release. */
export const releaseFileUrl = (version: string, file: string): string =>
  /^https?:\/\//.test(file) ? file : `${RELEASES_DOWNLOAD_URL}/v${version}/${encodeURIComponent(file)}`

/** A newer version is known: shown in the nav. */
export const hasUpdate = (s: Pick<UpdateState, 'status'>): boolean => s.status === 'available' || s.status === 'downloading' || s.status === 'ready'
