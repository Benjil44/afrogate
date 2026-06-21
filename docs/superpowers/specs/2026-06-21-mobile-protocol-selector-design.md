# Mobile protocol selector with network-aware Auto — design

**Date:** 2026-06-21
**Status:** Approved (brainstorm) → ready for implementation plan

## Problem

The Afrows mobile app runs **WireGuard only** (`wireguard_flutter`). On networks
that block/drop WireGuard's UDP port (e.g. `51822`), the tunnel never handshakes —
the app shows "Connected" but no traffic flows (observed live for customer **Ben**:
TCP 443 API calls reach the server, but zero WG/UDP packets arrive; `wg show`
reports `endpoint=(none)`). Other users on UDP-friendly networks (e.g. **Ramin**)
work fine. The app has no way to fall back to a TCP-based transport, and users
can't see or choose how they connect.

The backend already serves three per-user transports via `/client/subscription`
(`configLinks`): **WireGuard**, **VLESS (WS+TLS, 443)**, **Reality (VLESS+Reality,
443)**. A parked sing-box engine exists in the app (`lib/singbox.dart` — a native
`MethodChannel('afrows/vpn')` VpnService bridge with live up/down byte counters —
plus `android/app/libs/libv2ray.aar`) but is **not wired in**.

## Goals

1. **Show** the protocols available to the logged-in user in the app.
2. Let the user **change** protocol; changing reconnects using the chosen one.
3. **Auto** (default): the system **detects the network and picks** the best
   protocol — WireGuard when its UDP is reachable, else Reality (TCP 443), else
   VLESS-WS. Remembered per network.
4. As a side benefit, surface **live up/down** for the TCP protocols (sing-box
   reports byte counters that WireGuard cannot).

## Non-goals (YAGNI)

- Unifying every protocol onto sing-box (we keep the proven `wireguard_flutter`
  for WG — **dual-engine**).
- Reporting the active protocol to the dashboard for admin visibility (clean
  future add-on; not in v1).
- iOS engine work (Android first; iOS keeps WireGuard until the engine is ported).
- New backend endpoints — `/client/subscription` already returns all configs.

## Key risk / Phase 0

**The VLESS server + config are proven good** — the operator connects with the
same VLESS config from third-party clients (**NPV Tunnel** on Android and a
Windows v2ray/xray client). So the protocol works end-to-end; the only unverified
piece is the **Afrows app's own engine integration** (driving the bundled
`libv2ray.aar`, a v2ray/xray core of the same family NPV Tunnel uses). The prior
in-app attempt (flutter_v2ray) was "broken on-device," so wiring the native
VpnService correctly is the real work.

