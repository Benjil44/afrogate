# Borjino music + afrows.com consumer — execution plan (2026-10-15)

Read-only review of both repos; nothing edited. Borjino paths are relative to `D:\Projects\building-management-foundation`,
Afrows paths to `D:\Projects\AfroGate`. Supersedes the "pull-mirror" recommendation of the earlier brainstorm (decision 5):
the owner chose **direct streaming from `media.borjino.com`**, so this plan is built on that.

Facts verified today that shape the plan:

| Fact | Where |
|---|---|
| Borjino VPS `185.252.30.127` is **in Iran**, host nginx, no CDN, Let's Encrypt **webroot HTTP-01** (`/var/www/certbot`), live site file lives only on the VPS (`nginx -T` first, back up, `nginx -t && systemctl reload`, never restart) | `docs/deploy/OPS_RUNBOOK.md:524`, `docs/deploy/HA_TWO_SERVER_PLAN.md:288`, `deploy/vps/nginx/README.md:15-44`, `borjino.com.conf:40-44` |
| DNS for `borjino.com` is at **Liara** (`ns1/ns2.liara.zone`), not Cloudflare | `docs/deploy/OPS_RUNBOOK.md:1753` |
| The "Iran geo filter" is a default-language cookie, not a block; nothing stops foreign or domestic visitors | `deploy/vps/nginx/geo/README.md` |
| nginx L7 limits: zones `borjino_api`, `borjino_auth`, `borjino_conn` at http level; server-level snippet | `deploy/vps/nginx/conf.d/borjino-limits.conf:32-34`, `snippets/borjino-server-limits.conf` |
| Borjino version train: `release/v2.9.196` ready to deploy (`68e9666a`, worktree `D:\Projects\bm-rel-196`); v2.9.194 deployed; foundation checkout sits on `docs/deploy-v2.9.130` (the Lead's integration checkout); 40+ agent worktrees live under `D:\Projects\building-management\.claude\worktrees\` | `git log`, `git worktree list` |
| `release:bump` writes root/backend/frontend `package.json`, `frontend/src/data/releases.json`, `CHANGELOG.md`; refuses an unknown `--sections` id (`SECTION_IDS` in `scripts/bump-version.js:40-58`; no `music` id yet) | `scripts/bump-version.js` |
| Translations are `frontend/src/translations/{fa,en,ar}.json`; agents hand fragments in `docs/refactor/i18n-pending/*.json`, the Lead folds them | team SKILL "Integration rules" |
| Shared-file hotspots: `backend/config/modules.js`, `backend/config/capabilities.js` (assistant = `['platform.read','*:read']` L144), `backend/models/User.js` role enum L264-272, `backend/models/BuildingMember.js` L10-13/40, `backend/server.js` mounts (~L411-422), `frontend/src/config/roleMenus.tsx`, `frontend/src/routes/routeTable.ts`, `routes/legacyRoleDashboard.ts`, `pages/Startup.tsx`, `pages/superadmin/userRoleLabel.ts`, `utils/buildingRoleLabel.ts`, `pages/superadmin/Roadmap.tsx` (Phase 17 items at L2933-2954 in section `parked`) | grep |
| No audio specialist on the roster (27 agents, none audio) | `.claude/agents/` |
| Afrows side: `parseManifest` accepts a JSON array of `{id,title,artist,file}` (ignores unknown keys such as `durationSec`), `MEDIA_BASE` from `VITE_MEDIA_BASE` (default `/Podcast/`), `TRACKS_URL` = `VITE_TRACKS_URL` or `${MEDIA_BASE}tracks.json`; the player already sets `audio.crossOrigin = 'anonymous'` for cross-origin media and builds the analyser on first tap | `apps/web/src/lib/tracks.ts:24-65`, `apps/web/src/lib/player.tsx:168-174` |
| The web build on the Afrows box is `VITE_API_BASE_URL=/api npm run build --workspaces` (production mode, no `envDir` override), so a committed `apps/web/.env.production` is picked up | `infra/ubuntu/update-afrows.sh:51`, `apps/web/vite.config.ts` |
| afrows.com is served through ONE ssh reverse tunnel (Afrows -> us-mgmt socks -> USA over Cloudflare); the Afrows DC drops every foreign packet, only Cloudflare and Iranian IPs pass | `infra/ubuntu/relay/README.md:1-38`, `infra/ubuntu/media/README.md` capacity note |
| Local mixes: `apps/web/public/Podcast/` holds the 5 mp3 + `tracks.json` (ids `dj-rokoshaa-rokoshaa-vibes-1..5`, files `DJ Rokoshaa - RokoshaA Vibes N.mp3`) | `ls` |

---

> **Correction (2026-10-15, from the Borjino Lead):** the Borjino VPS issues TLS with **lego** (`/etc/lego/certificates/<domain>.crt`, per-domain systemd renew timers, webroot `/var/www/html`), not certbot; `/var/www/certbot` does not exist. Phase 0 follows the lego pattern. **Phase A is deferred until after the pilot** (owner decision in the Borjino session); no Borjino worktrees/branches for the music module until then.

## 1. Execution model — recommendation: **split (option 3), with a hard ownership line**

**Verdict.** Phase 0 (ops on the Borjino VPS) goes to the **Borjino session**; the **Afrows-side switch** goes to **this session**;
Phase A (the code) is built by **this session in an isolated Borjino worktree branch**, and **merged, versioned and deployed by the
Borjino Lead** under its own rules. Neither option 1 nor 2 alone works:

- Option 1 (Borjino session does everything) collides with the owner's own priority order (ADR-0012 "core first": Phase 9b Core v1
  until 2026-12). A whole new module inside the Core v1 loop starves the v2.9.19x train and the loop would have to context-switch into
  a domain (audio, CORS media, Range delivery) that its roster does not cover. It also means the Afrows consumer contract is re-derived
  second-hand from a prompt.
