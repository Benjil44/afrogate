# Landing media (music deck)

The afrows.com music deck streams full DJ mixes (DJ Rokoshaa — "RokoshaA Vibes 1–5",
streamed with the artist's permission). They are large (~50 MB each), so they are
**not in git** (`apps/web/public/Podcast/` is git-ignored) and are **not** part of the
deploy tarball. They are placed on the VPS by hand.

| Item | Value |
|---|---|
| Files on the VPS | `/opt/afrows/media/podcast/*.mp3` (owner `afrows`, mode 644) |
| Public URL | `https://afrows.com/Podcast/<url-encoded filename>` |
| Local dev copy | `apps/web/public/Podcast/` (Vite serves it at the same path) |
| Frontend base | `VITE_MEDIA_BASE` (defaults to `/Podcast/`) |

## nginx

Inside the `server_name afrows.com www.afrows.com;` block, before `location /`:

```nginx
location ^~ /Podcast/ {
    alias /opt/afrows/media/podcast/;
    types { audio/mpeg mp3; }
    default_type application/octet-stream;
    autoindex off;
    expires 30d;
    limit_conn afrows_media 3;   # max 3 streams in total (all clients arrive as 127.0.0.1 via the tunnel)
    limit_conn_status 503;
    limit_rate_after 1m;         # fast start
    limit_rate 64k;              # then ~512 kbit/s per stream (mixes are ~320 kbit/s)
}
# plus, at the top of the site file (http level):
# limit_conn_zone $server_name zone=afrows_media:1m;
```

Range requests work out of the box (seeking returns `206`). No `add_header` in this
block, so the server-level security headers (HSTS, CSP, nosniff) still apply.

## Deck manifest (`tracks.json`)

The landing reads its playlist at runtime from `/Podcast/tracks.json` (no rebuild needed):

```json
[{ "id": "dj-rokoshaa-rokoshaa-vibes-1", "title": "RokoshaA Vibes 1", "artist": "DJ Rokoshaa", "file": "DJ Rokoshaa - RokoshaA Vibes 1.mp3" }]
```

`file` is a plain name inside the media base (no `/`, `..` or `:`); every field is treated as untrusted text.
nginx serves it with a 60 s cache (`location = /Podcast/tracks.json`, before the `/Podcast/` block). This is
also the contract for the parent app's DJ manager: once it serves the same format, point the landing at it with
`VITE_TRACKS_URL` / `VITE_MEDIA_BASE` (cross-origin audio needs CORS for the visualizer).

## Add, rename or remove mixes

Put the files in `apps/web/public/Podcast/` (the folder is the playlist: natural filename order,
`Artist - Title.mp3` naming), then:

```bash
node scripts/media/sync-mixes.mjs --dry-run   # what would change
node scripts/media/sync-mixes.mjs             # upload new/changed files + publish tracks.json
node scripts/media/sync-mixes.mjs --prune     # also delete VPS mixes no longer in the folder
```

It uses the SSH target from `scripts/deploy/deploy.env`, uploads under a temp name and renames on the box,
and refuses if the VPS would keep less than 2 GB free. Live within ~60 s.

## Capacity note

afrows.com reaches visitors through ONE ssh reverse tunnel (`afrows-web-tunnel`, Afrows -> xray us-mgmt socks ->
USA over Cloudflare). Every page request and every mix stream share that single TCP stream, so a few full-speed
mix downloads can stall page requests (2026-10-15: ~294 MB of mixes in 2 h, tunnel hung, Cloudflare 502). Hence
the global 3-stream / 64 KB/s cap above. If listening grows, serve media from a separate host/path instead of
through the tunnel.
