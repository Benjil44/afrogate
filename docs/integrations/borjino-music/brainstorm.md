# Borjino "Music" module + Afrows consumer — architecture brainstorm

Read-only review, 2026-10-15. Every claim about existing code cites a path; Borjino paths are relative to
`D:\Projects\building-management-foundation`, Afrows paths to `D:\Projects\AfroGate`. Nothing was edited.

**Headline recommendation.** Un-park Phase 17 as a *small* "Music" module (`music`) via an owner ADR, build it as
new files only, and make Afrows a **pull-mirror** of one public Borjino channel (server-to-server sync into the
existing `/Podcast/` dir) rather than letting Iranian visitors stream from `app.borjino.com`. The "radio engine"
starts as on-demand playlists (what Afrows already consumes) and becomes a **virtual-live schedule clock** for lobby
channels in Phase B. No Icecast, no HLS, no Redis, no CDN until a measured need.

---

## 1. Module shape, capabilities, roles

Verified: the capability registry is code (`backend/config/capabilities.js`, `<module>.<noun>.<verb>`, explicit
`read_only` flag, `superadmin_assistant = ['platform.read','*:read']`), the module registry is code
(`backend/config/modules.js`; `construction` shows the parked/`default_enabled:false` precedent), and the two gates
are `requireCapability` + `requireModule` (`backend/middleware/requireModule.js:48`; core modules bypass the gate).

| Decision | Recommendation | Alternative (rejected) |
|---|---|---|
| Module key | `music` (`is_core:false`, `entitlement:'music'`, `included_in_plans:['premium','enterprise']` seed, `default_enabled:false` until owner flips). "Radio" is a *feature* of it (channels), not a second module | `radio` as key: too narrow once home/venue playback exists |
| Capabilities | `music.library.view` (ro), `music.library.manage` (DJ: upload/edit own tracks), `music.approve` (reviewer), `music.channels.view` (ro), `music.channels.manage`, `music.lobby.operate` (pick what plays in the lobby), `music.categories.manage` (platform only) | One fat `music.manage`: breaks the DJ/reviewer separation the vision requires |
| Tower DJ | New **building** role `dj` in `ROLE_CAPABILITIES.building` + `BUILDING_MEMBER_ROLES` (`backend/models/BuildingMember.js:40`): `building.view, music.library.view, music.library.manage, music.channels.view, communications.read` | Reuse `facility_operator`: wrong semantics |
| Platform DJ | New **platform** role `platform_dj` in `ROLE_CAPABILITIES.platform` with `music.library.view/manage, music.channels.view` scoped to the *platform library* (tracks with `scope.kind='platform'`, no `building_id`). Needs the platform-role enum on `User.role` extended (touch point, see §7) | Make the platform library a fake "building": bends ADR-0006 rule 3 |
| Tower approval | `manager` gets `music.approve, music.channels.manage, music.lobby.operate, music.categories` (read). The vision's "tower assistant" does not exist as a building role; manager only, say so in the ADR | — |
| Lobby | `lobby_man` gets `music.lobby.operate, music.channels.view` (only switches the active channel among approved building/platform channels; cannot upload) | — |
| Residents | `resident` gets `music.channels.view` (listen). `music.*` views are read-only keys, so the assistant automatically gets preview access via `*:read` | — |

**Assistant read-only vs "assistant approves platform uploads" (needs ADR-0013).** ADR-0006 rule 2
(`memory/decisions/ADR-0006-*.md`) and the `*:read` expansion make the assistant structurally read-only.
Options: (A) only `superadmin` approves platform uploads: zero code risk, but the owner cannot delegate.
(B) **recommended:** an enumerated exception list `ASSISTANT_WRITE_EXCEPTIONS = ['music.approve']` added to the
assistant list in `capabilities.js` with a boot assertion + snapshot test, justified in the ADR as "content
moderation of platform assets: no tenant data, no money, no PII", platform scope only (the route also checks
`scope.kind==='platform'`). (C) a new platform role `platform_curator`; cleanest invariant, but `User.role` is
single-valued so one person cannot be both assistant and curator. Pick B; it is one line, auditable, and the
`rbac-route-auditor` agent can verify it.

## 2. Data model (Mongoose 8, standalone Mongo, no transactions — ADR-0001)

All new collections; nothing added to `Building`/`User` except the role enums.

