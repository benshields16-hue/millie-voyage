# S/Y Millie — shared-track backend (Tier 1b)

A tiny, **dependency-free** Node server. The boat's phone (the PWA) POSTs its position here while
online; family open a read-only link to watch the boat on a map. It is **not** part of the PWA's
GitHub Pages build — it runs on the skipper's home PC behind a Cloudflare Tunnel.

> Position sharing for friends & family. **Indicative only — not a navigational authority.**

## Two-token security model

- **INGEST_TOKEN** (write) — entered **once** into the PWA's *Share live position* card (stored in
  that device's localStorage). Authorises `POST /api/ingest`. **Never** baked into the public app or
  this repo. Leaking it would let someone *spoof* the boat — so it's the protected one.
- **VIEW_TOKEN** (read) — embedded only in the family link `https://<host>/t/<VIEW_TOKEN>`.
  Read-only; cannot post or reveal the ingest token. Leaking it only lets someone *watch*.

Generate strong tokens:

```
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

## Run locally

```
cd server
copy .env.example .env      # then edit: set INGEST_TOKEN + VIEW_TOKEN (PowerShell: cp .env.example .env)
npm start                   # → http://localhost:8787   (no npm install needed — built-ins only)
npm test                    # pure-logic tests (node --test): trail trim, fix validation, token compare
```

Drive a fake boat down the route and watch it move:

```
npm run simulate            # posts a fix every 2 s
# open  http://localhost:8787/t/<VIEW_TOKEN>   in a browser
```

## Endpoints

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/ingest` | `Authorization: Bearer <INGEST_TOKEN>` | one fix or `{ "fixes": [...] }` batch (offline backfill) |
| `GET /t/:viewToken` | view token in path | the read-only Leaflet map page |
| `GET /api/t/:viewToken/track` | view token in path | `{ latest, trail, serverTime, retentionHours, route }` (page polls this) |
| `GET /healthz` | none | `{ ok, count, lastFixAgeSec }` for an uptime monitor |

Storage: in-memory trail + an append-only `data/track.ndjson` for crash recovery (rewritten
periodically to drop points older than `RETENTION_HOURS`, default 36 h). No database, no native build.

## Expose it: Cloudflare Tunnel (free, no open ports, home IP hidden)

A **named** tunnel (not a Quick Tunnel — those change URL on every restart) so the family link is stable.

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login                      # browser auth; pick a domain on your Cloudflare account
cloudflared tunnel create millie              # writes <UUID>.json credentials
cloudflared tunnel route dns millie boat.<your-domain>   # → https://boat.<your-domain>
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <UUID>
credentials-file: C:\Users\bensh\.cloudflared\<UUID>.json
ingress:
  - hostname: boat.<your-domain>
    service: http://localhost:8787
  - service: http_status:404
```

Install **both** as auto-starting services so they survive a reboot during the trip:

```powershell
cloudflared service install                   # tunnel as a Windows service
# the Node app: use NSSM (nssm install millie-track "node" "E:\vids\millie-voyage\server\server.mjs")
#               or pm2 + pm2-startup, or a Task Scheduler "At startup" task.
```

- **Base URL** for the PWA share card: `https://boat.<your-domain>`
- **Family link:** `https://boat.<your-domain>/t/<VIEW_TOKEN>`

### Reliability for a week-long unattended run
The home PC is the single point of failure (sleep / Windows-Update reboot / power / ISP). Mitigate:
disable sleep & auto-reboot for the trip window, put the PC + router on a UPS, and point a free uptime
monitor at `/healthz`. This is reassurance for family — **not** a safety channel, and the page says so.

## Access control
Default: the unguessable view-token link (no login — easiest for non-technical family). A forwarded
link is world-viewable. To lock it to named people with **no code change**, put **Cloudflare Access**
(free tier, email allow-list / one-time code) in front of `boat.<your-domain>`.
