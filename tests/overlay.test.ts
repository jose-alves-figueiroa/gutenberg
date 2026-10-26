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

  it('the header is half the text size; then the lines of the payload', () => {
    const v = overlayView(bible())
    expect(v.blocks.map((b) => b.text)).toEqual(['Hebreus 12.15 (2/3)', ...slide.lines])
    expect(v.blocks[0].style.fontSize).toBe('0.5em')
    expect(v.blocks[1].style.whiteSpace).toBe('nowrap')
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
    expect(v.blocks[1].style.fontWeight).toBe('600')
    expect(v.wrap).toMatchObject({ left: '10vw', bottom: '8vh' })
  })

  it('songs: the band is centred vertically', () => {
    const v = overlayView(toPayload({ collection: 'songbook:hnc', slide }, DEFAULT_STYLE, 1).map)
    expect(v.wrap).toMatchObject({ top: '50%', transform: 'translateY(-50%)' })
    expect(v.wrap.bottom).toBeUndefined()
  })

  it('a band (E18): kicker, title and supporting line in a block at the bottom left', () => {
    const band = { kind: 'service' as const, kicker: 'Culto', title: 'Culto Matutino', subtitle: 'Domingo, 12 de outubro' }
    const v = overlayView(toPayload({ collection: null, slide: null, band }, DEFAULT_STYLE, 1).map)
    expect(v.visible).toBe(true)
    expect(v.blocks.map((b) => b.text)).toEqual(['Culto', 'Culto Matutino', 'Domingo, 12 de outubro'])
    expect(px(v.blocks[1].style.fontSize)).toBe(64)
    expect(v.blocks[2].style.fontStyle).toBe('italic')
    expect(v.wrap).toMatchObject({ left: '6vw', bottom: '5vh' })
    expect(v.wrap.right).toBeUndefined()
  })

  it('hidden on CLEAR', () => {
    expect(overlayView(toPayload({ collection: null, slide: null }, DEFAULT_STYLE, 1).map).visible).toBe(false)
    expect(overlayView(bible()).visible).toBe(true)
  })
})

describe('overlay fonts (US15.1)', () => {
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
