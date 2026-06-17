# Afrows mobile — VPN engine swap to sing-box (2026-06-10)

## Why
flutter_v2ray 1.0.10 is broken on the target device (Xiaomi/MIUI, arm64): the
VpnService tun comes up (`tun0 10.0.0.1/8`), the config is correct (verified:
VLESS+WS+TLS, path `/afrowsws`, sni `app.afrows.com`, fp chrome), native libs
are bundled (`libgojni.so` core + `libtun2socks.so` bridge, arm64 + geoip/geosite),
but **no packets forward, no core logs, no crash** → 0 B/s, no internet. Other
VPN apps work untouched on the same phone, so it is flutter_v2ray's runtime
tun2socks/core glue, not the device/network/server.

Server is PROVEN perfect: external `GET https://app.afrows.com/afrowsws` → 400
(reached WS inbound), panel → 200, on-box ws client → Germany. Backend (login,
config delivery, GB metering), the app shell, and diagnostics all work.

## Decision
Replace ONLY the tunnel engine: drop flutter_v2ray; run **sing-box** via its
Android library **`libbox`** behind a native Kotlin `VpnService`. sing-box
manages the tun itself (no fragile external tun2socks), is actively maintained,
and supports VLESS+WS+TLS now and Reality later.

## Phases
1. **Toolchain** — install Go (from `golang.google.cn`), `gomobile` (GOPROXY
   `goproxy.cn`), use existing NDK 28.2.13676358. Filtered-network playbook =
   Chinese mirrors (same as the SDK saga).
2. **Build libbox** — `gomobile bind -target=android -androidapi 21` against
   sing-box `./experimental/libbox` with tags (with_gvisor, with_quic, with_utls,
   with_clash_api off). Output `libbox.aar` → `android/app/libs/`.
3. **Native VpnService (Kotlin)** — `AfrowsVpnService` implementing libbox's
   `PlatformInterface`; start/stop a `BoxService` with a sing-box JSON config;
   foreground notification; expose up/down + status.
4. **MethodChannel** — `afrows/vpn`: start(configJson), stop(), status stream,
   stats. Replace flutter_v2ray calls in `connect_screen.dart`.
5. **Config gen** — convert the VLESS+WS+TLS params into a sing-box outbound +
   `tun` inbound + route. Either build in Dart or have the backend emit a
   sing-box config alongside the vless link.

## Keep
Login, subscription/config delivery, SessionStore, live GB (`/client/me`),
Diag log + DiagScreen, version footer. Server unchanged.

## Risks
- libbox build in a filtered env (mitigate: goproxy.cn, golang.google.cn).
- Kotlin VpnService + PlatformInterface is the bulk of the work; follow sing-box
  SFA (sing-box-for-android) as the reference implementation.
