// npm run screenshots
// README screenshots (docs/images/): opens the app with the sample service (app-session.mjs) and
// captures each tab at 1280×820, plus the overlay over a stand-in camera (obs.png).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { captureObs, openSession, root } from './app-session.mjs'

const images = join(root, 'docs', 'images')
mkdirSync(images, { recursive: true })

const { app, page } = await openSession()
try {
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

  writeFileSync(join(images, 'obs.png'), await captureObs(app, 1280, 720))
  console.log('screenshots: docs/images/obs.png')

  await tab('Conexão')
  await shot('connection')
  await page.getByRole('button', { name: /^Saídas/ }).click()
  await shot('connection-outputs')
} finally {
  await app.close()
}
