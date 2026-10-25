/**
 * Layout of the OBS overlay (design v2 → Overlay no OBS): from a payload `map` to the inline
 * styles of the band and its text, in units of the scene (vh/vw), so it scales with the Browser
 * Source. Self-contained on purpose: the overlay page embeds its source (`overlayView.toString()`).
 */
export type OverlayMap = Record<string, unknown>

export interface OverlayView {
  visible: boolean
  header: string
  lines: string[]
  /** Positions the band in the scene. */
  wrap: Record<string, string>
  band: Record<string, string>
  header_: Record<string, string>
  line: Record<string, string>
}

export function overlayView(m: OverlayMap): OverlayView {
  const num = (v: unknown, fallback: number, min: number, max: number): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  const rows = num(m.font_max_rows, 12, 1, 60)
  // A 1080 px scene: 1 vh = 10.8 px.
  const fontVh = 100 / (rows * 1.3)
  const opacity = num(m.band_opacity, 78, 0, 100)
  const marginX = num(m.band_margin_x, 6, 0, 20)
  const marginY = num(m.band_margin_y, 5, 0, 20)
  const hex = /^#[0-9a-f]{6}$/i.test(String(m.background)) ? String(m.background).slice(1) : '141212'
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')
  const stroke = m.text_stroke === 'thin' ? '0.139vh rgba(0, 0, 0, 0.7)' : m.text_stroke === 'thick' ? '0.278vh rgba(0, 0, 0, 0.8)' : '0'
  const valign = m.valign === 'top' || m.valign === 'middle' ? m.valign : 'bottom'
  const font = typeof m.font === 'string' && m.font ? m.font : 'Source Serif 4'
  const lines = Array.isArray(m.lines) ? m.lines.map(String) : typeof m.text === 'string' && m.text ? m.text.split('\n') : []

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

  return {
    visible: m.type !== 'CLEAR' && lines.length > 0,
    header: typeof m.header === 'string' ? m.header : '',
    lines,
    wrap,
    band: {
      width: m.band_width === 'fit' ? 'auto' : '100%',
      boxSizing: 'border-box',
      padding: '0.35em 0.7em',
      background: opacity > 0 ? `rgba(${rgb}, ${opacity / 100})` : 'transparent',
      color: typeof m.color === 'string' ? m.color : '#FAFAFA',
      fontFamily: `"${font}", serif`,
      fontSize: `${fontVh.toFixed(3)}vh`,
      textAlign: m.halign === 'left' || m.halign === 'right' ? m.halign : 'center',
      textShadow: m.text_shadow === false ? 'none' : '0 0.278vh 1.296vh rgba(0, 0, 0, 0.65)',
      webkitTextStroke: stroke,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.12em'
    },
    header_: { fontSize: '0.5em', lineHeight: '1.1', opacity: '0.8', fontWeight: '400' },
    line: { lineHeight: '1.2', whiteSpace: 'nowrap', fontWeight: m.bold === true ? '600' : '400' }
  }
}
