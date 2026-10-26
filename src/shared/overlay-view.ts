/**
 * Layout of the OBS overlay (design v2 → Overlay no OBS): from a payload `map` to the inline
 * styles of the band and its text, in units of the scene (vh/vw), so it scales with the Browser
 * Source. Self-contained on purpose: the overlay page embeds its source (`overlayView.toString()`).
 */
export type OverlayMap = Record<string, unknown>

export interface OverlayView {
  visible: boolean
  /** Positions the band in the scene. */
  wrap: Record<string, string>
  band: Record<string, string>
  /** The texts inside the band, top to bottom, each with its own style. */
  blocks: { text: string; style: Record<string, string> }[]
}

export function overlayView(m: OverlayMap): OverlayView {
  const num = (v: unknown, fallback: number, min: number, max: number): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  const rows = num(m.font_max_rows, 12, 1, 60)
  // A 1080 px scene: 1 vh = 10.8 px, 1 vw = 19.2 px.
  const fontVh = 100 / (rows * 1.3)
  const opacity = num(m.band_opacity, 78, 0, 100)
  const marginX = num(m.band_margin_x, 6, 0, 20)
  const marginY = num(m.band_margin_y, 5, 0, 20)
  const hex = /^#[0-9a-f]{6}$/i.test(String(m.background)) ? String(m.background).slice(1) : '141212'
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')
  const stroke = m.text_stroke === 'thin' ? '0.139vh rgba(0, 0, 0, 0.7)' : m.text_stroke === 'thick' ? '0.278vh rgba(0, 0, 0, 0.8)' : '0'
  const valign = m.valign === 'top' || m.valign === 'middle' ? m.valign : 'bottom'
  const font = typeof m.font === 'string' && m.font ? m.font : 'Source Serif 4'
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const common = {
    boxSizing: 'border-box',
    background: opacity > 0 ? `rgba(${rgb}, ${opacity / 100})` : 'transparent',
    color: str(m.color) || '#FAFAFA',
    fontFamily: `"${font}", serif`,
    textShadow: m.text_shadow === false ? 'none' : '0 0.278vh 1.296vh rgba(0, 0, 0, 0.65)',
    webkitTextStroke: stroke,
    display: 'flex',
    flexDirection: 'column'
  }

  // A service, sacrament or sermon band (E18, design v2): a block at the bottom left.
  if (m.type === 'BAND') {
    const all: OverlayView['blocks'] = [
      { text: str(m.kicker), style: { fontSize: '2.407vh', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8fd8f0' } },
      { text: str(m.title), style: { fontSize: '5.926vh', lineHeight: '1.1', fontWeight: '600' } },
      { text: str(m.subtitle), style: { fontSize: '3.333vh', lineHeight: '1.2', fontStyle: 'italic', opacity: '0.88' } }
    ]
    const blocks = all.filter((b) => b.text)
    return {
      visible: Boolean(str(m.title)),
      wrap: { position: 'absolute', left: `${marginX}vw`, bottom: `${marginY}vh` },
      band: { ...common, padding: '2.593vh 2.292vw 2.963vh', gap: '0.741vh', maxWidth: '67.708vw' },
      blocks
    }
  }

  const lines = Array.isArray(m.lines) ? m.lines.map(String) : str(m.text) ? str(m.text).split('\n') : []
  const wrap: Record<string, string> = {
    position: 'absolute',
    left: `${marginX}vw`,
    right: `${marginX}vw`,
    display: 'flex',
    justifyContent: 'center'
  }
  if (valign === 'top') wrap.top = `${marginY}vh`
  else if (valign === 'middle') Object.assign(wrap, { top: '50%', transform: 'translateY(-50%)' })
  else wrap.bottom = `${marginY}vh`
  const header = str(m.header)
  const line = { lineHeight: '1.2', whiteSpace: 'nowrap', fontWeight: m.bold === true ? '600' : '400' }

  return {
    visible: m.type !== 'CLEAR' && lines.length > 0,
    wrap,
    band: {
      ...common,
      width: m.band_width === 'fit' ? 'auto' : '100%',
      padding: '0.35em 0.7em',
      fontSize: `${fontVh.toFixed(3)}vh`,
      textAlign: m.halign === 'left' || m.halign === 'right' ? m.halign : 'center',
      gap: '0.12em'
    },
    blocks: [
      ...(header ? [{ text: header, style: { fontSize: '0.5em', lineHeight: '1.1', opacity: '0.8', fontWeight: '400' } }] : []),
      ...lines.map((text) => ({ text, style: line }))
    ]
  }
}

/** Text size in px in a 1080 px scene for a number of maximum rows (the editor's labels). */
export const sceneFontPx = (rows: number): number => Math.round(1080 / (rows * 1.3))
