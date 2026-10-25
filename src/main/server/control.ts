/**
 * The phone's page (`/control`, design v2 → Celular): pairing by PIN, then the screen on the air,
 * the one up next, the liturgy items and Anterior / Próximo / Limpar tela. Plain HTML + JS with no
 * external resources (works offline), mobile first (375–430 px), dark with the Broadsheet tokens
 * (legible in a dark church). The token from pairing stays in the phone (localStorage); a 401 or a
 * revocation goes back to pairing.
 */
import { t } from '../../shared/i18n'

const TEXT = {
  pairTitle: t('control.pairTitle'),
  pairHint: t('control.pairHint'),
  pair: t('control.pair'),
  pinWrong: t('control.pinWrong'),
  erase: t('control.erase'),
  connected: t('control.connected'),
  offline: t('control.offline'),
  onAir: t('control.onAir'),
  upNext: t('control.upNext'),
  screen: t('control.screen'),
  blankNote: t('control.blankNote'),
  nothing: t('control.nothing'),
  end: t('control.end'),
  items: t('control.items'),
  prev: t('control.prev'),
  next: t('control.next'),
  blank: t('control.blank'),
  show: t('control.show'),
  device: t('control.device')
}

export function controlHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2d2b2b">
<title>${t('control.title')}</title>
<style>
  @font-face { font-family: 'Source Serif 4'; font-weight: 400; src: url('/overlay/fonts/source-serif-4-latin-400-normal.woff2') format('woff2'); }
  @font-face { font-family: 'Source Serif 4'; font-weight: 600; src: url('/overlay/fonts/source-serif-4-latin-600-normal.woff2') format('woff2'); }
  /* Broadsheet tokens (src/renderer/src/styles/tokens.css), the dark side of the design. */
  :root { --bg: #2d2b2b; --surface: #444141; --text: #f8f4f4; --muted: #bab6b6; --accent: #0088b0; --accent-400: #62c5ee; --live: #ffc0d0; --error: #ff90b1; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font-family: 'Source Serif 4', Georgia, serif; -webkit-tap-highlight-color: transparent; }
  button { font: inherit; color: inherit; border: 0; border-radius: 2px; cursor: pointer; }
  .hidden { display: none !important; }
  .brand { font-weight: 600; font-size: 20px; letter-spacing: -0.02em; }
  .muted { color: var(--muted); }
  .kicker { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  /* Pairing */
  #pair { min-height: 100%; display: flex; flex-direction: column; gap: 20px; padding: 24px 20px; max-width: 430px; margin: 0 auto; }
  #pair h1 { font-size: 30px; margin: 8px 0 0; }
  #pair p { margin: 0; font-size: 16px; line-height: 1.4; }
  .boxes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .box { height: 60px; border: 1px solid var(--surface); border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 600; }
  .box.active { border-color: var(--accent-400); }
  .wrong .box { border-color: var(--error); }
  #pin-error { color: var(--error); min-height: 20px; font-size: 15px; }
  .keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: auto; }
  .key { height: 60px; background: var(--surface); font-size: 24px; }
  .primary { background: var(--accent); color: #fff; font-weight: 600; }
  #pair-go { height: 56px; font-size: 18px; }
  #pair-go:disabled { opacity: 0.45; }
  /* Control */
  #control { height: 100%; display: flex; flex-direction: column; max-width: 430px; margin: 0 auto; }
  header { height: 56px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid var(--surface); }
  .status { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent-400); }
  .status.off .dot { background: var(--error); }
  .screen { flex: none; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--surface); }
  #air .kicker { color: var(--live); }
  #air-title { font-size: 22px; font-weight: 600; }
  .lines { font-size: 17px; line-height: 1.35; }
  #next .lines { color: var(--muted); font-size: 15px; }
  #list { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .item { display: flex; flex-direction: column; justify-content: center; gap: 2px; width: 100%; min-height: 60px; padding: 8px 16px; text-align: left; background: transparent; border-bottom: 1px solid var(--surface); border-radius: 0; }
  .item.live { background: var(--surface); }
  .item-title { font-size: 17px; font-weight: 600; }
  footer { flex: none; display: grid; grid-template-columns: 1fr 2fr; gap: 8px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--surface); }
  #prev { height: 72px; background: var(--surface); font-size: 18px; }
  #next-btn { height: 72px; font-size: 20px; }
  #blank { grid-column: 1 / -1; height: 52px; background: transparent; border: 1px solid var(--surface); font-size: 17px; }
</style>
</head>
<body>
<main id="pair" class="hidden">
  <span class="brand">Gutenberg</span>
  <h1>${TEXT.pairTitle}</h1>
  <p class="muted">${TEXT.pairHint}</p>
  <div id="boxes" class="boxes"></div>
  <div id="pin-error" role="alert"></div>
  <div id="keys" class="keys"></div>
  <button id="pair-go" class="primary" disabled>${TEXT.pair}</button>
