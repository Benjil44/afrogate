# Landing media (music deck) — RETIRED on the Afrows VPS

Since 0.120.1 (2026-10-15) the afrows.com music deck streams from the **Borjino public music share**:

| Item | Value |
|---|---|
| Manifest | `https://media.borjino.com/music/tracks.json` (JSON array of `{id,title,artist,file}`, optional `durationSec`) |
| Audio | `https://media.borjino.com/music/<url-encoded file>` (CORS for `https://afrows.com` and `https://www.afrows.com` only) |
| Owner | the Borjino app/ops (repo `Benjil44/borjino`, `deploy/media-share.sh`, OPS_RUNBOOK §15). Its DJ role will manage the library later. |
| Afrows side | `apps/web/src/lib/tracks.ts` (default base, `VITE_MEDIA_BASE` / `VITE_TRACKS_URL` override); afrows.com CSP has `connect-src` / `media-src https://media.borjino.com` |

**Why it moved:** afrows.com reaches visitors through ONE ssh reverse tunnel (`afrows-web-tunnel`, Afrows -> xray
us-mgmt socks -> USA over Cloudflare). Streaming 50 MB mixes through it hung the tunnel and afrows.com returned
Cloudflare 502 (2026-10-15, twice). **Never serve media through the web tunnel again.**

**What was removed:** `/opt/afrows/media/podcast/` (deleted), the nginx `location = /Podcast/tracks.json` block, the
`limit_conn_zone ... afrows_media` line, and the `/Podcast/` streaming block, now just
`location ^~ /Podcast/ { return 410; }` (backups `/root/nginx-afrows.bak-podcast-retire-*`). Old copies may linger in
the Cloudflare edge cache until they expire (purge in Cloudflare if needed).

**Local dev:** keep test mixes + `tracks.json` in `apps/web/public/Podcast/` (git-ignored) and set
`VITE_MEDIA_BASE=/Podcast/` in `apps/web/.env.development.local` (the Borjino share only allows the afrows.com origins).
`node scripts/media/sync-mixes.mjs --local-only` rebuilds that local manifest; its upload mode targeted the retired
Afrows path and must not be used.
