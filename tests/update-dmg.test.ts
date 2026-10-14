import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appBundle, canReplace, downloadVerified } from '../src/main/update/dmg'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'gutenberg-dmg-'))
  dirs.push(dir)
  return dir
}

const body = Buffer.from('fake dmg contents '.repeat(1000))
const sha512 = createHash('sha512').update(body).digest('base64')
const serve = (status = 200) => async () => new Response(status === 200 ? body : null, { status, headers: { 'content-length': String(body.length) } })

describe('macOS updates by .dmg (US13.1)', () => {
  it('finds the bundle of the running app', () => {
    expect(appBundle('/Applications/Gutenberg.app/Contents/MacOS/Gutenberg')).toBe('/Applications/Gutenberg.app')
    expect(appBundle('/Users/op/Apps/Gutenberg.app/Contents/MacOS/Gutenberg')).toBe('/Users/op/Apps/Gutenberg.app')
    expect(appBundle('/usr/lib/gutenberg/gutenberg')).toBeNull()
  })

  it('replaces itself only from a writable folder, never translocated or from the .dmg', async () => {
    const ok = async () => {}
    const denied = async () => {
      throw new Error('EACCES')
    }
    expect(await canReplace('/Applications/Gutenberg.app', ok)).toBe(true)
    expect(await canReplace('/Applications/Gutenberg.app', denied)).toBe(false)
    expect(await canReplace('/private/var/folders/x/AppTranslocation/y/d/Gutenberg.app', ok)).toBe(false)
    expect(await canReplace('/Volumes/Gutenberg 0.2.2/Gutenberg.app', ok)).toBe(false)
    expect(await canReplace(null, ok)).toBe(false)
  })

  it('downloads with progress and keeps the file only when the sha512 matches', async () => {
    const dir = tempDir()
    const progress: number[] = []
    const path = await downloadVerified(serve(), { url: 'https://x/G.dmg', sha512 }, join(dir, 'updates', 'G.dmg'), (p) => progress.push(p))
    expect(readFileSync(path)).toEqual(body)
    expect(progress.length).toBeGreaterThan(0)
    expect(Math.max(...progress)).toBeLessThan(100)

    const bad = join(dir, 'bad.dmg')
    await expect(downloadVerified(serve(), { url: 'https://x/G.dmg', sha512: 'nope' }, bad, () => {})).rejects.toThrow('sha512 checksum mismatch')
    expect(existsSync(bad) || existsSync(`${bad}.part`)).toBe(false)
    await expect(downloadVerified(serve(404), { url: 'https://x/G.dmg', sha512 }, bad, () => {})).rejects.toThrow('HttpError: 404')
  })
})