</main>
<main id="control" class="hidden">
  <header><span class="brand">Gutenberg</span><span id="status" class="status"><span class="dot"></span><span id="status-text">${TEXT.connected}</span></span></header>
  <section id="air" class="screen" aria-live="polite"><span id="air-kicker" class="kicker"></span><span id="air-title"></span><span id="air-lines" class="lines"></span></section>
  <section id="next" class="screen"><span id="next-kicker" class="kicker">${TEXT.upNext}</span><span id="next-lines" class="lines"></span></section>
  <nav id="list" aria-label="${TEXT.items}"></nav>
  <footer>
    <button id="prev">${TEXT.prev}</button>
    <button id="next-btn" class="primary">${TEXT.next}</button>
    <button id="blank">${TEXT.blank}</button>
  </footer>
</main>
<script>
(function () {
  var T = ${JSON.stringify(TEXT)};
  var KEY = 'gutenberg.control.token';
  var token = null;
  try { token = localStorage.getItem(KEY); } catch (e) {}
  var view = null, events = null;
  var $ = function (id) { return document.getElementById(id); };
  function fill(text, vars) { return text.replace('{k}', vars.k).replace('{n}', vars.n); }

  // — pairing —
  var pin = '';
  function drawPin() {
    var boxes = $('boxes');
    boxes.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var b = document.createElement('span');
      b.className = 'box' + (i === pin.length ? ' active' : '');
      b.textContent = pin[i] || '';
      boxes.appendChild(b);
    }
    $('pair-go').disabled = pin.length !== 6;
  }
  function press(k) {
    $('pair').classList.remove('wrong');
    $('pin-error').textContent = '';
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 6) pin += k;
    drawPin();
  }
  ['1','2','3','4','5','6','7','8','9','','0','del'].forEach(function (k) {
    var b = document.createElement('button');
    b.className = 'key';
    if (k === '') { b.style.visibility = 'hidden'; }
    b.textContent = k === 'del' ? '⌫' : k;
    if (k === 'del') b.setAttribute('aria-label', T.erase);
    b.onclick = function () { if (k) press(k); };
    $('keys').appendChild(b);
  });
  $('pair-go').onclick = function () {
    fetch('/control/api/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: pin, name: T.device, platform: navigator.platform || '' }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) { token = d.token; try { localStorage.setItem(KEY, token); } catch (e) {} pin = ''; start(); })
      .catch(function () { $('pair').classList.add('wrong'); $('pin-error').textContent = T.pinWrong; pin = ''; drawPin(); $('pair').classList.add('wrong'); });
  };
  function showPair() {
    token = null;
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (events) { events.close(); events = null; }
    $('control').classList.add('hidden');
    $('pair').classList.remove('hidden');
    drawPin();
  }

  // — control —
  function api(path, body) {
    return fetch('/control/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json', authorization: 'Bearer ' + token } : { authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 401) { showPair(); return Promise.reject(401); }
      return r.json();
    });
  }
  function screenText(s) { return s ? s.lines.join('\\n') : ''; }
  function draw(v) {
    view = v;
    var air = v.onAir;
    $('air-kicker').textContent = air ? [T.onAir, air.moment, fill(T.screen, { k: air.slide + 1, n: air.slides })].filter(Boolean).join(' · ') : (v.blank ? T.blankNote : T.nothing);
    $('air-title').textContent = air ? air.title : '';
    $('air-lines').textContent = screenText(air);
    $('air-lines').style.whiteSpace = 'pre-line';
    $('next-lines').textContent = v.upNext ? (v.upNext.slide === 0 ? v.upNext.title + ': ' : '') + v.upNext.lines.join(' ') : T.end;
    $('blank').textContent = v.blank ? T.show : T.blank;
    var list = $('list');
    list.innerHTML = '';
    v.items.forEach(function (it, i) {
      var b = document.createElement('button');
      b.className = 'item' + (i === v.live ? ' live' : '');
      var m = document.createElement('span'); m.className = 'kicker'; m.textContent = it.moment;
      var title = document.createElement('span'); title.className = 'item-title'; title.textContent = it.title;
      b.appendChild(m); b.appendChild(title);
      b.onclick = function () { command({ type: 'go', index: i, slide: 0 }); };
      list.appendChild(b);
    });
  }
  function command(c) { api('command', c).then(draw).catch(function () {}); }
  $('prev').onclick = function () { command({ type: 'step', delta: -1 }); };
  $('next-btn').onclick = function () { command({ type: 'step', delta: 1 }); };
  $('blank').onclick = function () { command({ type: 'blank', blank: !(view && view.blank) }); };
  function online(on) {
    $('status').className = 'status' + (on ? '' : ' off');
    $('status-text').textContent = on ? T.connected : T.offline;
  }
  function start() {
    $('pair').classList.add('hidden');
    $('control').classList.remove('hidden');
    api('state').then(function (v) {
      draw(v);
      events = new EventSource('/control/api/events?token=' + encodeURIComponent(token));
      events.onopen = function () { online(true); };
      events.onmessage = function (e) { try { draw(JSON.parse(e.data)); online(true); } catch (err) {} };
      events.addEventListener('revoked', showPair);
      events.onerror = function () { online(false); };
    }).catch(function () {});
  }
  if (token) start(); else showPair();
})();
</script>
</body>
</html>
`
}
