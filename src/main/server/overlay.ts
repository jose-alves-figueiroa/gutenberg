import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { overlayView } from '../../shared/overlay-view'

/** Font files the overlay page loads from `/overlay/fonts/` (Source Serif 4, from @fontsource). */
export const OVERLAY_FONTS: readonly string[] = ['400-normal', '400-italic', '600-normal'].flatMap((v) =>
  ['latin', 'latin-ext'].map((subset) => `source-serif-4-${subset}-${v}.woff2`)
)

const fontCache = new Map<string, ArrayBuffer>()

/** A font of `OVERLAY_FONTS` (the package ships with the app: it is a production dependency). */
export function overlayFont(file: string): ArrayBuffer | null {
  if (!OVERLAY_FONTS.includes(file)) return null
  let font = fontCache.get(file)
  if (!font) {
    const data = readFileSync(createRequire(import.meta.url).resolve(`@fontsource/source-serif-4/files/${file}`))
    font = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    fontCache.set(file, font)
  }
  return font
}

const fontFaces = ['400-normal', '400-italic', '600-normal']
  .map((v) => {
    const [weight, style] = v.split('-')
    const src = ['latin', 'latin-ext'].map((subset) => `url('/overlay/fonts/source-serif-4-${subset}-${v}.woff2') format('woff2')`)
    return `@font-face { font-family: 'Source Serif 4'; font-style: ${style}; font-weight: ${weight}; font-display: block; src: ${src.join(', ')}; }`
  })
  .join('\n  ')

/**
 * The OBS Browser Source page (`/overlay/<output>`, or `/overlay` for everything), served by
 * Gutenberg itself. Plain HTML + JS with no external resources (works offline): listens to
 * `/overlay/resources[/<output>]/events` (SSE), falls back to polling `/overlay/resources[/<output>]`
 * every second while SSE is down, ignores a `seq` lower than the last one and keeps the last text
 * on the screen if the network drops. It draws with the styles in the `map` through `overlayView`
 * (design v2); the composition (camera) stays in OBS. With `?preview` (the output editor) it only
 * draws the maps posted to it. `slug` must be a configured output (validated slug), so it is safe
 * to embed.
 */
export function overlayHtml(slug: string | null): string {
  const resource = slug ? `/overlay/resources/${slug}` : '/overlay/resources'
  const health = `/api/v1/health?output=${slug ?? ''}`
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gutenberg overlay${slug ? ` · ${slug}` : ''}</title>
<style>
  ${fontFaces}
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
  .hidden { visibility: hidden; }
</style>
</head>
<body>
<div id="wrap" class="hidden"><div id="band"><span id="header"></span></div></div>
<script>
(function () {
  var last = -1, poll = null;
  var overlayView = ${overlayView.toString()};
  var wrap = document.getElementById('wrap');
  var band = document.getElementById('band');
  var header = document.getElementById('header');

  function draw(m) {
    var v = overlayView(m);
    wrap.removeAttribute('style');
    band.removeAttribute('style');
    header.removeAttribute('style');
    Object.assign(wrap.style, v.wrap);
    Object.assign(band.style, v.band);
    Object.assign(header.style, v.header_);
    header.textContent = v.header;
    header.style.display = v.header ? '' : 'none';
    while (band.lastChild !== header) band.removeChild(band.lastChild);
    v.lines.forEach(function (l) {
      var span = document.createElement('span');
      Object.assign(span.style, v.line);
      span.textContent = l;
      band.appendChild(span);
    });
    wrap.className = v.visible ? '' : 'hidden';
  }

  function show(payload) {
    var m = payload && payload.map;
    if (!m || typeof m.seq !== 'number' || m.seq < last) return;
    last = m.seq;
    draw(m);
  }

  if (/[?&]preview(?:[=&]|$)/.test(location.search)) {
    window.addEventListener('message', function (e) { if (e.data && e.data.map) draw(e.data.map); });
    return;
  }

  function startPolling() {
    if (poll) return;
    poll = setInterval(function () {
      fetch('${resource}', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(show)
        .catch(function () { /* keep the last text */ });
    }, 1000);
  }
  function stopPolling() { if (poll) { clearInterval(poll); poll = null; } }

  function health() {
    var t0 = Date.now();
    fetch('${health}&rtt=' + (window.__rtt || 0), { cache: 'no-store' })
      .then(function () { window.__rtt = Date.now() - t0; })
      .catch(function () {});
  }
  setInterval(health, 2000);
  health();

  if (window.EventSource) {
    var es = new EventSource('${resource}/events');
    es.onopen = stopPolling;
    es.onmessage = function (e) { try { show(JSON.parse(e.data)); } catch (err) {} };
    es.onerror = startPolling;
  } else {
    startPolling();
  }
})();
</script>
</body>
</html>
`
}
