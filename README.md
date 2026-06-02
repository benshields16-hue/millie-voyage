# S/Y Millie — Voyage Planner & Tracker

An offline-first PWA to plan and track a one-to-two-week sailing passage down the
Brittany coast, built for use on a phone/tablet in Safari (and Android/desktop)
**with no mobile signal**. Its core job is honestly computing the timing of the
two tidal "gates" — the **Chenal du Four** and the **Raz de Sein** — off the day's
High Water at Brest.

**Live:** https://benshields16-hue.github.io/millie-voyage/ — open it once on
signal, then "Add to Home Screen" to install. It then runs fully offline.

> ⚠️ **A planning aid, not a navigational authority.** Computed gate windows are
> indicative planning estimates. Always verify against the **Bloc Marine Atlantique
> 2026** almanac and a live **Météo-France** bulletin before committing.

## What it does (offline core — Tier 0)

- **Plan** — 8 legs (Perros-Guirec → Belle-Île) as expandable cards: distance, time
  at 5 kn, key constraint, hazards, marina/VHF, status chips.
- **Tidal-gate calculator** — pick a date; it computes the stream turn, recommended
  arrival at the gate, and departure from the previous port, off the baked SHOM
  HW-Brest table (7–15 Jun 2026). Shows both daily HWs and flags the daylight one.
- **Coefficient timeline** — the neap→spring build, with the gentlest gate days
  starred.
- **Wind go/no-go** — direction + Beaufort → a *hedged* verdict per gate. Firm on
  the no-go ("wind-against-tide — wait"); never a bare "GO".
- **Tracker** — device GPS (foreground, screen-on), bearing + distance to the next
  port, progress derived from position, manual position/leg fallback.
- **Reference drawer** — CROSS Corsen (196 / 112), NAVTEX, Météo-France bulletins,
  almanac of record. Plus a per-leg pre-passage checklist.
- **Day / night** (red-on-black) themes; one honest connection-status pill.
- **Stateless by default**; an opt-in "remember on this device" switch persists
  marked-done legs, notes and the checklist locally (never synced).

## Roadmap (deferred — not yet built)

- **Tier 1 (online):** live Open-Meteo wind/swell; a shared read-only track page
  for family (home PC behind a Cloudflare Tunnel).
- **Tier 2 (on-boat):** Signal K on a Raspberry Pi for the boat's GPS/heading/
  depth/wind, preferred over the phone when aboard. **Before the trip, confirm with
  the boat owner the NMEA-2000 connector type (DeviceNet Micro-C) and a spare
  backbone T-piece** — the one thing that can't be sorted from home.

The connectivity layer is built so each tier degrades silently to the offline core.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173  (Geolocation + SW work on localhost)
npm test         # tide-gate engine unit tests (the worked-example assertion)
npm run build    # -> dist/ (self-contained, offline-cacheable)
```

Stack: Vite + vanilla TypeScript (no framework), `vite-plugin-pwa` (generateSW).
Push to `main` auto-builds, tests, and deploys to GitHub Pages.