- Option 2 (this session does everything) breaks two Borjino invariants: **only the Lead merges, in the main checkout** (team SKILL,
  "One integration checkout"), and the **no-Borjino-VPS rule** of this session (memory `no-borjino`): Phase 0 is VPS work (DNS, certbot,
  nginx, scp) that this session must not perform unless the owner lifts the rule explicitly. The owner's hint ("better you do
  something") is not that lift; it is recorded below as a decision to confirm.

**Why the split is safe.** Phase A is 90 % new files (`backend/{models,routes,services}/music*`, `frontend/src/pages/dj/`,
`openspec/changes/music-module-foundation/`, one ADR, one agent + skill). The shared-file touches are small and enumerated (table
above), so a worktree branch rebased on `origin/main` right before handoff has a bounded conflict surface. The two things that
conflict on *every* Borjino merge (version files and translations) are deliberately **not** touched by the branch: the Lead adds the
bump as the last commit (that is already their rule: "the bump is the last commit on the branch") and folds the i18n fragment.

### Who does what

| Work | Owner | Notes |
|---|---|---|
| DNS `media.borjino.com A 185.252.30.127` (Liara panel, DNS-only, TTL 300) | **Owner** | Nobody else has the Liara login; needed before certbot |
| Confirm the 9 + 2 decisions (section 3, "to confirm") | **Owner** | Reply in `docs/agent/BLOCKERS.md` style (defaults apply if silent, except the VPS-access lift) |
| Phase 0: `ops/media-share-vhost` branch (vhost template + install/revert script + static test), run it on the VPS on the owner's go, certbot cert, scp the 5 mp3 + `tracks.json` from `D:\Projects\AfroGate\apps\web\public\Podcast\` (local disk, readable by both sessions), verify, tag | **Borjino session** | kind `ops`, patch bump in its own train slot; this doc supplies the exact nginx block so no design work is needed |
| Afrows 0.120.1: `apps/web/.env.production`, CORS-fallback in the player, afrows.com CSP, un-pause/remove `/Podcast/`, docs, CHANGELOG, deploy (owner-gated via `/deploy`) | **This session** | Afrows VPN system untouched (section 5) |
| Phase A branch `feat/music-module-foundation` in worktree `D:\Projects\bm-music` (from `origin/main`): ADR-0013 draft, audio agent + skill, OpenSpec change, backend + tests, DJ pages, menu/route entries, Roadmap item, i18n fragment | **This session** | New files first; shared files last; no `release:bump`, no `PROGRESS.md`, no `translations/*.json` edits |
| Phase A review (rbac-route-auditor + security-engineer, because roles change), fold i18n fragment, add `music` to `SECTION_IDS`, bump, `--no-ff` merge in the main checkout, full backend suite at the release checkpoint, deploy on owner go, tag, PROGRESS line | **Borjino Lead** | CHECKLIST "In flight" row added by the Lead when it accepts the handoff |
| Phase A nginx follow-up on the app vhost (`location = /api/music/upload { client_max_body_size 210m; proxy_request_buffering off; }`) | **Borjino session** | Same `deploy/media-share.sh`, step `app-upload` |

### Merge / handoff protocol