| Model | Key fields | Notes |
|---|---|---|
| `MusicTrack` | `scope {kind:'platform'|'building', building_id?}`, `uploader_id`, `title, artist, album?, duration_ms`, `category_ids[]`, `original {storage_key, bytes, mime, sha256}`, `renditions[{codec,bitrate_kbps,storage_key,bytes,status}]`, `status`, `review {reviewer_id, decided_at, note}`, `rights {attestation, holder_name, evidence_file_id?, attested_at}`, `history[{from,to,actor_id,at}]` | Index `{scope.building_id, status}`; unique `{scope.kind, scope.building_id, original.sha256}` = upload idempotency + dedupe |
| `MusicCategory` | `key, name{fa,en,ar}, sort, active` | Platform-managed (vision L20); buildings only pick |
| `MusicChannel` | `scope`, `key`, `name{fa,en,ar}`, `visibility:'public'|'members'|'lobby'`, `public_token` (40 hex, like `ExternalTable.qr_code_token`), `mode:'playlist'|'virtual_live'`, `items[{track_id, order}]`, `schedule {epoch_ms, cycle_ms, entries[{track_id,start_ms,duration_ms}]}`, `version` (int), `published_at` | Publishing re-validates that every item is `approved`; bumps `version` (ETag/cache key); schedule derived at publish, so readers never compute from items |
| `MusicLobbyState` | `building_id` (unique), `active_channel_id`, `set_by`, `set_at` | Tiny doc instead of touching the hot `Building` schema |
| `MusicTakedown` | `track_id, requested_by, reason, contact, resolved_at` | Audit trail for §6 |

**State machine** (one service, `musicReviewService.transition(id, from, to, actor)`):
`uploaded → processing → pending_review → approved | rejected`; `approved → retired | takedown`; `rejected → pending_review` (re-submit after edit).
Idempotency without transactions = compare-and-set: `findOneAndUpdate({_id, status: from}, {$set:{status:to}, $push:{history}})`; a null result means "already moved", return the current doc with 200 (not 409) so retries are safe. Same trick claims transcode jobs (`status:'uploaded'` → `processing` with `lease_until`), so two app processes (HA plan warns schedulers run in every process, `docs/deploy/HA_TWO_SERVER_PLAN.md` §0) never double-encode. Money-style `Idempotency-Key` middleware already exists (`backend/routes/charges.js:9`, `middleware/idempotentWrite`) and can wrap upload-create.
**Entitlements:** no new store. `music` resolves through `entitlementService`/`Contract.enabled_features` exactly like `unit_scoring`; platform **public** channels are deliberately *not* entitlement-gated (they are marketing, like the Borjino public TV channel in the IPTV vision).

## 3. "Radio engine" options

| Option | VPS CPU/RAM | Bandwidth | Iran mobile | Lobby sync | Licensing posture | Verdict |
|---|---|---|---|---|---|---|
| (a) On-demand playlists (manifest + files) | ~0 (nginx static) | 1 download per play, Range seeks | Best: `preload=none`, resumable | None (each kiosk independent) | "Interactive" service (user picks/skips) | **Phase A** — Afrows already does this (`apps/web/src/lib/tracks.ts`) |
| (b) Virtual-live schedule clock | ~0 (one JSON per channel) | Same as (a) | Same files; client seeks to `((server_now − epoch) mod cycle)` | ±1 s across rooms (clock from `server_time` in feed + `Date` header); fine for separate lobbies, not for two speakers in one room | Non-interactive, no skip, same stream for everyone: closer to a broadcast | **Phase B** |
| (c) True live (Icecast + Liquidsoap, or ffmpeg → HLS) | 1 core continuous encode per channel, +RAM, one more service to secure/monitor | Continuous per listener | HLS needs many small requests, worse on throttled links; Icecast = long-lived TCP, breaks on NAT churn | Perfect | Broadcast | Defer until a venue needs *live* DJ sets |
| (d) Pre-packaged HLS per track | Batch ffmpeg once | Many segments, cacheable | Segment churn hurts; no benefit over Range on MP3/AAC | Same as (b) | Same as (a)/(b) | Not needed |

Phased path: **A (a) → B (b) → C adds (c) only if live sets are sold.** (b) is the "engine": the server publishes
`{epoch_ms, cycle_ms, entries[]}` once; every client is its own player; zero server state per listener. Gap filler
between tracks: a 1 s silent pad in the schedule. Track changes publish a new `version`; clients poll the feed every
60 s (cache TTL) and re-seek only if the schedule changed.

## 4. Storage and delivery

