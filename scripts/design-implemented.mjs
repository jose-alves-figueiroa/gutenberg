// npm run design:implemented
// The app as built, for the Claude Design brief (design/README.md): captures every screen at the
// notebook resolutions of PLAN.md → E16 into design/implemented/<version>/<width>x<height>/, each as a
// PNG and a self-contained HTML (rendered DOM, inlined CSS, no scripts, fonts in ../assets), plus
// scroll.json with what scrolls (page and inner boxes) and the overlay at 1920×1080 (obs.png).
// measureScroll, snapshotHtml and the viewport check run in the renderer (page.evaluate).
/* global document, window, location, getComputedStyle */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureObs, openSession, root } from './app-session.mjs'

const RESOLUTIONS = [
  [1920, 1200],
  [1920, 1080],
  [1536, 864],
  [1280, 720]
]

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const out = join(root, 'design', 'implemented', version)
const assets = join(out, 'assets')
rmSync(out, { recursive: true, force: true })
mkdirSync(assets, { recursive: true })

const { app, page } = await openSession()
const cdp = await page.context().newCDPSession(page)

const tab = (name) => page.getByRole('tab', { name }).click()
const collection = (name) => page.getByRole('button', { name }).first().click()

/** Each screen starts from its tab, so the order does not matter. */
const SCREENS = [
  ['liturgy', async () => {
    await tab('Liturgia')
    await page.getByRole('textbox', { name: 'Nome do culto' }).waitFor()
  }],
  ['library-bible-books', async () => {
    await tab('Biblioteca')
    await collection(/Bíblia/)
  }],
  ['library-bible-chapter', async () => {
    await tab('Biblioteca')
    await collection(/Bíblia/)
    await page.getByRole('button', { name: 'Hebreus' }).click()
    await page.getByRole('button', { name: '12', exact: true }).click()
    await page.getByRole('button', { name: /^1\s/ }).first().click()
    await page.getByRole('button', { name: /^3\s/ }).first().click()
  }],
  ['library-search', async () => {
    await tab('Biblioteca')
    await collection(/Salmos genebrinos/)
    await page.getByRole('searchbox', { name: 'Buscar na coleção' }).fill('133')
    await page.locator('.lib-row').first().waitFor()
  }],
  ['library-songbook', async () => {
    await tab('Biblioteca')
    await collection(/Hinário Novo Cântico/)
  }],
  ['library-song', async () => {
    await tab('Biblioteca')
    await collection(/Hinário Novo Cântico/)
    await page.locator('.lib-row').first().click()
  }],
  ['library-confession', async () => {
    await tab('Biblioteca')
    await collection(/Confissão de Westminster/)
  }],
  ['library-catechism', async () => {
    await tab('Biblioteca')
    await collection(/Catecismo Maior/)
  }],
  ['library-creeds', async () => {
    await tab('Biblioteca')
    await collection(/Credos/)
  }],
  ['present', async () => {
    await tab('Liturgia')
    await page.getByRole('button', { name: /Apresentar este culto/ }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Credo Apostólico/ }).click()
    await page.locator('.pres-slide').first().click()
  }],
  ['connection', async () => {
    await tab('Conexão')
    await page.getByRole('button', { name: /^Estado/ }).click()
  }],
  ['connection-outputs', async () => {
    await tab('Conexão')
    await page.getByRole('button', { name: /^Saídas/ }).click()
  }],
  ['connection-output-editor', async () => {
    await tab('Conexão')
    await page.getByRole('button', { name: /^Saídas/ }).click()
    await page.getByRole('button', { name: 'Editar' }).first().click()
  }]
]

/** Runs in the renderer: what scrolls, as [selector, overflow px]. */
function measureScroll() {
  const describe = (el) =>
    el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + [...el.classList].map((c) => `.${c}`).join('')
  const doc = document.scrollingElement
  const result = { page: doc.scrollHeight - doc.clientHeight, pageX: doc.scrollWidth - doc.clientWidth, boxes: [] }
  for (const el of document.body.querySelectorAll('*')) {
    const { overflowY } = getComputedStyle(el)
    const over = el.scrollHeight - el.clientHeight
    if ((overflowY === 'auto' || overflowY === 'scroll') && over > 1) result.boxes.push([describe(el), over])
  }
  return result
}

/** Runs in the renderer: the DOM as a static page, with the CSS inlined and font URLs absolute. */
function snapshotHtml(meta) {
  const css = []
  for (const sheet of document.styleSheets) {
    const base = sheet.href ?? location.href
    for (const rule of sheet.cssRules) {
      css.push(rule.cssText.replace(/url\("?([^")]+)"?\)/g, (_, url) => `url("${new URL(url, base).href}")`))
    }
  }
  for (const el of document.querySelectorAll('input, textarea')) el.setAttribute('value', el.value)
  for (const el of document.querySelectorAll('option')) el.toggleAttribute('selected', el.selected)
  const clone = document.documentElement.cloneNode(true)
  for (const el of clone.querySelectorAll('script, link[rel="stylesheet"], style')) el.remove()
  const head = clone.querySelector('head')
  head.insertAdjacentHTML('beforeend', `<meta name="gutenberg-implemented" content="${meta}"><style>\n${css.join('\n')}\n</style>`)
  return `<!doctype html>\n${clone.outerHTML}\n`
}

/** Font files referenced as file:// URLs are copied to assets/ and pointed to as ../assets/<name>. */
const fonts = new Set()
const localizeFonts = (html) =>
  html.replace(/url\("(file:\/\/[^"]+)"\)/g, (_, url) => {
    const file = fileURLToPath(url)
    fonts.add(file)
    return `url("../assets/${basename(file)}")`
  })

const report = {}
try {
  for (const [width, height] of RESOLUTIONS) {
    const size = `${width}x${height}`
    const dir = join(out, size)
    mkdirSync(dir, { recursive: true })
    // The notebook's screen, not this machine's: the viewport is emulated, so it may exceed the monitor.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    report[size] = {}
    for (const [name, open] of SCREENS) {
      await open()
      await page.waitForTimeout(400)
      const viewport = await page.evaluate(() => [window.innerWidth, window.innerHeight])
      if (viewport[0] !== width || viewport[1] !== height) throw new Error(`${size}: the window is ${viewport.join('x')} (screen too small?)`)
      await page.screenshot({ path: join(dir, `${name}.png`), scale: 'css' })
      writeFileSync(join(dir, `${name}.html`), localizeFonts(await page.evaluate(snapshotHtml, `${version} ${size} ${name}`)))
      report[size][name] = await page.evaluate(measureScroll)
      console.log(`design:implemented: ${size}/${name}`)
    }
  }
  writeFileSync(join(out, 'obs.png'), await captureObs(app, 1920, 1080))
  for (const file of fonts) copyFileSync(file, join(assets, basename(file)))
  writeFileSync(join(out, 'scroll.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`design:implemented: design/implemented/${version}`)
} finally {
  await app.close()
}
