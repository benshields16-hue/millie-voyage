// Builds the public, read-only track page. The view token is NOT interpolated here —
// the page reads it from its own URL — and the ingest token never appears. `route` is
// the trusted baked context (route-data.json), embedded as JSON for the map's faint
// planned-route layer. Online-only by nature, so Leaflet/OSM come from a CDN.

export function buildPage(route) {
  const routeJson = JSON.stringify(route).replace(/</g, '\\u003c') // defensive vs </script>
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>S/Y Millie — live track</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body{margin:0;height:100%;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0a2540;color:#e7eef5}
  #map{position:absolute;inset:0;height:100%}
  .bar{position:fixed;left:0;right:0;top:0;z-index:1000;display:flex;gap:.6rem;align-items:center;justify-content:space-between;
       padding:calc(.5rem + env(safe-area-inset-top)) .8rem .5rem;background:rgba(10,37,64,.92);border-bottom:1px solid #1d3a57;font-size:.85rem}
  .bar b{font-weight:700}
  .stamp{font-variant-numeric:tabular-nums;white-space:nowrap}
  .stamp--stale{color:#ffb84d}
  .foot{position:fixed;left:0;right:0;bottom:0;z-index:1000;padding:.4rem .8rem calc(.4rem + env(safe-area-inset-bottom));
        font-size:.72rem;background:rgba(10,37,64,.92);border-top:1px solid #1d3a57;color:#9fb3c8;text-align:center}
  .leaflet-container{background:#0a2540}
</style>
</head>
<body>
<div class="bar"><span><b>S/Y Millie</b> — live position</span><span class="stamp" id="stamp">connecting…</span></div>
<div id="map"></div>
<div class="foot">Position sharing for friends &amp; family. Indicative only — not a navigational authority.</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const ROUTE = ${routeJson};
const token = decodeURIComponent((location.pathname.split('/').filter(Boolean).pop()) || '');
const map = L.map('map', { zoomControl: true }).setView([48.25, -4.4], 8);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);

// Planned route (faint context): dashed line through the ports + small markers + gate diamonds.
const ports = ROUTE.ports || [];
if (ports.length > 1) L.polyline(ports.map(p => [p.lat, p.lon]), { color:'#7fa8d0', weight:2, dashArray:'4 6', opacity:.65 }).addTo(map);
for (const p of ports) L.circleMarker([p.lat, p.lon], { radius:3, color:'#7fa8d0', weight:1, fillOpacity:.8 }).addTo(map).bindTooltip(p.name);
for (const g of (ROUTE.gates || [])) L.marker([g.lat, g.lon], { icon: L.divIcon({ className:'gate', html:'<div style="color:#ffb84d;font-size:13px">&#9670;</div>', iconSize:[13,13], iconAnchor:[7,7] }) }).addTo(map).bindTooltip(g.name);

function boatIcon(cog) {
  const html = (typeof cog === 'number')
    ? '<div style="color:#ff5239;font-size:22px;line-height:22px;transform:rotate(' + cog + 'deg)">&#10148;</div>'
    : '<div style="color:#ff5239;font-size:18px;line-height:18px">&#9679;</div>';
  return L.divIcon({ className:'boat', html: html, iconSize:[24,24], iconAnchor:[12,12] });
}
function ago(ms) {
  const s = Math.max(0, Math.round(ms/1000));
  if (s < 60) return s + 's ago';
  const m = Math.round(s/60);
  return m < 60 ? m + ' min ago' : Math.round(m/60) + ' h ago';
}

let boat = null, trail = null, fitted = false;
async function tick() {
  const stamp = document.getElementById('stamp');
  try {
    const res = await fetch('/api/t/' + encodeURIComponent(token) + '/track', { cache:'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    const latest = data.latest;
    if (!latest) { stamp.textContent = 'no position yet'; stamp.className = 'stamp'; return; }
    const pts = (data.trail || []).map(p => [p.lat, p.lon]);
    if (trail) trail.setLatLngs(pts); else trail = L.polyline(pts, { color:'#ff5239', weight:3, opacity:.85 }).addTo(map);
    const ll = [latest.lat, latest.lon];
    if (boat) { boat.setLatLng(ll); boat.setIcon(boatIcon(latest.cog)); }
    else boat = L.marker(ll, { icon: boatIcon(latest.cog) }).addTo(map);
    if (!fitted) { map.fitBounds(L.latLngBounds(pts.length > 1 ? pts : [ll]).pad(0.4)); fitted = true; }
    const age = data.serverTime - latest.ts;
    const stale = age > 10*60*1000;
    stamp.textContent = 'updated ' + new Date(latest.ts).toLocaleTimeString() + ' · ' + ago(age);
    stamp.className = 'stamp' + (stale ? ' stamp--stale' : '');
    const el = boat.getElement(); if (el) el.style.opacity = stale ? '.45' : '1';
  } catch (e) {
    if (stamp) stamp.textContent = 'reconnecting…';
  }
}
tick();
let timer = setInterval(tick, 20000);
document.addEventListener('visibilitychange', () => {
  clearInterval(timer);
  if (document.visibilityState === 'visible') { tick(); timer = setInterval(tick, 20000); }
});
</script>
</body>
</html>`
}
