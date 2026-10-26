// npm run design:implemented (and design:check, see the end)
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
// `--out <dir>` writes elsewhere (checking the screens while working, without touching the snapshot).
const outArg = process.argv.indexOf('--out')
const out = outArg > 0 ? join(root, process.argv[outArg + 1]) : join(root, 'design', 'implemented', version)
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
  ['library-bands', async () => {
    await tab('Biblioteca')
    await collection('Cultos e reuniões')
    await page.getByRole('textbox', { name: 'Nome na faixa' }).first().waitFor()
  }],
  ['liturgy-sermon', async () => {
    await tab('Liturgia')
    await page.locator('.lit-action-col .seg-opt', { hasText: 'Pregação' }).click()
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
  ['connection-remote', async () => {
    await tab('Conexão')
    await page.getByRole('button', { name: 'Controle remoto' }).click()
    await page.getByRole('img', { name: /Código QR/ }).waitFor()
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
      // The interface zoom (design v2) shrinks the CSS viewport by the same factor on both axes.
      const [cssW, cssH] = await page.evaluate(() => [window.innerWidth, window.innerHeight])
      const zoom = width / cssW
      if (zoom < 0.999 || Math.abs(zoom - height / cssH) > 0.01) throw new Error(`${size}: the window is ${cssW}x${cssH} CSS px (screen too small?)`)
      // Captured through CDP (Playwright's screenshot ignores the emulated viewport), then scaled to
      // the resolution the operator sees (this Mac may capture at 2×).
      const { data: shot } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const png = await app.evaluate(({ nativeImage }, [b64, w, h]) => nativeImage.createFromBuffer(Buffer.from(b64, 'base64')).resize({ width: w, height: h, quality: 'best' }).toPNG().toString('base64'), [shot, width, height])
      writeFileSync(join(dir, `${name}.png`), Buffer.from(png, 'base64'))
      writeFileSync(join(dir, `${name}.html`), localizeFonts(await page.evaluate(snapshotHtml, `${version} ${size} ${name}`)))
      report[size][name] = await page.evaluate(measureScroll)
      console.log(`design:implemented: ${size}/${name}`)
    }
  }
  writeFileSync(join(out, 'obs.png'), await captureObs(app, 1920, 1080))
  for (const file of fonts) copyFileSync(file, join(assets, basename(file)))
  writeFileSync(join(out, 'scroll.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`design:implemented: ${out}`)
  // `--check` (npm run design:check): fails when any screen scrolls (PLAN.md → E16).
  if (process.argv.includes('--check')) {
    const scrolls = Object.entries(report).flatMap(([size, screens]) =>
      Object.entries(screens)
        .filter(([, m]) => m.page > 0 || m.pageX > 0 || m.boxes.length > 0)
        .map(([name, m]) => `${size}/${name}: page ${m.page}px, x ${m.pageX}px, boxes ${JSON.stringify(m.boxes)}`)
    )
    if (scrolls.length) {
      console.error(`design:check: ${scrolls.length} screen(s) scroll:\n${scrolls.join('\n')}`)
      process.exitCode = 1
    } else console.log('design:check: no screen scrolls')
  }
} finally {
  await app.close()
}