**Phase 0 of the plan is therefore narrowed**: wire `singbox.dart`/`libv2ray.aar`
into a test build and confirm the **Afrows app itself** establishes a VLESS/Reality
connection on TCP 443 (use the operator's known-good config as the reference;
target Ben's UDP-blocked phone). If the app still can't drive the core, the first
project becomes fixing the native Android engine integration before the protocol
UI — but the server/config are not in question.

## Current-state references

- App engine: `apps/native-client/lib/wireguard_vpn.dart` (`WireguardVpn`,
  status stage-only, no byte counters), used by
  `apps/native-client/lib/connect_screen.dart`.
- Parked engine: `apps/native-client/lib/singbox.dart` (`SingboxVpn`,
  `MethodChannel('afrows/vpn')`, `EventChannel('afrows/vpn/status')`,
  `SingboxStatus` with `uplink/downlink/uplinkTotal/downlinkTotal`), native
  `apps/native-client/android/app/libs/libv2ray.aar` + an Android VpnService
  (to be confirmed/added in Phase 0).
- Config source: `apps/native-client/lib/api.dart` `firstConfigUri` →
  `/client/subscription`. Backend builders:
  `billing.service.ts` `buildNativeWireguardConfigLink` (wireguard),
  `buildNativeEntryConfigLink` (VLESS WS, `format:'vless-uri'`),
  `buildNativeRealityConfigLink` (Reality, `format:'vless-uri'`).
- Connect UI + per-session stats: `connect_screen.dart` (`_pollUsage`, the
  `_StatCard`s, the bypass/gaming toggles with the "Disconnect to change" lock).

## Design

### 1. Protocol model (app)

```dart
enum VpnProtocol { auto, wireguard, reality, vless }
```

The app derives the **available** set from `/client/subscription` `configLinks`:
- a `wireguard` link (configText is a wg-quick conf) → WireGuard available.
- a `vless-uri` link whose `outboundId == 'afrows-reality'` → Reality available.
- a `vless-uri` link whose `outboundId == 'afrows-in'` (WS+TLS) → VLESS available.

`Auto` is always offered and is the **default**. The selector lists `Auto` +
each available concrete protocol. Each protocol carries its config string
(wg conf or `vless://` URI).

### 2. Engine abstraction (dual-engine)

A single interface so `connect_screen` is engine-agnostic:

```dart
abstract class VpnEngine {
  Stream<VpnStatus> status();        // unified status (state + byte counters)
  Future<void> ensureReady();
  Future<bool> start(EngineConfig c);// c carries protocol + config payload
  Future<void> stop();
  Future<bool> isRunning();
}
```

- `WireguardEngine` wraps the existing `WireguardVpn` (`wireguard_flutter`).
  Byte counters stay 0 from the plugin; usage continues to come from the
  server poll (`/client/wireguard-usage`) as today.
- `SingboxEngine` wraps `SingboxVpn` (sing-box). It converts a `vless://` URI
  (Reality or WS+TLS) into a sing-box JSON config and reports **live byte
  counters** from `SingboxStatus`.
- A `VpnController` owns the active engine: on start it picks the engine for the
  chosen protocol; on protocol change it stops the current engine and starts the
  other. Only **one** engine runs at a time.

`VpnStatus` is unified (already shaped in `wireguard_vpn.dart`): `state`,
`uplink`, `downlink`, `uplinkTotal`, `downlinkTotal`, `error`, `log`. The
WireGuard engine leaves counters at 0 (server-metered); the sing-box engine fills
them live.

### 3. Auto = detect network, then pick

A `ProtocolPicker` resolves `Auto` to a concrete protocol **before** connecting:

1. **Probe WireGuard reachability**: open a UDP socket to the WG endpoint
   (`host:51822` from the wg conf), send a WireGuard handshake-initiation, and
   wait ≤3.5s for any response from the server.
   - Response received → **WireGuard**.
   - Timeout/blocked → **Reality** (TCP 443); if Reality fails to establish
     within its own timeout, **VLESS-WS**.
2. **Cache the winner per network**: key by the current network identity
   (Wi-Fi SSID where permitted, else a network hash). Stored in
   `SessionStore`/prefs as `autoChoice[networkKey] = protocol`. Subsequent
   connects on that network skip the probe and use the remembered protocol.
   A manual protocol pick overrides and is also remembered for that network.
3. Only protocols the user actually has are considered (fallback order filtered
   to available ones).

The probe lives in its own unit (`protocol_picker.dart`) and is pure/testable
given an injected "udp probe" + "reality connect-test" function.

### 4. UX (`connect_screen.dart`)

- A **protocol control** below the connect button (segmented or dropdown):
  `Auto · WireGuard · Reality · VLESS` (only available ones; Auto first/default).
- When connected, show the **active concrete** protocol, e.g. the status pill or
  subtitle reads `Connected · Reality` (for Auto, shows what Auto resolved to).
- Changing the protocol while connected follows the existing pattern: it is
  **locked with "Disconnect to change"** OR triggers an explicit reconnect —
  chosen: **lock while connected** (consistent with the bypass/gaming toggles),
  so the user disconnects, picks, reconnects.
- The selected protocol persists in `SessionStore` (last manual choice; default
  `Auto`).
- Live up/down cards: unchanged logic, but now fed by the active engine's
  unified `VpnStatus` — sing-box gives live counters; WireGuard keeps the
  server-metered per-session values.

### 5. Backend

No new endpoints for v1. `/client/subscription` already returns the three
`configLinks`. Two small hardening items:
- Ensure each `configLink` carries a stable, machine-readable `outboundId`
  (`afrows-in`, `afrows-reality`) and `type`/`format` the app can switch on
  (already present: `format:'vless-uri'`, `outboundId`). Confirm in Phase 1.
- Reality/VLESS configs must include everything sing-box needs (sni, fp, pbk/sid
  for Reality, ws path/host for VLESS). Verify the rendered URIs are complete.

## Data flow

```
/client/subscription -> configLinks [wireguard, afrows-in(VLESS), afrows-reality]
  -> app builds available protocols (+ Auto default)
User taps Connect:
  protocol == Auto -> ProtocolPicker:
        cached winner for this network? use it
        else probe WG-UDP(:51822); reachable -> WireGuard; else Reality->VLESS
  VpnController.start(resolvedProtocol, config):
        WireGuard -> WireguardEngine (wireguard_flutter)   [counters via server poll]
        Reality/VLESS -> SingboxEngine (sing-box/libbox)    [live counters]
  status() -> unified VpnStatus -> UI (state pill "Connected · <proto>", up/down)
```

## Testing

- **Phase 0 (device spike):** sing-box connects via Reality and VLESS on 443 on a
  real device (target: Ben's UDP-blocked phone). Gate for everything else.
- **Unit:** `ProtocolPicker` — given (available set, probe result, cache),
  returns the right protocol and fallback order; cache read/write per network.
- **Unit:** subscription → available-protocols mapping (each configLink kind).
- **Unit:** `vless://` → sing-box JSON conversion (Reality vs WS+TLS fields).
- **Manual matrix:** each protocol connects + passes traffic; Auto on a
  UDP-blocked network resolves to Reality; switching protocol reconnects; live
  up/down shows for Reality/VLESS; WireGuard usage still shown.
- `flutter analyze` clean; backend `tsc` clean if any backend touch.

## Rollout

- Ships as a new APK; Auto is default so existing users transparently get
  fallback (Ben's phone auto-selects Reality on his blocked Wi-Fi).
- WireGuard path is unchanged for users where it already works (Ramin).
- iOS unaffected (stays WireGuard) until the engine is ported.