1. **Branch**: this session creates `feat/music-module-foundation` from `origin/main` in a *new* worktree (`git worktree add
   D:\Projects\bm-music -b feat/music-module-foundation origin/main`). It never touches `D:\Projects\building-management-foundation`
   or `D:\Projects\building-management` (the Lead's checkouts).
2. **Handoff file**: before asking for review, this session writes `docs/agent/MUSIC_HANDOFF.md` in the branch (scope, files, test
   commands run and their output, what was not verified) and sends the Borjino session one message: branch name, head SHA, handoff path.
3. **Review**: the Lead assigns its reviewers; findings come back as a message or as comments in `MUSIC_HANDOFF.md`; this session fixes
   on the same branch and re-sends the SHA (their "reuse reviewers" rule).
4. **Versions**: the branch carries **no** bump. The Lead runs `npm run release:bump -- minor --title-en "Music module: DJ library and
   public share" --sections music --kinds feature` (MINOR per RELEASE_PROCESS "new user-visible capability"; patch if the Lead prefers
   to stay on the 2.9.x train — Lead's call) as the last commit, on top of the train's current head, so no two bumps race. Phase 0 is a
   separate patch in the Lead's queue, before or after v2.9.196 as it sees fit.
5. **Tests from the worktree**: exactly the recorded commands (team SKILL): `cd D:\Projects\bm-music\backend && npx jest --forceExit
   --modulePaths D:/Projects/building-management/backend/node_modules --testMatch "**/tests/**/music*.test.js"`; frontend via the
   `node_modules` junction, removed afterwards; no `npm ci`.
6. **Deploys**: only the Lead, only from `main`, only on the owner's explicit go; tags as usual. This session never deploys Borjino.

---

## 2. Phase 0 — `media.borjino.com` static public share (stopgap, fastest safe path)

Goal: afrows.com mixes play again within one working session, with zero bytes crossing the Afrows tunnel, no Node in the path,
and nothing on the Borjino app vhost changed.

**Directory layout** (root-owned, world-readable, nginx reads as `www-data`):
```
/srv/borjino-media/
  music/
    public/            # the ONLY served directory
      tracks.json      # 0644, copied from D:\Projects\AfroGate\apps\web\public\Podcast\tracks.json, unchanged
      DJ Rokoshaa - RokoshaA Vibes 1.mp3 ... 5.mp3   # 0644; names kept identical so the Afrows manifest needs no edit
    originals/         # Phase A: DJ masters, never served
```
Phase A later makes the backend user the writer of `music/public/` (group `borjino-media`, dir `2775`) and Node writes `tracks.json`
atomically (temp + `rename`), so the nginx side of Phase 0 is already final.

**nginx** — new file `/etc/nginx/sites-available/media.borjino.com` (+ symlink in `sites-enabled`), template committed as
`deploy/vps/nginx/media.borjino.com.conf`; one new http-level file `conf.d/borjino-media.conf` for the zone and the origin map
(their rule: zones/maps at http level, never inside a server block):

```nginx
# conf.d/borjino-media.conf (http level)
limit_conn_zone $binary_remote_addr zone=borjino_media_conn:10m;
map $http_origin $borjino_media_cors {
    default                  "";
    "https://afrows.com"     $http_origin;
    "https://www.afrows.com" $http_origin;
}

# sites-available/media.borjino.com
server {
    listen 80; listen [::]:80;
    server_name media.borjino.com;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; default_type text/plain; }
    location / { return 301 https://media.borjino.com$request_uri; }
}
server {
    listen 443 ssl http2; listen [::]:443 ssl http2;
    server_name media.borjino.com;
    ssl_certificate     /etc/letsencrypt/live/media.borjino.com/fullchain.pem;   # own cert-name, see TLS below
    ssl_certificate_key /etc/letsencrypt/live/media.borjino.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:borjino_ssl:10m; ssl_session_timeout 1d;

    root /srv/borjino-media;           # /music/<x> -> /srv/borjino-media/music/public/<x> via alias below
    autoindex off;
    server_tokens off;
    access_log off;                    # privacy: Iranian listeners leave no per-request IP trail; error_log stays
    error_log /var/log/nginx/borjino-media.error.log warn;
    client_max_body_size 1k;           # read-only host
    client_header_timeout 10s; send_timeout 60s; keepalive_timeout 15s; reset_timedout_connection on;
    limit_conn borjino_media_conn 6;   # per IP; one listener needs 1-2
    limit_conn_status 429;

    # add_header is NOT inherited into a location that sets its own, so every location includes the same snippet:
    # snippets/borjino-media-headers.conf =
    #   add_header Strict-Transport-Security "max-age=31536000" always;
    #   add_header X-Content-Type-Options nosniff always;
    #   add_header Access-Control-Allow-Origin $borjino_media_cors always;      # empty value = header omitted
    #   add_header Access-Control-Expose-Headers "Accept-Ranges, Content-Length, Content-Range" always;
    #   add_header Vary Origin always;
    #   add_header Cross-Origin-Resource-Policy cross-origin always;

    location = /music/tracks.json {
        alias /srv/borjino-media/music/public/tracks.json;
        default_type application/json;
        add_header Cache-Control "public, max-age=60" always;
        include snippets/borjino-media-headers.conf;
        if ($request_method = OPTIONS) { return 204; }
    }
    location ^~ /music/ {
        alias /srv/borjino-media/music/public/;
        types { audio/mpeg mp3; audio/mp4 m4a; audio/ogg ogg opus; }
        default_type application/octet-stream;
        add_header Cache-Control "public, max-age=2592000, immutable" always;   # 30 d; Phase A names are content-addressed
        include snippets/borjino-media-headers.conf;
        limit_rate_after 3m;           # fast start, then
        limit_rate 256k;               # 256 KB/s (~2 Mbit/s) per connection; the mixes are ~320 kbit/s
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $borjino_media_cors always;
            add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Range" always;
            add_header Access-Control-Max-Age 86400 always;
            return 204;
        }
    }
    location ~ /\. { return 404; }
    location = /robots.txt { return 200 "User-agent: *\nDisallow: /\n"; default_type text/plain; }
    location / { return 404; }
}
```
Notes on the block: Range/206 is nginx default for static files (no `max_ranges` restriction); no credentials are ever allowed
(`Access-Control-Allow-Credentials` is absent on purpose, `credentials: 'omit'` on the Afrows side); `www.afrows.com` is included
because the Afrows landing answers on both names; the OPTIONS branch exists only for safety (browsers send a plain CORS GET with
`Range` for `<audio crossorigin>`); the `if` blocks hold only `add_header`/`return`, which is the one safe use of `if` in a location.
The `limit_conn` and `limit_rate` numbers are first guesses; the Borjino session may tune them after one day of `nginx` connection
counts. **Keep the app vhost untouched** in Phase 0.

**TLS**: `certbot certonly --webroot -w /var/www/certbot -d media.borjino.com` (its own cert-name, so the `borjino.com` certificate
and its renewal are not touched; `--expand` is the alternative if the owner prefers one cert). The :80 block above must be enabled
*before* certbot runs (ACME path), then the :443 block is enabled and `nginx -t && systemctl reload nginx`. `certbot renew --dry-run`
afterwards (their README). Borjino's existing certificates renew via HTTP-01, which proves Let's Encrypt reaches `185.252.30.127:80`
from abroad.

**DNS**: the owner adds `media.borjino.com  A  185.252.30.127` at Liara (TTL 300). **Not proxied**: Borjino has no CDN, and a
Cloudflare-proxied hostname would send Iranian listeners abroad and back, lose `$remote_addr` for the limits (their HA plan §2.4),
and route their IPs through a US company for no benefit. Iranian visitors (the audience) reach an Iranian VPS over the domestic
network; foreign visitors reach it as well as they reach `app.borjino.com` today — the Borjino session should run one
`check-host.net` HTTP probe from 3-4 countries after DNS and report it (open item, see risks).

**Install/revert script** `deploy/media-share.sh install|verify|revert|app-upload` following `deploy/nginx-breach.sh`: backs up,
writes the three files, `nginx -t`, reload; `revert` removes the `sites-enabled` symlink + conf.d file and reloads; `verify` runs the
curl checks below. Static test `deploy/vps/nginx/tests/media-share.test.sh` (same stub pattern as `limits.test.sh`).

**Getting the files there**: the Borjino session runs, from the laptop,
`scp -i ~/.ssh/borjino_vps "D:/Projects/AfroGate/apps/web/public/Podcast/"*.mp3 "D:/Projects/AfroGate/apps/web/public/Podcast/tracks.json" root@185.252.30.127:/srv/borjino-media/music/public/`
(~250 MB; reading that AfroGate folder is local disk, not the Afrows VPS) then `chmod 644`. Do **not** pull from
`https://afrows.com/Podcast/` (paused, and it would cross the Afrows tunnel again).

**Verification (Borjino session reports the output)**:
```
curl -sI https://media.borjino.com/music/tracks.json -H 'Origin: https://afrows.com'           # 200, application/json, ACAO afrows.com, max-age=60
curl -sI -H 'Origin: https://afrows.com' -H 'Range: bytes=0-1' "https://media.borjino.com/music/DJ%20Rokoshaa%20-%20RokoshaA%20Vibes%201.mp3"
                                                                                                  # 206, audio/mpeg, Content-Range, ACAO, Expose-Headers
curl -sI https://media.borjino.com/music/ ; curl -sI https://media.borjino.com/                   # 404, 404 (no listing)
curl -sI -H 'Origin: https://evil.example' https://media.borjino.com/music/tracks.json            # 200 but NO ACAO header
```

**Manifest contract (exact, do not change)**: a JSON array in play order, each item `{"id","title","artist","file"}`; `id` matches
`^[A-Za-z0-9_-]{1,64}$`, `title`/`artist` <= 120 chars text, `file` is a plain filename in the same directory (no `/`, `..`, `:`);
unknown keys (e.g. `durationSec`) are ignored by Afrows, which reads duration from `loadedmetadata`; max 200 items.

**How Phase A writes the same file**: `musicShareService.publishPublicManifest()` selects `MusicTrack.find({ status: 'approved',
shared_public: true, 'scope.kind': 'platform' }).sort({ share_order: 1 })`, hard-links/copies each `mp3_128` rendition into
`music/public/<sha256>.mp3`, writes `tracks.json.tmp` and renames it, and removes public files no longer shared (takedown propagates
within the 60 s manifest TTL; a stale cached URL answers 404 and the Afrows player skips to the next track). The DJ "share" toggle
and the reviewer's approve/reject both call it. No public API endpoint is needed in Phase A; nginx keeps serving the file.

---

## 3. Phase A in Borjino — DJ role, sidebar, library, share

**Decisions to confirm with the owner** (recommended defaults; the branch is built on these unless told otherwise):

| # | Decision | Default |
|---|---|---|
| 1 | Un-park Phase 17 **Radio/Music only** (IPTV stays parked) as ADR-0013, which also amends ADR-0012's "core first" ordering for this one module | Yes |
| 2 | Who approves a *platform* upload: superadmin **and** assistant via an enumerated exception `ASSISTANT_WRITE_EXCEPTIONS = ['music.approve']` (ADR-0006 rule 2) | Yes (option B) |
| 3 | Roles: platform `platform_dj` on `User.role`; building `dj` in `BUILDING_MEMBER_ROLES` | Yes |
| 4 | Public platform share is free, not entitlement-gated; building libraries need the paid `music` module (premium/enterprise seed, `default_enabled:false`) | Yes |
| 5 | Afrows consumes **directly** from `media.borjino.com` (owner decision today; replaces the brainstorm's mirror) | Decided |
| 6 | Media backup: `originals/` rsync'd to the standby under its own 10 GB cap; media excluded from the 2 GiB off-box dump | Yes |
| 7 | Upload cap **200 MB** per file (owner), platform library 20 GB, building 2 GB, per-DJ 1 GB/day | Yes |
| 8 | Rights attestation mandatory on upload (own_work / written_permission / licensed / public_domain + holder name); takedown contact on web-borjino; counsel question on on-demand vs broadcast stays open and written down | Yes |
| 9 | Build Phase A now in a parallel worktree branch (this session) while Core v1 continues; the Lead merges | Yes (section 1) |
| 10 | **Lift the no-Borjino-VPS rule for this session?** Not needed by this plan; if the owner lifts it anyway, it stays limited to reading files/logs for debugging, never deploys | **No** (default) |
| 11 | "Share" semantics: share is a DJ action on an **approved** track only; a reviewer's reject or a takedown auto-unshares; superadmin can unshare anything. Optional friction cut: `platform_dj` uploads by the owner's own account auto-approve | Keep approval; auto-approve **off** |

**What the DJ sees.** New shell `dj` (desktop-first, mobile usable) at `/{lang}/dj/*` for `platform_dj` and building `dj`:
sidebar = Overview (`/dj/dashboard`: counts, last review notes) · My library (`/dj/library`: table with status chip
uploaded/processing/pending_review/approved/rejected/retired, edit title/artist/category, re-submit) · Upload (`/dj/upload`: file +
title/artist + attestation tick + holder name; 200 MB; progress) · Shared publicly (`/dj/shared`: only approved tracks, toggle
"share on afrows.com", drag order = `share_order`, live preview of the resulting manifest) · the standard header (profile, language,
building switcher for building DJs, notifications). Reviewers: superadmin/assistant get "Music review" under the superadmin menu
(`/superadmin/music`: queue, player preview, attestation shown before Approve is enabled, approve/reject with note, unshare/takedown);
managers get the same for their building (`/buildingmanager/music`, Phase A ships the platform queue first, building queue behind the
module flag). Residents/lobby: nothing in Phase A (Phase B).

**Branch `feat/music-module-foundation` — file list in build order** (new files unless marked *shared*):

1. `memory/decisions/ADR-0013-music-module-and-public-share.md` (template `memory/_templates/adr.md`; supersedes nothing, amends
   ADR-0012 ordering for this module); `memory/README.md` index line (*shared*, one line); `docs/vision/IPTV_RADIO_MODULES.md`
   status line; `docs/agent/ROADMAP.md` row 17 + the Phase 17 table row (*shared*, two lines).
2. Capability gap (team SKILL §7): `.claude/agents/audio-streaming-engineer.md` (charter: ffmpeg/ffprobe batch transcode MP3 128 CBR
   + `loudnorm` -16 LUFS, Range/`immutable` delivery, CORS for `<audio crossorigin>`, HTML5 autoplay/unlock, failure modes: VBR
   duration drift, encoder starving the API, disk-full, missing CORS = total playback failure; model `opus`) and
   `.claude/skills/audio-pipeline/SKILL.md` (commands, acceptance checks: `ffprobe` after encode, curl 206 + ACAO check).
3. `openspec/changes/music-module-foundation/{proposal.md,design.md,tasks.md}` + `specs/music/{library,review,public-share}.md`
   (tasks name every file below; `openspec validate` must pass).
4. Backend, new: `backend/models/MusicTrack.js` (fields per brainstorm §2 + `shared_public:boolean`, `share_order:number`; unique
   `{scope.kind, scope.building_id, original.sha256}`), `backend/models/MusicCategory.js`, `backend/models/MusicTakedown.js`,
   `backend/services/musicLibraryService.js` (multer-to-disk instance, 200 MB, head MIME sniff like `detectUploadContent`, sha256,
   ffprobe, CAS `transition()` with `findOneAndUpdate({_id,status:from})`, in-process transcode worker concurrency 1 + `nice`),
   `backend/services/musicShareService.js` (manifest publish, section 2), `backend/routes/music.js`
   (`POST /api/music/tracks` upload, `GET /api/music/tracks?scope=`, `PATCH /:id` allowlisted fields, `POST /:id/submit`,
   `POST /:id/review` approve|reject, `POST /:id/share` {shared:boolean, order}, `POST /:id/takedown`; every route
   `authenticateToken -> requireCapability -> scope check`; `Idempotency-Key` on upload-create via existing `idempotentWrite`),
   tests `backend/tests/music.transition.test.js` (CAS idempotent under parallel calls), `music.rbac.test.js` (building-B DJ gets
   403/404 on A's track; assistant cannot approve a building track; resident 403), `music.share.test.js` (unapproved never reaches
   the manifest; manifest validates against the Afrows shape; takedown removes file + manifest entry), `music.upload.test.js`
   (>200 MB and non-audio rejected, temp files deleted on refusal), capability snapshot update.
5. Backend, *shared* (last, smallest diffs): `backend/config/modules.js` (+`music` entry, `status:'in_progress'`,
   `default_enabled:false`), `backend/config/capabilities.js` (+`music.library.view` ro, `music.library.manage`, `music.approve`,
   `music.share.manage`, `music.categories.manage`; roles `dj`, `platform_dj`; assistant exception with boot assertion),
   `backend/models/User.js` enum (+`platform_dj`), `backend/models/BuildingMember.js` (+`dj`), `backend/server.js`
   (`app.use('/api/music', ...)` after the existing authenticated mounts), `backend/.env.example` (`MUSIC_MEDIA_ROOT`,
   `MUSIC_UPLOAD_MAX_MB=200`, `MUSIC_PUBLIC_MANIFEST=/srv/borjino-media/music/public/tracks.json`).
6. Frontend, new: `frontend/src/pages/dj/{DjDashboard,DjLibrary,DjUpload,DjShared}.tsx`, `frontend/src/pages/superadmin/MusicReview.tsx`,
   `frontend/src/services/music.ts` (apiClient rules: `body.data` unwrapping, `err.message`), `frontend/src/pages/dj/MusicReview.test.tsx`
   (vitest, fa + en render); RTL side panel per AGENTS §5 if any panel is used (no MUI Drawer).
7. Frontend, *shared*: `frontend/src/config/roleMenus.tsx` (+`getTranslatedDjMenuConfig`, + "Music" item in SA and BM menus guarded by
   `music.approve`), `frontend/src/routes/routeTable.ts` (+`dj` shell rows, +SA/BM music rows), `frontend/src/routes/legacyRoleDashboard.ts`
   + `frontend/src/pages/Startup.tsx` (role -> `/dj/dashboard`), `pages/superadmin/userRoleLabel.ts`, `utils/buildingRoleLabel.ts`,
   `pages/superadmin/PlatformRolesCard.tsx` (assign `platform_dj`), `components/BuildingSelectionGuard.tsx` if it lists portals.
   Translations go in `docs/refactor/i18n-pending/music.json` (fa/en/ar, full keys) — **the Lead folds them** into
   `frontend/src/translations/*.json`.
8. Roadmap page (gate 6): `frontend/src/pages/superadmin/Roadmap.tsx` new section `music` (+ item "Music module foundation",
   `status:'in_progress'`, `kind:'feature'`, no `release`; the Phase 17 Radio item in `parked` points to it) and `music` appended to
   `SECTION_IDS` in `scripts/bump-version.js` (*shared*, one line; needed by the Lead's bump).
9. Ops (Borjino session, same release): `deploy/media-share.sh app-upload` adds `location = /api/music/upload` with
   `client_max_body_size 210m; proxy_request_buffering off; proxy_read_timeout 300s;` to the app vhost; `ffmpeg` installed on the box
   (`apt`, Iranian mirror per runbook); `/srv/borjino-media` ownership for the backend user.
10. Gates before handoff (this session runs and records in `docs/agent/MUSIC_HANDOFF.md`): targeted jest, `tsc --noEmit` = 0,
    related vitest, `npm run lint:ratchet` = 0, render check fa + en at 390/1440 for the four DJ pages and the review page. The Lead
    runs the full backend suite alone at its release checkpoint.

---

## 4. Message to send to the Borjino session (send literally)

```
Message from the Afrows session (Claude, D:\Projects\AfroGate) to the Borjino Lead session, 2026-10-15. Owner-approved scope, with
decisions still to confirm by the owner where marked. Please do not let this disrupt your v2.9.196 train beyond what the owner
approves; everything below is additive and lands as your own branches/merges under your rules.

CONTEXT
- The owner decided today: Borjino is THE music system. A DJ role in Borjino manages a music library and picks tracks to share
  publicly; afrows.com (static landing, stays on the Afrows VPS, unchanged VPN system) will only switch its playlist source to
  https://media.borjino.com/music/ . The Afrows mixes are paused right now (nginx 503) because 50 MB streams through the Afrows
  ssh reverse tunnel took the site down, so Phase 0 is time-sensitive.
- A full execution plan with the exact nginx block, CORS/cache/limit values and the Phase A file list is at
  D:\Projects\AfroGate\docs\integrations\borjino-music\execution-plan.md (read sections 2 and 3). The earlier design
  brainstorm is next to it: brainstorm.md.

PHASE 0 (yours; ops only; owner-gated deploy) — media.borjino.com static read-only share
1. Branch ops/media-share-vhost (kind ops, patch bump in your queue). Add deploy/vps/nginx/media.borjino.com.conf,
   conf.d/borjino-media.conf (limit_conn zone + $http_origin map for https://afrows.com and https://www.afrows.com),
   snippets/borjino-media-headers.conf, deploy/media-share.sh install|verify|revert|app-upload (nginx-breach.sh pattern),
   deploy/vps/nginx/tests/media-share.test.sh. Spec: read-only, alias /srv/borjino-media/music/public/, autoindex off,
   Range on (default), tracks.json Cache-Control public,max-age=60, audio 30 d immutable, CORS GET/HEAD only, no credentials,
   Access-Control-Expose-Headers "Accept-Ranges, Content-Length, Content-Range", Vary Origin, limit_conn 6/IP,
   limit_rate_after 3m + limit_rate 256k, access_log off (privacy), location / -> 404. App vhost untouched in Phase 0.
2. On the owner's go, on the VPS: back up, enable the :80 block, certbot certonly --webroot -w /var/www/certbot
   -d media.borjino.com (own cert-name), enable :443, nginx -t && systemctl reload nginx (reload, never restart).
   The owner must first add the DNS record at Liara: media.borjino.com A 185.252.30.127, TTL 300, not proxied.
3. Copy the five files + manifest from the laptop (local disk, no Afrows server involved):
   scp -i ~/.ssh/borjino_vps "D:/Projects/AfroGate/apps/web/public/Podcast/"*.mp3
       "D:/Projects/AfroGate/apps/web/public/Podcast/tracks.json" root@185.252.30.127:/srv/borjino-media/music/public/
   chmod 644. Keep filenames and tracks.json exactly as they are (Afrows manifest contract: JSON array of {id,title,artist,file}).
4. Verify and report: curl -sI with Origin https://afrows.com on /music/tracks.json (200, ACAO) and on one mp3 with Range bytes=0-1
   (206, Content-Range, ACAO, Expose-Headers); /music/ and / return 404; an unknown Origin gets no ACAO. Also one check-host.net
   HTTP probe from 3-4 countries so we know how foreign listeners reach the box.

PHASE A (code) — proposed division, to confirm with the owner
- The Afrows session builds feat/music-module-foundation in a NEW worktree D:\Projects\bm-music from origin/main (new files:
  ADR-0013 draft, .claude/agents/audio-streaming-engineer.md + skills/audio-pipeline, openspec change music-module-foundation,
  backend models/services/routes/tests under music*, frontend pages/dj/*, superadmin MusicReview; shared touches kept to:
  modules.js, capabilities.js (+dj, +platform_dj, assistant exception music.approve), User.js enum, BuildingMember.js, server.js
  mount, roleMenus.tsx, routeTable.ts, Startup/legacyRoleDashboard, role labels, Roadmap.tsx new section `music`, SECTION_IDS).
  It will NOT run release:bump, NOT edit PROGRESS.md, NOT edit frontend/src/translations/*.json (fragment in
  docs/refactor/i18n-pending/music.json for you to fold), and never touches your checkouts.
- You: add the CHECKLIST "In flight" row when you accept, review (rbac-route-auditor + security-engineer: new roles), fold i18n,
  add the bump as the last commit (minor "Music module: DJ library and public share", --sections music --kinds feature, or patch
  if you prefer the 2.9.x train), --no-ff merge in the main checkout, full backend suite at your checkpoint, deploy on the owner's
  go, tag, PROGRESS line. Your Phase A ops piece: deploy/media-share.sh app-upload (location = /api/music/upload,
  client_max_body_size 210m, proxy_request_buffering off), ffmpeg on the box, /srv/borjino-media writable by the backend user.
- Proposed defaults the owner still has to confirm (full list in the plan, section 3): Radio-only un-park as ADR-0013 (amends
  ADR-0012 ordering for this module); assistant may approve platform uploads via an enumerated exception; roles platform_dj (User.role)
  and dj (building); public share free, building libraries behind the paid `music` module; upload cap 200 MB; attestation mandatory;
  share = DJ toggle on approved tracks only, reject/takedown auto-unshares.
- Alternative if you would rather own Phase A yourselves: say so; the plan's file list and spec still apply.

PLEASE SEND BACK (write D:\Projects\building-management-foundation\docs\agent\MUSIC_HANDOFF.md on your branch, or message me)
- Phase 0: branch name, ETA, and after deploy the final URLs (https://media.borjino.com/music/tracks.json + one mp3 URL), the curl
  outputs, the check-host result, and the version/tag it shipped in.
- Phase A: accept/decline the division; the version slot you intend to use; any convention I must follow that is not in AGENTS.md,
  .claude/skills/team/SKILL.md or docs/RELEASE_PROCESS.md; who reviews.
- Anything in the plan that contradicts your live nginx layout (the live site file is not in git; you hold it).
Thank you. Nothing here authorises a deploy; the owner gates every deploy on both sides.
```

---

## 5. Afrows-side changes (this session, after Phase 0 is verified live) — release 0.120.1

| Change | Where | Note |
|---|---|---|
| Media source | new `apps/web/.env.production`: `VITE_MEDIA_BASE=https://media.borjino.com/music/` (public URL, not a secret; committed). `VITE_TRACKS_URL` is derived (`.../music/tracks.json`), so it is left unset | Vite loads `.env.production` in `npm run build`; `update-afrows.sh:51` builds in production mode |
| Cross-origin resilience | `apps/web/src/lib/player.tsx`: on the first `error` event for a cross-origin `src` loaded with `crossOrigin='anonymous'`, retry once with `crossOrigin=null` and skip the analyser (CSS `--beat` fallback). Reason: with `crossOrigin='anonymous'` and a missing/ wrong ACAO header the element does not play at all; the retry keeps music playing if Borjino's CORS ever regresses | ~15 lines; unit test for the retry path |
| Manifest fetch | no change: `loadTracks` already uses `credentials: 'omit'`; `parseManifest` already builds `src` from the base | `apps/web/src/lib/tracks.ts` |
| CSP on afrows.com | live landing server block on the Afrows box (not in git; read with `nginx -T`, back up): add `media-src 'self' https://media.borjino.com; connect-src 'self' https://media.borjino.com` (connect-src for `fetch(tracks.json)`, media-src for `<audio>`); keep everything else | `infra/ubuntu/README.md` / a new `infra/ubuntu/media/README.md` section documents the final header |
| Un-pause and retire the local path | step 1: with the new source live, remove the temporary `return 503` and the `location ^~ /Podcast/` + `location = /Podcast/tracks.json` blocks and the `limit_conn_zone ... afrows_media` line; `nginx -t && reload`. Step 2 (after 7 days of clean playback): delete `/opt/afrows/media/podcast/` | keeps a rollback for a week |
| Repo cleanup | `infra/ubuntu/media/README.md` rewritten: source = `media.borjino.com`, contract, CORS/CSP requirements, no media on the Afrows VPS; `scripts/media/sync-mixes.mjs` deleted (or kept only as a local manifest generator; recommend delete, the DJ UI replaces it); `apps/web/public/Podcast/` stays git-ignored local dev data; `.claude/memory.md` line 302 and `docs/privacy-threat-model.md` note that the landing loads audio from a second origin (Borjino, Iran-hosted, `access_log off` requested) | |
| English "Afro" fix | the uncommitted `apps/web/src/i18n/en.ts` + `fa.ts` changes already in the working tree ("Afro Wave Station", never "Afrooz" in English) ship in the same release | memory line 300 |
| Versioning | `npm run version:patch` -> 0.120.1, `CHANGELOG.md` entry, `npm run version:check`; commit; deploy with the `/deploy` skill on the owner's go; verify `curl -sI https://afrows.com/` CSP header and one playback in the browser (DevTools: media request to `media.borjino.com`, 206, no CORS error, analyser bars moving) | |

**Does any of this touch the Afrows VPN system? No.** Files changed: `apps/web/**`, `infra/ubuntu/media/README.md`, `scripts/media/`,
docs, `CHANGELOG.md`, version files; on the box: only the `afrows.com`/`www` landing server block of nginx. Untouched: xray configs,
WireGuard, `afrows-web-tunnel`/`afrows-de-relay`/`afrows-tg-socks` units (the tunnel simply stops carrying audio), backend, agent,
`app.afrows.com`, `de`/`us` entry hosts, the Afrows memory rule about Borjino (the Afrows VPS makes no connection to Borjino; the
visitor's browser does).

---

## 6. Risks and rollback

| Risk | Impact | Mitigation | Rollback |
|---|---|---|---|
| CORS header missing/wrong on `media.borjino.com` | cross-origin `<audio crossorigin>` fails to play at all | curl verification in Phase 0 before the Afrows switch; player retry without `crossOrigin` (0.120.1) | Afrows: set `VITE_MEDIA_BASE=/Podcast/` back and redeploy; re-enable local block (kept 7 days) |
| Iranian-hosted origin reached poorly from abroad | foreign listeners stall; domestic (the audience) fine | check-host probe in Phase 0; later a Cloudflare-proxied *second* hostname for foreign visitors if needed (never for Iranian ones) | none needed; informational |
| Media traffic hurts the Borjino app | API latency on the shared box | separate vhost, nginx static only, `limit_conn 6`, `limit_rate 256k`, no Node in path; watch `ss`/nginx conns for a day | `deploy/media-share.sh revert` (symlink removed, reload) |
| certbot HTTP-01 fails for the new name | no TLS -> Afrows CSP blocks it | DNS propagated first (TTL 300), :80 ACME block enabled before `certonly`; own cert-name so the app cert is never at risk | leave vhost disabled; nothing else changed |
| `add_header` inheritance drops security/CORS headers in one location | silent header loss | the headers snippet is included in every location; the static test greps for it (same lesson as their proxy-headers test) | fix + reload |
| Privacy: listener IPs on a second origin | human-rights posture | `access_log off` on the media vhost; documented in Afrows privacy model; no cookies, no credentials | owner may re-enable logging temporarily for debugging |
| Phase A merge conflicts (shared files, translations, version files) | rework | branch touches no version/translation files; shared diffs tiny and last; rebase on `origin/main` right before handoff; Lead bumps/folds | drop or re-rebase the branch; `main` never receives a partial feature |
| New roles break RBAC snapshots/tests | CI red | capability snapshot updated in-branch; negative tests for cross-building DJ and assistant-on-building | revert the branch merge (`--no-ff` keeps it one unit) |
| 200 MB uploads block Node / fill disk | API stalls, disk full | `proxy_request_buffering off`, multer to disk, per-DJ daily quota, refuse below 2 GB free, ffmpeg `nice -n 19` concurrency 1 | lower `MUSIC_UPLOAD_MAX_MB`; delete temp dir |
| This session touching the Borjino VPS by mistake | violates the owner's standing rule | the plan gives this session no VPS step; Phase 0/ops are the Borjino session's; decision 10 default "No" | n/a |
| Afrows deploy regressions | landing down | changes are `apps/web` + one nginx block; `/deploy` skill verifies; the tunnel and VPN units are not in the diff | redeploy previous tag; nginx backup copy |
