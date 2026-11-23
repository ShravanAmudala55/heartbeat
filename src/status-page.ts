export const statusPageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heartbeat status</title>
<style>
  :root { --bg:#fff7e8; --ink:#2b1b4d; --pink:#f0386b; --ok:#1f9d55; --bad:#d6294b; --mid:#6b5b8a; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1a1030; --ink:#fff4d6; --mid:#b9a9d6; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family: ui-monospace, Menlo, monospace; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px; }
  h1 { font-size: 28px; margin: 0 0 4px; color: var(--pink); letter-spacing: 2px; }
  .sub { color: var(--mid); margin-bottom: 24px; font-size: 13px; }
  .banner { padding: 14px 16px; border: 3px solid var(--ink); margin-bottom: 24px; font-weight: 500; }
  .banner.ok { background: var(--ok); color: #fff; } .banner.bad { background: var(--bad); color: #fff; }
  .row { display: flex; align-items: center; gap: 12px; border: 3px solid var(--ink); padding: 12px 14px; margin-bottom: 12px; box-shadow: 4px 4px 0 var(--ink); }
  .dot { width: 14px; height: 14px; flex: none; background: var(--mid); }
  .dot.up { background: var(--ok); } .dot.down { background: var(--bad); }
  .name { flex: 1; min-width: 0; } .name small { display:block; color: var(--mid); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .meta { text-align: right; font-size: 13px; color: var(--mid); white-space: nowrap; }
  .empty { color: var(--mid); }
</style>
</head>
<body>
<main>
  <h1>heartbeat</h1>
  <div class="sub">service status &middot; refreshes every 15s</div>
  <div id="banner" class="banner">Loading&hellip;</div>
  <div id="list"></div>
</main>
<script>
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function load() {
    const banner = document.getElementById('banner');
    const list = document.getElementById('list');
    try {
      const res = await fetch('/status');
      const items = await res.json();
      const down = items.filter((s) => s.status === 'down').length;
      banner.className = 'banner ' + (down ? 'bad' : 'ok');
      banner.textContent = items.length === 0 ? 'No services registered yet'
        : down ? down + ' of ' + items.length + ' services down' : 'All systems operational';
      list.innerHTML = items.length === 0 ? '<p class="empty">POST /services to add one.</p>' : items.map((s) =>
        '<div class="row"><span class="dot ' + esc(s.status) + '"></span>' +
        '<div class="name">' + esc(s.name) + '<small>' + esc(s.url) + '</small></div>' +
        '<div class="meta">' + (s.uptime24hPercent === null ? 'no data' : s.uptime24hPercent + '% 24h') +
        (s.lastResponseTimeMs === null ? '' : '<br>' + s.lastResponseTimeMs + ' ms') + '</div></div>').join('');
    } catch (e) {
      banner.className = 'banner bad';
      banner.textContent = 'Could not load status';
    }
  }
  load(); setInterval(load, 15000);
</script>
</body>
</html>
`;
