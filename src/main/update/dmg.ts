/**
 * macOS updates without a Developer ID (PLAN.md → US13.1). Squirrel.Mac only installs apps signed
 * by Apple, so the app downloads the `.dmg` of the new version itself and, on "Reiniciar e
 * atualizar", quits while a small script swaps the bundle and opens the new version. When the app
 * can't replace itself (outside a writable folder, or run straight from the `.dmg`), it opens the
 * `.dmg` in the Finder for the operator to drag over.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DmgInstaller, ReleaseFile } from './service'

/** The `.app` bundle that holds this executable, or null (development, other platforms). */
export function appBundle(exePath: string): string | null {
  const match = /^(.*?\.app)\/Contents\/MacOS\//.exec(exePath)
  return match ? match[1] : null
}

/** The bundle can be swapped: not translocated by Gatekeeper, not on a mounted image, writable. */
export async function canReplace(bundle: string | null, writable = (path: string) => access(path, constants.W_OK)): Promise<boolean> {
  if (!bundle || bundle.includes('/AppTranslocation/') || bundle.startsWith('/Volumes/')) return false
  try {
    await writable(dirname(bundle))
    await writable(bundle)
    return true
  } catch {
    return false
  }
}

/**
 * Runs detached after the app quits: `$1` pid to wait for, `$2` the `.dmg`, `$3` the bundle.
 * Copies next to the bundle first, so a failed copy leaves the installed version in place, and
 * opens whichever version ends up there.
 */
export const INSTALL_SCRIPT = `
pid="$1"; dmg="$2"; app="$3"
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
mnt="$(mktemp -d /tmp/gutenberg-update.XXXXXX)"
if hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$mnt" "$dmg" >/dev/null; then
  src="$(find "$mnt" -maxdepth 1 -name '*.app' | head -n 1)"
  if [ -n "$src" ] && rm -rf "$app.new" && ditto "$src" "$app.new"; then
    xattr -dr com.apple.quarantine "$app.new" 2>/dev/null
    rm -rf "$app" && mv "$app.new" "$app" && rm -f "$dmg"
  fi
  rm -rf "$app.new"
  hdiutil detach "$mnt" -quiet || hdiutil detach "$mnt" -force -quiet
fi
rmdir "$mnt" 2>/dev/null
open "$app"
`

/** Downloads `file` into `dir`, reporting progress, and keeps it only when the sha512 matches. */
export async function downloadVerified(
  fetchFn: (url: string) => Promise<Response>,
  file: ReleaseFile,
  target: string,
  onProgress: (percent: number) => void
): Promise<string> {
  const res = await fetchFn(file.url)
  if (!res.ok || !res.body) throw new Error(`HttpError: ${res.status} ${file.url}`)
  const total = Number(res.headers.get('content-length')) || file.size || 0
  await mkdir(dirname(target), { recursive: true })
  const part = `${target}.part`
  const out = await open(part, 'w')
  const hash = createHash('sha512')
  let received = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      await out.write(value)
      received += value.length
      if (total) onProgress(Math.min(99, (received / total) * 100))
    }
  } finally {
    await out.close()
  }
  if (hash.digest('base64') !== file.sha512) {
    await rm(part, { force: true })
    throw new Error('sha512 checksum mismatch')
  }
  await rename(part, target)
  return target
}

export function createDmgInstaller(opts: {
  /** Where the `.dmg` goes (the app's own folder, not Downloads). */
  dir: string
  exePath: string
  fetch: (url: string) => Promise<Response>
  openPath: (path: string) => Promise<string>
  quit: () => void
}): DmgInstaller {
  return {
    download: (file, version, onProgress) => downloadVerified(opts.fetch, file, join(opts.dir, `Gutenberg-${version}.dmg`), onProgress),
    install(path) {
      const bundle = appBundle(opts.exePath)
      void canReplace(bundle).then((ok) => {
        if (!ok || !bundle) return void opts.openPath(path)
        spawn('/bin/bash', ['-c', INSTALL_SCRIPT, 'gutenberg-update', String(process.pid), path, bundle], { detached: true, stdio: 'ignore' }).unref()
        opts.quit()
      })
    }
  }
}