Verified constraints: documents pipeline is multer-to-disk, `UPLOAD_MAX_BYTES = 10 MB` (`backend/routes/files.js:277`),
no audio MIME in `SIGNED_MIME_TYPES` (`files.js` ~L64), 15–20 min signed URLs (`backend/utils/signedUrl.js`), nginx
live `client_max_body_size 25m` (`deploy/vps/nginx/README.md:30`), off-box backup cap 2 GiB (`docs/deploy/OPS_RUNBOOK.md`
§3.4.6), no ffmpeg anywhere in deploy today (grep empty).

- **Separate root** `/var/lib/borjino/media/` with `originals/` (never served) and `public/<sha256[0:2]>/<sha256>.<ext>`
  (served). Not under `backend/uploads`, so none of `files.js`'s category logic applies.
- **Upload**: dedicated multer instance, cap **60 MB** (a 40-min 128 kbps mix is ~38 MB), MIME sniff of the head
  like `detectUploadContent` (`files.js:377`), MP3/M4A/OGG/FLAC in, size + duration recorded by `ffprobe`. nginx:
  one `location = /api/music/upload { client_max_body_size 80m; proxy_request_buffering off; }` so the global 25m
  stays. Per-DJ daily upload quota and per-library byte quota (platform 20 GB, building 2 GB seeds) enforced in Node.
- **Delivery**: approved renditions are **content-addressed public files served by nginx directly**
  (`location ^~ /media/ { alias ...; expires 30d; add_header Cache-Control public,immutable; limit_rate_after 2m; limit_rate 256k; }`).
  Same reasoning as the avatar precedent in `files.js` ("64 random bits make the name unguessable"); here it is 256
  bits and the object is *meant* to be public. No Node in the data path, Range works, CDN-ready later. Members-only /
  VIP channels (Phase C) switch to `X-Accel-Redirect` from Node after `requireCapability` + a long-TTL (6 h) signed
  URL using a new label in `signedUrl.js` (`borjino-media-url:v1`), never the 15-min file label.
- **Transcode**: ffmpeg installed on the box; an in-process worker (concurrency 1, `nice -n 19`, Mongo CAS claim,
  no Redis). Renditions: `mp3_128` (universal; also the Afrows-compatible one) and `opus_64` (Chrome/Android, half
  the bytes for Iranian mobiles; iOS falls back to mp3). Originals kept for re-encoding; *not* served.
- **Backups**: media is excluded from the 2 GiB off-box dump (it would fill it in one day). Separate `rsync` of
  `originals/` to the standby with its own cap, or owner-accepted "DJs keep their masters". Decision #6.
- **Takedown** removes both renditions and the original and leaves a `MusicTakedown` row; nginx returns 404 for the
  hash thereafter, channels auto-republish without it.

## 5. External consumer contract (Afrows today; home/venue players later)

**Feed** `GET /api/public/music/channels/:token/feed` (anonymous, dedicated limiter like
`backend/middleware/publicOrderingLimiter.js`, `Cache-Control: public, max-age=60`, `ETag: "<version>"`, no cookies,
no user data, same "no error detail echo" rule as `routes/publicOrdering.js:17`):

```json
{ "v": 1, "channel": { "id": "jazz", "name": {"fa":"...","en":"Jazz"}, "mode": "playlist" },
  "server_time": 1760500000000, "version": 12,
  "schedule": null,
  "tracks": [ { "id": "t_9f3a", "title": "...", "artist": "...", "duration_ms": 1800000,
                 "file": "9f3a…c1.mp3", "url": "https://app.borjino.com/media/9f/9f3a…c1.mp3",
                 "opus": "https://app.borjino.com/media/9f/9f3a…c1.opus" } ] }
```

**Afrows compatibility**: `?format=afrows` (or `/tracks.json`) returns the plain array `[{id,title,artist,file}]`
that `parseManifest` already accepts (`apps/web/src/lib/tracks.ts`), with `file` = the rendition basename, so
`VITE_MEDIA_BASE` can point at the media root. No Afrows code change needed for the format.

**Should Afrows visitors stream from `app.borjino.com`? No, not in Phase A.** Reasons, each verifiable:
(1) The ops rule is directional about *hosts* (`docs/deploy/OPS_RUNBOOK.md` §3.4.6: Borjino never uses the Afrows
server; Afrows memory: never jump through the Borjino VPS). A browser fetching public files is not an ops dependency,
so it is *allowed*; it is just a bad idea: (2) it couples afrows.com uptime and an Iranian consumer audience to a
single production building-management VPS (no CDN, SSE/Socket.io on the same Node; `HA_TWO_SERVER_PLAN.md` §0),
(3) Afrows' CSP is `default-src 'self'; connect-src 'self'` with no `media-src` (`infra/ubuntu/nginx.conf.sample:46`)
and the visualizer needs same-origin media (`apps/web/src/lib/player.tsx:171`), so direct consumption means CSP +
CORS changes and a degraded visualizer, (4) privacy: Iranian visitors would leave IP traces on a second origin that
runs an Iran-CIDR geo filter and fail2ban (`HA_TWO_SERVER_PLAN.md` §0 row 7), and (5) Borjino's CORS allowlist is
deliberately narrow (`backend/server.js:186-249`, the `/api/leads` exception is a warning sign in itself).

