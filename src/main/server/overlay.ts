/**
 * The OBS Browser Source page (`/overlay/<output>`, or `/overlay` for everything), served by
 * Gutenberg itself. Plain HTML + JS with no external resources (works offline): listens to
 * `/overlay/resources[/<output>]/events` (SSE), falls back to polling `/overlay/resources[/<output>]`
 * every second while SSE is down, ignores a `seq` lower than the last one and keeps the last text
 * on the screen if the network drops. It draws with the styles in the `map`, as the Holyrics
 * overlay does; the composition (camera, band) stays in OBS. `slug` must be a configured output
 * (validated slug), so it is safe to embed.
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
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
  body { display: flex; flex-direction: column; justify-content: flex-end; box-sizing: border-box; padding: 4vh 6vw; }
  #screen { text-shadow: 0 0.06em 0.18em rgba(0, 0, 0, 0.75); }
  #header { font-size: 2.6vh; opacity: 0.85; margin-bottom: 0.6vh; }
  #text { font-size: 5.2vh; line-height: 1.3; white-space: pre-line; }
  .hidden { visibility: hidden; }
</style>
</head>
<body>
<div id="screen" class="hidden"><div id="header"></div><div id="text"></div></div>
<script>
(function () {
  var last = -1, poll = null;
  var screen = document.getElementById('screen');
  var header = document.getElementById('header');
  var text = document.getElementById('text');
  var JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

  function show(payload) {
    var m = payload && payload.map;
    if (!m || typeof m.seq !== 'number' || m.seq < last) return;
    last = m.seq;
    document.body.style.justifyContent = JUSTIFY[m.valign] || 'flex-end';
    screen.style.color = m.color || '#FAFAFA';
    screen.style.fontFamily = m.font ? '"' + m.font + '", sans-serif' : 'sans-serif';
    screen.style.fontWeight = m.bold ? '700' : '400';
    screen.style.textAlign = m.halign || 'center';
    header.textContent = m.header || '';
    text.textContent = m.text || '';
    screen.className = m.type === 'CLEAR' || !m.text ? 'hidden' : '';
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
