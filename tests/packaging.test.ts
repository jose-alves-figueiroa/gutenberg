import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_HTTP_PORT } from '../src/main/db/build'

const root = join(__dirname, '..')
const read = (file: string) => readFileSync(join(root, file), 'utf8')
const config = read('electron-builder.yml')
const pkg = JSON.parse(read('package.json'))

/** Width and height from a PNG header. */
function pngSize(file: string): [number, number] {
  const b = readFileSync(join(root, file))
  expect(b.subarray(1, 4).toString(), file).toBe('PNG')
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

describe('packaging (E8)', () => {
  it('ships the library database and the window icon as resources, where the main process looks', () => {
    expect(config).toMatch(/from: data\/build\/gutenberg\.sqlite\s+to: gutenberg\.sqlite/)
    expect(config).toMatch(/from: resources\/icon\.png\s+to: icon\.png/)
    const main = read('src/main/index.ts')
    expect(main).toContain("resourcePath('gutenberg.sqlite', 'data/build/gutenberg.sqlite')")
    expect(main).toContain("resourcePath('icon.png', 'resources/icon.png')")
  })

  it('has the icons in every size', () => {
    expect(pngSize('build/icon.png')).toEqual([1024, 1024])
    expect(pngSize('resources/icon.png')).toEqual([256, 256])
    for (const n of [16, 32, 64, 256, 512, 1024]) expect(pngSize(`build/icons/${n}x${n}.png`)).toEqual([n, n])
  })

  it('targets Windows x64 (NSIS), macOS arm64 (dmg, ad-hoc) and Linux x64 (deb, AppImage)', () => {
    expect(config).toMatch(/target: nsis\s+arch: \[x64\]/)
    expect(config).toMatch(/target: dmg\s+arch: \[arm64\]/)
    expect(config).toMatch(/identity: '-'/)
    expect(config).toMatch(/target: deb\s+arch: \[x64\]/)
    for (const os of ['mac', 'win', 'linux']) expect(pkg.scripts[`dist:${os}`]).toMatch(/^node scripts\/dist-check\.mjs && .* --publish never$/)
  })

  it('opens the firewall for the program on Windows (installed per machine)', () => {
    expect(config).toMatch(/perMachine: true/)
    expect(config).toContain('include: build/installer.nsh')
    const nsh = read('build/installer.nsh')
    expect(nsh).toContain('program="$INSTDIR\\Gutenberg.exe"')
    expect(nsh).toMatch(/customUnInstall[\s\S]*delete rule name="Gutenberg"/)
  })

  it('the deb scripts keep the default steps and open the default port', () => {
    const install = read('build/linux/after-install.sh')
    const remove = read('build/linux/after-remove.sh')
    expect(install).toContain("'/opt/Gutenberg/gutenberg'")
    expect(install).toContain('chrome-sandbox')
    expect(install).toContain(`ufw allow ${DEFAULT_HTTP_PORT}/tcp`)
    expect(remove).toContain(`ufw delete allow ${DEFAULT_HTTP_PORT}/tcp`)
    expect(install).not.toContain('${')
    for (const f of ['build/linux/after-install.sh', 'build/linux/after-remove.sh']) expect(statSync(join(root, f)).mode & 0o111, f).not.toBe(0)
  })

  it('CI unlocks the data on Ubuntu only and keeps installers private and short-lived', () => {
    const wf = read('.github/workflows/installers.yml')
    expect(wf).toMatch(/on:\s+workflow_dispatch:\s+workflow_call:/)
    expect(wf).not.toMatch(/softprops|gh release/)
    expect(wf).toContain('retention-days: 3')
    expect(existsSync(join(root, 'docs/OBS.md'))).toBe(true)
  })

  it('publishes a Release only from the manual release workflow, with notes from the changelog', () => {
    const wf = read('.github/workflows/release.yml')
    const triggers = wf.slice(wf.indexOf('\non:'), wf.indexOf('\npermissions:'))
    expect(triggers).toMatch(/workflow_dispatch:/)
    expect(triggers).not.toMatch(/push|pull_request|schedule|release:|workflow_run/)
    expect(wf).toContain('uses: ./.github/workflows/installers.yml')
    expect(wf).toContain('npm run --silent release:notes')
    expect(wf).toContain('gh release create "$tag"')
  })

  it('ships the update metadata the app reads (E10)', () => {
    expect(config).toMatch(/publish:\s+provider: github\s+owner: jose-alves-figueiroa\s+repo: gutenberg/)
    expect(read('.github/workflows/installers.yml')).toMatch(/release\/\*\/\*\.blockmap\s+release\/\*\/latest\*\.yml/)
    expect(read('.github/workflows/release.yml')).toContain("-name 'latest*.yml'")
  })
})
