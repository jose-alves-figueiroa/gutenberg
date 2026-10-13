// npm run screenshots
// README screenshots (docs/images/): builds the app, opens it with an isolated profile and the
// prototype seed (tests/fixtures/canonical — never the shipped library, the repository is public),
// creates a sample service, connects a stand-in OBS (a hidden window on /overlay) and captures each
// tab at 1280×820, plus the overlay over a stand-in camera (obs.png).
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { _electron as electron } from 'playwright-core'

const root = join(import.meta.dirname, '..')
const work = join(root, 'tmp', 'screenshots')
const profile = join(work, 'profile')
const seed = join(work, 'seed.sqlite')
const images = join(root, 'docs', 'images')
const LAN_PORT = 8484

/** The Connection tab shows the LAN port: another Gutenberg on it would show an error. */
await new Promise((resolve, reject) => {
  const probe = createServer()
  probe.once('error', () => reject(new Error(`port ${LAN_PORT} is in use: close Gutenberg and run again`)))
  probe.listen(LAN_PORT, () => probe.close(resolve))
})

rmSync(work, { recursive: true, force: true })
mkdirSync(images, { recursive: true })
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })
run('npx', ['tsx', 'scripts/data-build.ts', '--dir', 'tests/fixtures/canonical', '--out', seed])
run('npx', ['electron-vite', 'build'])

const app = await electron.launch({
  args: ['.'],
  cwd: root,
  env: { ...process.env, GUTENBERG_USER_DATA: profile, GUTENBERG_SEED: seed }
})
try {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 820))

  // Sample service through the local API.
  // Runs in the renderer, where `window` exists.
  // eslint-disable-next-line no-undef
  const server = await page.evaluate(() => window.gutenberg.serverUrl)
  const post = async (path, body) => {
    const res = await fetch(`${server}/api/v1/liturgy${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
    return res.json()
  }
  await post('/services', { name: 'Culto vespertino · 05/10' })
  const { id } = await post('/services', { name: 'Culto matutino · 12/10' })
  const items = [
    ['Prelúdio', 'songbook:psalter', 'psalter-100'],
    ['Leitura', 'bible:ara', 'Hb:12:1-3'],
    ['Cântico', 'songbook:hnc', 'hnc-h1'],
    ['Confissão de fé', 'creeds', 'apostles'],
    ['Catecismo', 'catechism:wsc', '1'],
    ['Cântico final', 'songbook:psalter', 'psalter-133A']
  ]
  for (const [moment, collection, itemRef] of items) await post(`/services/${id}/items`, { moment, collection, itemRef })

  // Stand-in OBS: an overlay client, so the app shows "connected".
  await app.evaluate(({ BrowserWindow }, url) => {
    const obs = new BrowserWindow({ show: false, width: 1280, height: 720 })
    globalThis.obsWindow = obs
    // A dark gradient stands in for the camera; the overlay page is transparent on top of it.
    const html = `<body style="margin:0;height:100vh;background:linear-gradient(160deg,#4a5a6a,#1d2329 70%)"><iframe src="${url}" style="border:0;width:100%;height:100%"></iframe></body>`
    return obs.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  }, `http://127.0.0.1:${LAN_PORT}/overlay`)

  const tab = (name) => page.getByRole('tab', { name }).click()
  const shot = async (name) => {
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(images, `${name}.png`) })
    console.log(`screenshots: docs/images/${name}.png`)
  }

  await tab('Liturgia')
  await page.reload()
  await page.getByRole('textbox', { name: 'Nome do culto' }).waitFor()
  await shot('liturgy')

  await tab('Biblioteca')
  await page.getByRole('button', { name: 'Hebreus' }).click()
  await page.getByRole('button', { name: '12', exact: true }).click()
  await page.getByRole('button', { name: /^1\s/ }).first().click()
  await page.getByRole('button', { name: /^3\s/ }).first().click()
  await shot('library')

  await page.getByRole('button', { name: /Salmos genebrinos/ }).click()
  await page.getByRole('searchbox', { name: 'Buscar na coleção' }).fill('133')
  await page.locator('.lib-row').first().waitFor()
  await shot('library-search')

  await tab('Liturgia')
  await page.getByRole('button', { name: /Apresentar este culto/ }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Credo Apostólico/ }).click()
  await page.locator('.pres-slide').first().click()
  await shot('present')

  await page.waitForTimeout(800)
  const obs = await app.evaluate(async () => (await globalThis.obsWindow.webContents.capturePage()).toPNG().toString('base64'))
  writeFileSync(join(images, 'obs.png'), Buffer.from(obs, 'base64'))
  console.log('screenshots: docs/images/obs.png')

  await tab('Conexão')
  await shot('connection')
} finally {
  await app.close()
}
