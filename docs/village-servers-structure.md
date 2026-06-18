# Village MikroTik — connected servers & access structure

> Discovered 2026-06-19 (read-only). Nothing on the existing/friend servers was changed.
> **Secrets are NOT stored here.** The shared SSH password is referred to as `<RAMIN_PW>`
> (operator's standard credential). Per-server exceptions are noted.

## 1. Topology overview

```
                         Afrows VPS (94.74.145.199, Iran)
                                   │  wg-afrows (Afrows 10.20.0.1 ↔ village 10.20.0.2)
                                   ▼
                    Village MikroTik hAP ax³  (LAN 192.168.88.1/24)
        WANs: ether1 Mobinnet(192.168.8.x) · ether2/ether5 Irancell · ether4 Starlink(192.168.1.x)
                                   │
        ┌───────────────┬─────────┴─────────┬──────────────┬───────────────┐
   wg-germany      wg-foreign-2         wg-foreign-hz     wg-iran / -2 / -5  (Iran nodes)
   162.19.253.235  85.234.69.185        91.107.172.47     91.243.114.71 / 185.252.31.129 / 185.126.9.184
   FOREIGN EXIT    FOREIGN EXIT         FOREIGN EXIT(down)  (relay/entry, allowed /32)
   (live)          (live)
```

The village is the **hub**: every server is a WireGuard peer of the village. Afrows reaches
the village over `wg-afrows`, and the village forwards Afrows' foreign traffic out one of the
foreign-exit tunnels (currently **Germany**) or out **Starlink directly**.

## 2. How we reach things (access methods)

| Target | Path | Auth |
|---|---|---|
| Village MikroTik REST | From Afrows: `http://10.20.0.2/rest` (over wg-afrows) | user `claude`, pw in DB (vault `mikrotik:village`) |
| Village MikroTik REST (backup) | From Germany box: `http://10.9.0.2/rest` | same |
| Village Winbox | `ssh -N -L 8291:10.9.0.2:8291 root@162.19.253.235` → 127.0.0.1:8291 | — |
| Germany box | `ssh -i ~/.ssh/afrows_germany root@162.19.253.235` (key) **or** password | key + `<RAMIN_PW>` |
| Iran nodes | `ssh root@<ip>` | `<RAMIN_PW>` |

RouterOS REST gotcha on this ax³: full `/ip/firewall/*` and `/ip/route` queries can hang —
use `?.proplist=...` projections. Writes: `POST /rest/{path}/{add|set|remove}` (PATCH/DELETE-by-id are no-ops).

## 3. WireGuard tunnels on the village

| Interface | Listen | Server endpoint | Allowed-IPs | Role | Status |
|---|---|---|---|---|---|
| wg-germany   | 13231 | 162.19.253.235:51820 | 0.0.0.0/0  | Foreign exit (main) | live (hs ~2s) |
| wg-foreign-2 | 13232 | 85.234.69.185:51820  | 0.0.0.0/0  | Foreign exit (Frankfurt) | live (hs ~28s) |
| wg-foreign-hz| 13233 | 91.107.172.47:51830  | 0.0.0.0/0  | Foreign exit (Hetzner) | **DOWN** (never) |
| wg-iran      | 51821 | 91.243.114.71:51821  | 10.10.0.2/32 | Iran node | live |
| wg-iran-2    | 51824 | 185.252.31.129:51824 | 10.13.0.2/32 | Iran node (ether2) | live |
| wg-iran-5    | 51825 | 185.126.9.184:51825  | 10.14.0.2/32 | Iran node (ether5) | live |
| wg-afrows    | 51901 | 94.74.145.199:51900  | 10.20.0.1/32 | **Afrows mgmt + egress** | live |
| *10, *11     | —     | 94.74.145.199:51911/12 | 10.20.1.1, 10.20.2.1 | leftover 3-modem aggregation (ours) | never — cleanup candidate |

Village interface addresses: wg-germany 10.9.0.2 · wg-foreign-2 10.88.0.2 · wg-foreign-hz 10.9.3.2 ·
wg-iran 10.10.0.1 · wg-iran-2 10.13.0.1 · wg-iran-5 10.14.0.1 · wg-afrows 10.20.0.2.

## 4. Server inventory & SSH access (tested 2026-06-19)

| IP | Hostname | Role | SSH with `<RAMIN_PW>` |
|---|---|---|---|
| 162.19.253.235 | vps-d92c8992 | Germany foreign exit | ✅ works (also key `~/.ssh/afrows_germany`) |
| 85.234.69.185  | — | Frankfurt foreign exit | ❌ password rejected — **uses a different credential** |
| 91.107.172.47  | — | Hetzner foreign exit | ⚠️ unreachable (tunnel down / host off) |
| 91.243.114.71  | milad-node-3 | Iran node | ✅ works |
| 185.252.31.129 | 5.hexo | Iran node (ether2) | ✅ works |
| 185.126.9.184  | pishnodecell2 | Iran node (ether5) | ✅ works |

Reachability note: from the **Afrows** IP only 185.252.31.129 answers SSH (Iran→foreign:22 is
filtered for the others); all of the above were reached from the **operator's machine** (which
also reaches Germany on :22).

## 5. How Afrows uses these as exits

**Decision (2026-06-19): use Germany only. Frankfurt + Hetzner are ignored** (their tunnels stay
on the village untouched — friend's config — we just don't route through them).

- **wg-afrows** carries Afrows traffic into the village. The village forwards Afrows' foreign
  destinations to the exit; `via-village` (Afrows xray freedom outbound bound to `wg-village`)
  is the egress used by gaming-tier users and by routers in Game mode.
- **Active exit:** via-village → wg-germany → **162.19.253.235** (Germany, Starlink-carried).
  Also available: **direct Starlink** (village routes wg-afrows foreign → Starlink gw, exit `216.147.121.x`).
- Germany is reachable + manageable (key `~/.ssh/afrows_germany` + password); it's the single
  foreign exit we rely on.
- ~~wg-foreign-2 Frankfurt~~ and ~~wg-foreign-hz Hetzner~~ — **out of scope, not used.**

## 6. Constraints

- **Do not change the existing/friend servers** or their tunnels — additive, scoped changes only.
  (Frankfurt/Hetzner tunnels are left as-is, simply unused.)
- The `*10/*11` village peers are our dead 3-modem-aggregation experiment (safe to remove later).
- Brand is **Afrows**.
