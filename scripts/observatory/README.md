# Afrows path observatory

A lightweight, continuous, per-hop path monitor, built so every "sometimes works,
sometimes doesn't" outage can be pinned on one hop:

    customer -> Iran server (afrows-xray) -> SS-2022 :8447 -> USA exit (xray) -> internet

Every 60 s a systemd oneshot (`afrows-observatory.timer`) runs
`afrows-observatory-probe.py`. It runs all probes in parallel with bounded timeouts
(a cycle finishes in roughly 5-20 s and costs about 1.3 CPU-seconds on the 1-vCPU
Iran server, about 2% average CPU, mostly curl TLS handshakes; about 0.3 s on the USA;
memory is capped at 96M by the unit) and appends one JSON line per
probe to `/var/log/afrows-observatory/probe.jsonl`:

    {"ts":"2026-10-28T12:00:05Z","vantage":"iran","probe":"chain.google204","ok":true,"ms":690,"detail":"http=204 rc=0 ..."}

The file rotates to `probe.jsonl.1` at about 20 MB (`OBS_MAX_BYTES`), so it never
holds more than about 40 MB in total (at ~2 KB per minute per host, that is weeks of
history). The probe is additive and read-only: it opens no listeners and changes no
config. It only dials out, through the existing loopback socks ports, and reads
`egress-health.json`.

| vantage | probe | what it isolates |
|---|---|---|
| iran | `chain.google204`, `chain.youtube`, `chain.telegram` | the customer path: socks 10812 -> via-germany (SS) -> USA -> site |
| iran | `chain.ip_literal` | the same chain to `https://1.1.1.1`, so the USA exit needs no DNS (splits USA DNS from USA egress) |
| iran | `chain.dl1m` | a 1 MiB ranged download through the chain, every `OBS_DL_EVERY` (5) minutes; reports Mbps |
| iran | `usasocks.google204` | socks 1083 -> via-usa (SS); also the Telegram/mgmt path |
| iran | `direct.google204`, `direct.aparat` | the Iran server's own foreign and domestic internet |
| iran | `tcp.usa8447`, `ping.usa` | raw TCP/ICMP reachability of the USA exit IP and port |
| iran | `state.catchall`, `state.xraypid` | informational: the renderer's applied catch-all, and afrows-xray restarts |
| usa | `ping.iran`, `tcp.iran443`, `tls.iran_sni` | return path USA -> Iran (TLS with SNI app.afrows.com) |
| usa | `cf.app` | https://app.afrows.com/ through Cloudflare |
| usa | `direct.google204`, `tcp.1111`, `dns.8844`, `dns.system` | the USA exit's own egress, by IP literal, by raw DNS to 8.8.4.4, and through the system resolver |

## Install / update (on each host, as root)

    scp scripts/observatory/{afrows-observatory-probe.py,afrows-observatory.service,afrows-observatory.timer,install.sh} HOST:/root/afrows-observatory-src/
    ssh HOST 'bash /root/afrows-observatory-src/install.sh iran'   # or: usa

`install.sh` is idempotent. It installs to `/usr/local/lib/afrows-observatory/`, writes
`OBS_VANTAGE` to `/etc/default/afrows-observatory`, enables the timer, and runs one
smoke-test cycle. Optional overrides go in the same env file: `OBS_DL_EVERY`,
`OBS_MAX_BYTES`, `OBS_CHAIN_SOCKS`, `OBS_USA_SOCKS`, `OBS_USA_IP`, `OBS_IRAN_IP`.

## Stop / remove

    systemctl disable --now afrows-observatory.timer          # stop probing (keeps data)
    rm -rf /usr/local/lib/afrows-observatory /etc/default/afrows-observatory \
           /etc/systemd/system/afrows-observatory.{service,timer} && systemctl daemon-reload
    rm -rf /var/log/afrows-observatory                        # drop the data too

## Analyse

    bash scripts/observatory/collect.sh /tmp/obs              # pulls both JSONL files, the renderer journal and the router afr-watch log
    python3 scripts/observatory/analyze.py iran.jsonl usa.jsonl \
        [--renderer-log renderer.txt] [--router-log router.txt --router-date YYYY-MM-DD] [--since ...]

`analyze.py` (stdlib only) prints:

- the success rate and p50/p95 latency for each probe;
- catch-all flips and afrows-xray restarts;
- each failure episode (consecutive failing minutes), listing which probes failed
  together, any router or state events nearby, and a verdict.

Verdicts, highest-priority hop first:

| what failed | verdict |
|---|---|
| direct Iranian site + direct foreign | Iran server / DC network |
| direct foreign + USA ping/TCP | DC international link |
| USA ping/TCP only | IP block or DPI on the USA IP; if only TCP 8447 fails, the SS port |
| USA -> Iran probes | return path |
| USA dns.* | USA DNS |
| USA tcp.1111 + google | USA egress |
| chain domains fail but chain.ip_literal works | name resolution at the USA exit |
| chain + via-usa, with raw TCP/ICMP fine | flow-level DPI on the SS stream, or the USA xray |
| only the heavier chain fetches | partial / slow chain |

The renderer journal (`afrows-egress-mode-sync`) is summarised as via-germany DOWN
runs, with the minute at which the catch-all flipped to `direct`.