**Recommended: pull-mirror.** A systemd timer on the Afrows VPS (`afrows-media-sync`, every 10 min) fetches the
feed, downloads new hashes into `/opt/afrows/media/podcast/`, writes `tracks.json` in the existing format, prunes
hashes no longer in the feed (takedown propagates within 10 min), refuses below 2 GB free (reuse the rule from
`scripts/media/sync-mixes.mjs`). Afrows keeps same-origin media, `VITE_TRACKS_URL`/`VITE_MEDIA_BASE` stay unchanged,
Borjino pays bandwidth once per track, and a Borjino outage changes nothing for listeners. CORS on the feed is still
added for `https://afrows.com` (GET only, non-credentialed, like the leads pattern) so option 2 ("direct") remains a
config switch later. Open check: whether the Afrows VPS can reach `app.borjino.com` through that nginx geo filter;
if not, the mirror pulls through the USA path, which is the Afrows default anyway.
Alternative: a dedicated media host (`media.borjino.com` or object storage + ArvanCloud) — Phase C, when resident
listening adds real load.

## 6. Licensing and copyright guardrails (no licences invented)

- Upload requires `rights.attestation ∈ {own_work, written_permission, licensed, public_domain}` + `holder_name` +
  optional evidence document (reuse the 10 MB `documents` pipeline), plus a stored, versioned attestation text the
  DJ ticks. The reviewer UI shows the attestation before the Approve button is enabled.
- Reviewer identity and time are recorded per decision (vision L26 demands it). Per-level queues: platform queue
  (superadmin + assistant via §1-B), building queue (manager).
- Takedown flow: public contact on web-borjino (`/legal/takedown`) → superadmin/manager `POST /api/music/tracks/:id/takedown`
  → files unlinked in the same request → channels republished → mirrors prune on next sync → requester notified.
- Afrows already carries "with the artist's permission" (`infra/ubuntu/media/README.md`); the mirror only ever pulls
  `approved` tracks, so the attestation travels with the content.
- Open legal questions (vision L29) are *owner/counsel* items; the ADR lists them as unresolved and keeps on-demand
  playback behind that answer where the owner wants it.

## 7. Process in Borjino

| Item | Proposal |
|---|---|
| Owner decision record | `memory/decisions/ADR-0013-unpark-phase17-music-module.md`: un-parks Phase 17 *Radio only* (IPTV stays parked), fixes §1 roles, assistant exception (B), public-channel-not-entitled rule, media storage root, mirror-not-stream for Afrows, licensing attestation rule. Updates `docs/agent/ROADMAP.md` L19 + L355 table and `docs/vision/IPTV_RADIO_MODULES.md` status |
| Capability gap (team SKILL §7) | New `.claude/agents/audio-streaming-engineer.md` (+ `.claude/skills/audio-pipeline/SKILL.md`): technique = ffmpeg/ffprobe batch transcode (MP3 128 CBR, Opus 64 VBR, loudness normalisation `loudnorm` to −16 LUFS so lobby volume is stable), Range/`Cache-Control: immutable`, schedule-clock sync maths, HTML5 audio autoplay/unlock rules (the LCD kiosk already solves the gesture gate: `web-borjino/src/pages/LCDPage.jsx:1183-1420`). Failure modes: VBR MP3 duration drift (always `ffprobe` after encode), iOS Opus support gaps, Safari `preload`, clock skew, encoder starving the API (nice + concurrency 1), disk-full on upload |
| OpenSpec | `music-module-foundation` (Phase A), `music-lobby-radio` (B), `music-listening-and-venues` (C). Capability paths: `openspec/specs/music/` (library, review, channels, public-feed) |
| Branches | `feat/music-module-foundation` → `feat/music-lobby-radio` → … (RELEASE_PROCESS: one complete change per branch, Roadmap page updated in the same branch, one version bump as last commit, `--no-ff`) |
| Roadmap page | New item under section `parked` → moved to a new section `music` with `status:'in_progress'` in the Phase A branch; `release` filled at deploy (`frontend/src/pages/superadmin/Roadmap.tsx:2853`) |
| Sequencing vs. the active Core v1 session | Step 1 (docs only, no conflict): ADR + spec + agent + roadmap md. Step 2: wait for the in-flight branch to merge, *then* touch the shared files, which are exactly: `backend/config/modules.js` (+1 entry), `backend/config/capabilities.js` (+7 keys, +`dj`, +`platform_dj`, assistant exception), `backend/models/BuildingMember.js` (+'dj'), `User.role` enum, `backend/server.js` (mount `/api/music`, `/api/public/music`), nginx conf (media + upload locations), frontend `buildMenu`/`RouteGuard` entries. Everything else is new files under `backend/{models,routes,services}/music*`, `frontend/src/pages/{dj,music}/`. Touch points with `modular-entitlements`: only the registry entry; with `organization-foundation`: none in Phase A (platform/building scopes only; org-level channels are Phase C) |

