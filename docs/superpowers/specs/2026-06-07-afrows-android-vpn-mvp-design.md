# Afrows Android VPN App — MVP Design

**Date:** 2026-06-07
**Status:** Approved scope, pre-implementation
**Owner:** operator + Claude

## Goal

A branded **Afrows** Android app whose core loop is: the user taps **Connect**, a real system VPN tunnel comes up through a **VLESS** server, the app shows **"Connected"**, and displays **live upload / download** speed. This proves the end-user app works end-to-end on a real phone.

The VLESS server used for now is one of the operator's existing outbounds (e.g. `r-juuh4sm3` @ `185.252.28.28`) used **purely as a test target** to confirm the app connects and moves traffic.

## Scope (in)

1. **Connect / Disconnect** — one button that brings a real `VpnService` tunnel up/down through xray-core.
2. **Status** — Disconnected → Connecting → Connected (and error state).
3. **Live throughput** — current ↑/↓ speed and session totals, updated ~1s.
4. **Config entry** — the user pastes/saves a `vless://` link in the app (v2rayNG-style import); it is stored locally on the device. No server credentials are committed to git.
5. **Branding + bilingual** — Afrows dark theme, FA/EN (RTL for FA).

## Non-goals (explicitly deferred)

- Quota / data-remaining (e.g. "X of 10 GB") — later, needs the client API.
- Ping / jitter / stability metrics — later.
- Multi-server list, server picker, smart/auto outbound selection (Phase 10) — later.
- Fetching config from the backend / login — later (MVP uses a pasted link).
- The eventual **Mikrotik/Starlink** egress — later.
- iOS — later (Flutter keeps the door open).
- Play Store / Cafe Bazaar publishing — later (MVP = debug APK on a real phone).

## Platform & approach

- **Flutter** (operator already has it) for the app shell + UI.
- VPN tunnel via a **maintained Flutter xray/v2ray plugin** (candidate: `flutter_v2ray`) that bundles xray-core + Android `VpnService` + tun2socks and exposes `connect(config)`, status, and traffic stats. This avoids hand-writing the native tunnel.
- **Plugin verification gate (first task):** confirm the chosen plugin (a) accepts a `vless://` link with our variant (tcp + `headerType=http` + `host`), (b) emits up/down stats, (c) supports the installed Flutter/Android versions. **Fallback** if it falls short: a thin native **Kotlin** `VpnService` + `AndroidLibXrayLite` AAR exposed to Flutter over a `MethodChannel`/`EventChannel`. The UI layer stays identical either way.

## Architecture / units

```
apps/native-client/                      # Flutter project root (new)
  lib/
    main.dart                            # app bootstrap, theme, locale
    vpn/
      vpn_controller.dart                # state: status + up/down; calls the plugin
      vpn_config.dart                    # parse/hold a vless:// link; persist locally
      vpn_service.dart                   # thin wrapper over the v2ray plugin (or native channel)
    ui/
      connect_screen.dart                # the one screen: button + status + speeds
      widgets/...                        # speed gauge, status pill, config sheet
    i18n/                                # FA/EN strings (RTL aware)
  android/                               # native config; plugin pulls xray AAR
  pubspec.yaml                           # flutter_v2ray (or chosen plugin) + deps
```

- **`vpn_service.dart`** — the only unit that touches the plugin/native layer. Interface: `Future<void> connect(VpnConfig)`, `Future<void> disconnect()`, `Stream<VpnStatus> status$`, `Stream<Throughput> throughput$`. Swappable (plugin ↔ native channel) without touching UI.
- **`vpn_controller.dart`** — holds app state, subscribes to the service streams, exposes to the UI. Unit-testable with a fake service.
- **`vpn_config.dart`** — parse a `vless://` link → typed config; persist to local storage (`shared_preferences`); never bundled in git.
- **`connect_screen.dart`** — Connect/Disconnect button, status pill, live ↑/↓ + totals, "paste config" sheet, language toggle.

## Data flow

1. First launch: no config → prompt user to paste a `vless://` link → saved locally.
2. Tap **Connect** → `vpn_controller` → `vpn_service.connect(config)` → plugin asks for the Android VPN permission (system dialog, first time) → tunnel up.
3. `status$` emits Connecting → Connected; UI reflects it.
4. `throughput$` emits ↑/↓ each ~1s while connected; UI shows live speed + running totals.
5. Tap **Disconnect** → tunnel down → status Disconnected, speeds reset.

## Error handling

- **No config saved** → Connect is disabled with a hint to add a config.
- **VPN permission denied** → show a clear "VPN permission needed" message + retry.
- **Connect failure / handshake timeout** → status = Error with a short reason; offer retry. (Reachability of the test server from the phone's network is a real variable — see risks.)
- **Background/locked** → tunnel persists via the plugin's foreground service; status restored on resume.

## Testing strategy

- **Unit:** `vpn_config.dart` parsing (`vless://` → fields, round-trip) with Dart tests; `vpn_controller` state transitions against a **fake** `vpn_service`.
- **Manual on a real phone** (emulator can't validate `VpnService`): paste the test VLESS link → Connect → confirm "Connected" + up/down move while browsing → Disconnect. This is the acceptance test.

## Toolchain / build (operator side)

- Flutter SDK (installed). Android SDK + platform-tools required — install Android Studio just for the SDK + `adb` (code can live in Cursor/VS Code). `flutter doctor` must be all-green for Android.
- Run on a USB-connected phone with USB debugging: `flutter run`. Ship a test build with `flutter build apk --debug` → `adb install`.

## Security

- No VLESS credentials / UUIDs committed to git — the config lives only on the device (pasted by the user, stored in `shared_preferences`). Keep `apps/native-client` clear of any real config in source. Aligns with the standing never-commit-secrets rule.

## Risks / open items

- **Plugin fit** — biggest unknown; resolved by the verification gate (task 1) with the native-channel fallback.
- **Test-server reachability from the phone's network** — the VLESS test target must be reachable from where the phone is (vantage-dependent, as seen with the outbounds); pick a server known-reachable from the test phone (`r-juuh4sm3`/`highspeed`, not `benjil`).
- **Stats granularity** — exact up/down API depends on the plugin; if it only gives totals we derive speed by delta over time.

## Acceptance criteria

On a real phone: paste the test `vless://` link → tap **Connect** → status shows **Connected** within a few seconds → **upload and download numbers update live** while browsing → tap **Disconnect** → returns to Disconnected. Nothing in git contains a real VLESS credential.
