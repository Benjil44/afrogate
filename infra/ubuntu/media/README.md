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
    limit_rate_after 2m;   # fast start
    limit_rate 256k;       # then ~2 Mbit/s per connection, protects the web tunnel
}
```

Range requests work out of the box (seeking returns `206`). No `add_header` in this
block, so the server-level security headers (HSTS, CSP, nosniff) still apply.

## Add or replace a mix

```bash
scp "new mix.mp3" afrows-vps-direct:/opt/afrows/media/podcast/
ssh afrows-vps-direct 'chown afrows:afrows /opt/afrows/media/podcast/*.mp3 && chmod 644 /opt/afrows/media/podcast/*.mp3'
```

Then add the track to `apps/web/src/lib/tracks.ts` and deploy the site.

## Capacity note

afrows.com reaches visitors through the USA reverse tunnel (`afrows-web-tunnel`), so
every stream crosses it. If listening grows, move media to a separate host/path.