## 8. Phased plan

| Phase | Deliverables | Touched areas | Risks | Acceptance tests |
|---|---|---|---|---|
| **A** (1–2 wk): DJ upload + approval + one public channel + Afrows mirror | Models/state machine; `POST /api/music/tracks` (upload, attestation); review queue + approve/reject; `MusicChannel` playlist mode; public feed (+`?format=afrows`); nginx media root; ffmpeg `mp3_128`; DJ page + review page (fa/en/ar); Afrows `afrows-media-sync` timer | New files + the §7 shared-file list; Afrows: `infra/ubuntu/media/` sync script + systemd unit, README | Shared-file merge conflicts; disk fill; ffmpeg missing on VPS; assistant exception reviewed late | Jest: CAS transition idempotent under parallel calls; building-B DJ gets 403/404 on A's track (ADR-0006 negative test); unapproved track never appears in feed; feed carries no user fields; limiter 429; upload >60 MB rejected; capability snapshot updated. Afrows: sync is idempotent, prunes on takedown, keeps `tracks.json` valid for `parseManifest`, visualizer still same-origin |
| **B** (2 wk): lobby radio on LCD kiosk, virtual-live | `mode:'virtual_live'` schedule publish; `/lcd` kiosk player with unlock gesture, clock sync, auto-recover; `lobby_man` channel picker; `opus_64`; loudness normalisation | `web-borjino/src/pages/LCDPage.jsx` (player component), `MusicLobbyState`, channel publish service | Clock skew; autoplay policy on kiosk browsers; kiosk offline cache | Two kiosks differ <1.5 s after 1 h; picker change propagates ≤60 s; kiosk resumes after network loss; CPU on VPS flat (no per-listener state) |
| **C** (later, after Phase 12 entitlements): resident listening, home players, venues, VIP | Resident app player (members channels via X-Accel + long signed URL); `requireModule('music')` on building channels; org/venue channels (needs organization-foundation); VIP = separate subscription (IPTV vision L14); media host / CDN decision; optional live (c) | Entitlement resolution, org scope, billing | Licensing exposure grows with audience; bandwidth; billing complexity | Entitlement 402 paths; VIP gating; signed media URL expiry; load test 200 concurrent Range streams on nginx |

## 9. Owner decisions needed (recommended default in bold)

1. Un-park Phase 17 **Radio only**, IPTV stays parked; record as ADR-0013. **Yes.**
2. Assistant may approve *platform* uploads via an enumerated exception (`music.approve`) to ADR-0006 rule 2. **Yes (option B)**; else superadmin-only (A).
3. Platform DJ = new platform role `platform_dj` on `User.role`; Tower DJ = building role `dj`. **Yes.**
4. Public platform channels are free and not entitlement-gated; building channels require the paid `music` module (premium/enterprise seed). **Yes.**
5. Afrows consumes via **pull-mirror into its own media dir** (no visitor traffic to app.borjino.com); direct streaming stays a later config switch. **Mirror.**
6. Media backup: originals rsync'd to the standby under a separate cap vs. "DJs keep masters". **Separate rsync, 10 GB cap.**
7. Upload cap 60 MB / platform library 20 GB / building 2 GB seeds. **Accept seeds; adjust later.**
8. Rights attestation mandatory with evidence optional; takedown contact published on web-borjino. **Yes**; counsel question on on-demand vs. broadcast posture stays open and is written down, not guessed.
9. Start now with docs-only Step 1 while Core v1 continues; code after the active branch merges. **Yes.**
