import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, toPayload } from '@shared/payload'
import { overlayView } from '@shared/overlay-view'
import { OVERLAY_FONTS, overlayFont, overlayHtml } from '../src/main/server/overlay'
import { createServerApp } from '../src/main/server/app'
import { createTestApi } from './helpers/test-api'

const slide = { header: 'Hebreus 12.15 (2/3)', lines: ['nem haja alguma raiz de amargura que,', 'brotando, vos perturbe,'] }
const bible = (style = DEFAULT_STYLE) => toPayload({ collection: 'bible:ara', slide }, style, 1).map
/** Font size in px in a 1080 px scene. */
const px = (vh: string) => Math.round((parseFloat(vh) * 1080) / 100)

describe('overlayView (US15.1)', () => {
  it('the text size comes from the maximum rows: 12 rows = 69 px, 10 rows = 83 px', () => {
    expect(px(overlayView(bible()).band.fontSize)).toBe(69)
    const song = toPayload({ collection: 'songbook:hnc', slide }, DEFAULT_STYLE, 1).map
    expect(px(overlayView(song).band.fontSize)).toBe(83)
    expect(overlayView({ ...bible(), font_max_rows: '6' }).band.fontSize).toBe(overlayView({ font_max_rows: 6, lines: ['a'] }).band.fontSize)
  })

  it('the header is half the text size; at most the lines of the payload', () => {
    const v = overlayView(bible())
    expect(v.header_.fontSize).toBe('0.5em')
    expect(v.header).toBe('Hebreus 12.15 (2/3)')
    expect(v.lines).toEqual(slide.lines)
    expect(v.line.whiteSpace).toBe('nowrap')
  })

  it('the default band: dark at 78 %, 6 % side margin, 5 % from the bottom, full width, shadow', () => {
    const v = overlayView(bible())
    expect(v.band.background).toBe('rgba(20, 18, 18, 0.78)')
    expect(v.wrap).toMatchObject({ left: '6vw', right: '6vw', bottom: '5vh' })
    expect(v.band.width).toBe('100%')
    expect(v.band.textShadow).not.toBe('none')
    expect(v.band.webkitTextStroke).toBe('0')
  })

  it('applies the output options', () => {
    const style = { ...DEFAULT_STYLE, bold: true, halign: 'left' as const, stroke: 'thick' as const, shadow: false, band: { opacity: 0, marginX: 10, marginY: 8, width: 'fit' as const } }
    const v = overlayView(bible(style))
    expect(v.band).toMatchObject({ background: 'transparent', width: 'auto', textAlign: 'left', textShadow: 'none' })
    expect(v.band.webkitTextStroke).toMatch(/^0\.278vh/)
    expect(v.line.fontWeight).toBe('600')
    expect(v.wrap).toMatchObject({ left: '10vw', bottom: '8vh' })
  })

  it('songs: the band is centred vertically', () => {
    const v = overlayView(toPayload({ collection: 'songbook:hnc', slide }, DEFAULT_STYLE, 1).map)
    expect(v.wrap).toMatchObject({ top: '50%', transform: 'translateY(-50%)' })
    expect(v.wrap.bottom).toBeUndefined()
  })

  it('hidden on CLEAR', () => {
    expect(overlayView(toPayload({ collection: null, slide: null }, DEFAULT_STYLE, 1).map).visible).toBe(false)
    expect(overlayView(bible()).visible).toBe(true)
  })
})

describe('overlay page (US15.1)', () => {
  it('draws a posted map in preview mode, with no external resources', async () => {
    const html = overlayHtml('bible')
    expect(html).not.toMatch(/https?:\/\//)
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://127.0.0.1:8484/overlay/bible?preview' })
    dom.window.postMessage({ map: bible() }, '*')
    await new Promise((r) => setTimeout(r, 20))
    const doc = dom.window.document
    expect(doc.getElementById('wrap')!.className).toBe('')
    expect(doc.getElementById('header')!.textContent).toBe('Hebreus 12.15 (2/3)')
    const band = doc.getElementById('band')!
    expect([...band.querySelectorAll('span')].slice(1).map((s) => s.textContent)).toEqual(slide.lines)
    expect(px(band.style.fontSize)).toBe(69)
    dom.window.close()
  })

  it('loads Source Serif 4 from the Gutenberg itself', async () => {
    expect(overlayHtml(null)).toContain("url('/overlay/fonts/source-serif-4-latin-400-normal.woff2')")
    expect(overlayFont('source-serif-4-latin-400-normal.woff2')!.byteLength).toBeGreaterThan(1000)
    expect(overlayFont('../package.json')).toBeNull()
    const { db } = createTestApi()
    const app = createServerApp(db)
    const LAN = { incoming: { socket: { remoteAddress: '192.168.0.30' } } }
    for (const file of OVERLAY_FONTS) {
      const res = await app.request(`/overlay/fonts/${file}`, {}, LAN)
      expect(res.status, file).toBe(200)
      expect(res.headers.get('content-type')).toBe('font/woff2')
    }
    expect((await app.request('/overlay/fonts/x.woff2', {}, LAN)).status).toBe(404)
  })
})
