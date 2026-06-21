# Mobile protocol selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app show the user's available transports (Auto / WireGuard / Reality / VLESS), switch between them, and have **Auto** detect the network and pick the best — so UDP-blocked users (e.g. Ben) auto-fall to Reality/VLESS over TCP 443.

**Architecture:** Dual-engine behind one `VpnEngine` interface — keep `wireguard_flutter` for WireGuard, add the **`flutter_v2ray`** plugin (xray core) for Reality/VLESS. `flutter_v2ray` ships the native Android VpnService + live up/down counters, and the repo's `libv2ray.aar` already came from it. A `ProtocolPicker` resolves Auto by probing whether the server is reachable over UDP (server-side UDP echo), caching the winner per network.

**Tech Stack:** Flutter (Dart), `wireguard_flutter`, `flutter_v2ray` (xray), NestJS backend (unchanged except a tiny UDP-echo probe responder), systemd.

**Spec:** `docs/superpowers/specs/2026-06-21-mobile-protocol-selector-design.md`

---

## ⚠️ ENGINE DECISION (refines the spec)

The spec said "sing-box". The repo reality: native side is empty (`MainActivity` = bare `FlutterActivity`, no `afrows/vpn` channel), `singbox.dart` targets sing-box but the bundled `libv2ray.aar` is **xray** (from `flutter_v2ray`), and the operator's proven-working clients (NPV Tunnel, Windows) are **xray**. So this plan uses the **`flutter_v2ray` plugin (xray)** for VLESS/Reality instead of a hand-written sing-box service. `singbox.dart` is retired. Confirm this on plan review.

## Current-state references

- `apps/native-client/pubspec.yaml` — deps (`wireguard_flutter: ^0.1.3`); add `flutter_v2ray`.
- `apps/native-client/lib/wireguard_vpn.dart` — `WireguardVpn`, `VpnStatus` (state + uplink/downlink/totals), `parseWgConf`.
- `apps/native-client/lib/connect_screen.dart` — connect UI, `_pollUsage`, `_StatCard`s, `_BypassToggle`/`_GamingToggle` ("Disconnect to change" lock pattern), `app_version`.
- `apps/native-client/lib/api.dart` — `firstConfigUri` (returns one config); we add `fetchSubscriptionLinks`. `AccountSession`, `SessionStore` in `vpn_config.dart`.
- `apps/native-client/lib/singbox.dart` — **delete** (replaced by flutter_v2ray).
- Backend `/client/subscription` `configLinks[]`: each has `outboundId` (`afrows-in`=VLESS-WS, `afrows-reality`=Reality, wireguard link carries `configText`), `format` (`vless-uri` or wireguard), `uri`, `configText`.
- `apps/native-client/android/app/build.gradle.kts` — `flatDir { dirs("libs") }` (the stray `libv2ray.aar` becomes unnecessary once the plugin is added — remove the manual aar to avoid a duplicate class clash).

**Conventions:** Flutter commands use the China pub mirror — prefix `PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`. Flutter at `/d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter`. Commit after each task. Branch off `main`.

---

## File Structure

- Modify: `pubspec.yaml` (+`flutter_v2ray`), `android/app/build.gradle.kts` (drop stray aar), `android/app/src/main/AndroidManifest.xml` (v2ray service perms if the plugin needs them).
- Create: `lib/vpn/vpn_protocol.dart` — `VpnProtocol` enum + `ProtocolConfig` + subscription→available mapping.
- Create: `lib/vpn/vpn_engine.dart` — `VpnEngine` interface + unified `EngineStatus`.
- Create: `lib/vpn/wireguard_engine.dart` — wraps `WireguardVpn`.
- Create: `lib/vpn/v2ray_engine.dart` — wraps `flutter_v2ray`.
- Create: `lib/vpn/vpn_controller.dart` — owns the active engine, switches.
- Create: `lib/vpn/protocol_picker.dart` — Auto resolution (UDP probe + per-network cache).
- Modify: `lib/api.dart` — `fetchSubscriptionLinks`.
- Modify: `lib/connect_screen.dart` — selector UI, controller wiring, stats from active engine.
- Delete: `lib/singbox.dart`.
- Create tests: `test/vpn_protocol_test.dart`, `test/protocol_picker_test.dart`, `test/vless_parse_test.dart`.
- Backend: Create `scripts/afrows-udp-echo.py` + `infra` systemd unit notes for the Auto UDP probe.

---

## Task 0: Phase 0 spike — prove flutter_v2ray connects on a device (GATE)

**Files:**
- Modify: `apps/native-client/pubspec.yaml`
- Modify: `apps/native-client/android/app/build.gradle.kts`
- Temp: a throwaway button in `connect_screen.dart` (reverted after)

- [ ] **Step 1: Add the plugin**

In `pubspec.yaml` under dependencies (after `wireguard_flutter: ^0.1.3`):

```yaml
  flutter_v2ray: ^1.1.7
```

- [ ] **Step 2: Remove the stray manual aar to avoid duplicate xray classes**

In `android/app/build.gradle.kts`, delete the `flatDir { dirs("libs") }` block (lines ~44-45) and delete `android/app/libs/libv2ray.aar` (the plugin brings its own).

```bash
rm -f apps/native-client/android/app/libs/libv2ray.aar
```

- [ ] **Step 3: pub get**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter pub get`
Expected: resolves, `flutter_v2ray` added.

- [ ] **Step 4: Add a temporary "Test VLESS" path**

Temporarily, in `connect_screen.dart` `initState`/a debug button, hardcode the operator's known-good VLESS Reality URI (fetch it from the dashboard `/client/subscription` for Ben, `outboundId=afrows-reality`) and run:

```dart
import 'package:flutter_v2ray/flutter_v2ray.dart';
// ...
final v2 = FlutterV2ray(onStatusChanged: (s) => Diag.I.log('v2ray ${s.state} up=${s.uploadSpeed} down=${s.downloadSpeed}'));
await v2.initializeV2Ray();
final parser = FlutterV2ray.parseFromURL('<BEN_REALITY_VLESS_URI>');
if (await v2.requestPermission()) {
  await v2.startV2Ray(remark: parser.remark, config: parser.getFullConfiguration(), proxyOnly: false);
}
```

- [ ] **Step 5: Build + install on Ben's UDP-blocked phone, connect, verify traffic**

```bash
cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter build apk --release
```
Install, tap test, then on the phone open a website. Expected: browsing works (Reality/443 passes where WG/UDP failed), and the diag log shows `v2ray CONNECTED up=… down=…`.

- [ ] **Step 6: GATE decision**

- Connects + traffic flows → **proceed to Task 1**. Revert the temporary test button.
- Does NOT connect → **STOP**. The native xray integration needs fixing first; report findings and re-scope. Do not continue the UI tasks on a broken engine.

- [ ] **Step 7: Commit (only the dep wiring; revert the temp button)**

```bash
git add apps/native-client/pubspec.yaml apps/native-client/pubspec.lock apps/native-client/android/app/build.gradle.kts
git commit -m "feat(app): add flutter_v2ray (xray) engine dependency [phase0 verified]"
```

---

## Task 1: Protocol model + subscription mapping

**Files:**
- Create: `apps/native-client/lib/vpn/vpn_protocol.dart`
- Modify: `apps/native-client/lib/api.dart`
- Test: `apps/native-client/test/vpn_protocol_test.dart`

- [ ] **Step 1: Write the failing test** (`test/vpn_protocol_test.dart`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:afrows_vpn/vpn/vpn_protocol.dart';

void main() {
  test('maps subscription links to available protocols', () {
    final links = [
      {'outboundId': 'afrows-wireguard', 'configText': '[Interface]\nPrivateKey=x\n[Peer]\nEndpoint=h:51822\nAllowedIPs=0.0.0.0/0'},
      {'outboundId': 'afrows-in', 'format': 'vless-uri', 'uri': 'vless://u@h:443?type=ws&security=tls#A'},
      {'outboundId': 'afrows-reality', 'format': 'vless-uri', 'uri': 'vless://u@h:443?security=reality#R'},
    ];
    final avail = availableProtocols(links);
    expect(avail.map((p) => p.protocol).toList(), [VpnProtocol.wireguard, VpnProtocol.reality, VpnProtocol.vless]);
    expect(protocolConfigFor(avail, VpnProtocol.reality)!.payload.contains('reality'), isTrue);
  });

  test('only Auto + present protocols are offered', () {
    final links = [
      {'outboundId': 'afrows-reality', 'format': 'vless-uri', 'uri': 'vless://u@h:443?security=reality#R'},
    ];
    final avail = availableProtocols(links);
    expect(avail.map((p) => p.protocol).toList(), [VpnProtocol.reality]);
  });
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter test test/vpn_protocol_test.dart`
Expected: FAIL — `vpn_protocol.dart` missing.

- [ ] **Step 3: Implement `vpn_protocol.dart`**

```dart
/// The transports the app can use. `auto` resolves to one of the concretes.
enum VpnProtocol { auto, wireguard, reality, vless }

extension VpnProtocolLabel on VpnProtocol {
  String get label => switch (this) {
        VpnProtocol.auto => 'Auto',
        VpnProtocol.wireguard => 'WireGuard',
        VpnProtocol.reality => 'Reality',
        VpnProtocol.vless => 'VLESS',
      };
}

/// A concrete protocol the user has, with its connect payload (wg-quick conf or
/// vless:// URI).
class ProtocolConfig {
  const ProtocolConfig({required this.protocol, required this.payload});
  final VpnProtocol protocol; // never auto
  final String payload;
}

/// Derives the user's available concrete protocols from /client/subscription
/// configLinks, in preference order: WireGuard, Reality, VLESS.
List<ProtocolConfig> availableProtocols(List<dynamic> links) {
  ProtocolConfig? wg, reality, vless;
  for (final l in links) {
    final m = (l as Map).cast<String, dynamic>();
    final outbound = (m['outboundId'] as String?) ?? '';
    final text = (m['configText'] as String?)?.trim();
    final uri = (m['uri'] as String?)?.trim();
    if (text != null && text.isNotEmpty && text.contains('[Interface]')) {
      wg = ProtocolConfig(protocol: VpnProtocol.wireguard, payload: text);
    } else if (uri != null && uri.startsWith('vless://')) {
      if (outbound == 'afrows-reality' || uri.contains('security=reality')) {
        reality = ProtocolConfig(protocol: VpnProtocol.reality, payload: uri);
      } else {
        vless = ProtocolConfig(protocol: VpnProtocol.vless, payload: uri);
      }
    }
  }
  return [wg, reality, vless].whereType<ProtocolConfig>().toList();
}

ProtocolConfig? protocolConfigFor(List<ProtocolConfig> avail, VpnProtocol p) {
  for (final c in avail) {
    if (c.protocol == p) return c;
  }
  return null;
}
```

- [ ] **Step 4: Add `fetchSubscriptionLinks` to `api.dart`**

Replace the body reuse of `firstConfigUri` — add a method that returns the raw links list:

```dart
  /// Returns all subscription configLinks (for the protocol selector).
  Future<List<dynamic>> fetchSubscriptionLinks(String token) async {
    final res = await http.get(
      Uri.parse('$base/client/subscription'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return const [];
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (((body['subscription'] as Map?)?['configLinks']) as List?) ?? const [];
  }
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter test test/vpn_protocol_test.dart`
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add apps/native-client/lib/vpn/vpn_protocol.dart apps/native-client/lib/api.dart apps/native-client/test/vpn_protocol_test.dart
git commit -m "feat(app): protocol model + subscription->available-protocols mapping"
```

---

## Task 2: VpnEngine interface + WireguardEngine

**Files:**
- Create: `apps/native-client/lib/vpn/vpn_engine.dart`
- Create: `apps/native-client/lib/vpn/wireguard_engine.dart`

- [ ] **Step 1: Define the interface** (`lib/vpn/vpn_engine.dart`)

```dart
import 'vpn_protocol.dart';

/// Unified engine status (superset of what either engine reports).
class EngineStatus {
  const EngineStatus({required this.state, this.uplinkTotal = 0, this.downlinkTotal = 0, this.error});
  final String state; // DISCONNECTED | CONNECTING | CONNECTED | ERROR
  final int uplinkTotal; // bytes (0 if engine has no counters)
  final int downlinkTotal; // bytes
  final String? error;
}

abstract class VpnEngine {
  Stream<EngineStatus> status();
  Future<void> ensureReady();
  Future<bool> start(ProtocolConfig config); // returns false if permission denied
  Future<void> stop();
  Future<bool> isRunning();
  void dispose();
}
```

- [ ] **Step 2: Implement `WireguardEngine`** (`lib/vpn/wireguard_engine.dart`)

```dart
import 'dart:async';
import '../wireguard_vpn.dart';
import 'vpn_engine.dart';
import 'vpn_protocol.dart';

/// WireGuard via the proven wireguard_flutter plugin. No byte counters from the
/// plugin (uplinkTotal/downlinkTotal stay 0 — usage shown via the server poll).
class WireguardEngine implements VpnEngine {
  final WireguardVpn _wg = WireguardVpn();

  @override
  Stream<EngineStatus> status() =>
      _wg.status().map((s) => EngineStatus(state: s.state, error: s.error));

  @override
  Future<void> ensureReady() => _wg.ensureReady();

  @override
  Future<bool> start(ProtocolConfig config) => _wg.start(config.payload);

  @override
  Future<void> stop() => _wg.stop();

  @override
  Future<bool> isRunning() => _wg.isRunning();

  @override
  void dispose() => _wg.dispose();
}
```

- [ ] **Step 3: Analyze (no test — thin wrapper)**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter analyze lib/vpn`
Expected: No issues.

- [ ] **Step 4: Commit**

```bash
git add apps/native-client/lib/vpn/vpn_engine.dart apps/native-client/lib/vpn/wireguard_engine.dart
git commit -m "feat(app): VpnEngine interface + WireGuard engine wrapper"
```

---

## Task 3: V2rayEngine (flutter_v2ray, xray)

**Files:**
- Create: `apps/native-client/lib/vpn/v2ray_engine.dart`
- Delete: `apps/native-client/lib/singbox.dart`

- [ ] **Step 1: Implement `V2rayEngine`** (`lib/vpn/v2ray_engine.dart`)

```dart
import 'dart:async';
import 'package:flutter_v2ray/flutter_v2ray.dart';
import 'vpn_engine.dart';
import 'vpn_protocol.dart';

/// Reality/VLESS via flutter_v2ray (xray core). Reports live byte totals.
class V2rayEngine implements VpnEngine {
  final _ctrl = StreamController<EngineStatus>.broadcast();
  late final FlutterV2ray _v2 = FlutterV2ray(onStatusChanged: (s) {
    final st = s.state.toUpperCase().contains('CONNECTED')
        ? 'CONNECTED'
        : (s.state.toUpperCase().contains('CONNECTING') ? 'CONNECTING' : 'DISCONNECTED');
    _ctrl.add(EngineStatus(state: st, uplinkTotal: s.upload, downlinkTotal: s.download));
  });
  bool _inited = false;

  @override
  Stream<EngineStatus> status() => _ctrl.stream;

  @override
  Future<void> ensureReady() async {
    if (_inited) return;
    await _v2.initializeV2Ray();
    _inited = true;
  }

  @override
  Future<bool> start(ProtocolConfig config) async {
    await ensureReady();
    if (!await _v2.requestPermission()) return false;
    final parser = FlutterV2ray.parseFromURL(config.payload); // vless:// URI
    await _v2.startV2Ray(remark: parser.remark, config: parser.getFullConfiguration(), proxyOnly: false);
    return true;
  }

  @override
  Future<void> stop() => _v2.stopV2Ray();

  @override
  Future<bool> isRunning() async {
    // flutter_v2ray has no direct query; rely on the last status event.
    return false;
  }

  @override
  void dispose() => _ctrl.close();
}
```

- [ ] **Step 2: Delete the dead sing-box bridge**

```bash
git rm apps/native-client/lib/singbox.dart
```

- [ ] **Step 3: Analyze**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter analyze lib/vpn`
Expected: No issues. (If `flutter_v2ray`'s `V2RayStatus` field names differ — e.g. `upload`/`download` vs `uploadTotal` — adjust the mapping to the plugin's actual API; verify against `flutter_v2ray` docs for the pinned version.)

- [ ] **Step 4: Commit**

```bash
git add apps/native-client/lib/vpn/v2ray_engine.dart && git rm apps/native-client/lib/singbox.dart
git commit -m "feat(app): xray (flutter_v2ray) engine wrapper; remove dead sing-box bridge"
```

---

## Task 4: Backend UDP-echo probe responder (for Auto)

**Files:**
- Create: `scripts/afrows-udp-echo.py`
- Create: `scripts/afrows-udp-echo.service` (systemd unit, shipped manually)

- [ ] **Step 1: Implement a tiny UDP echo on a dedicated probe port** (`scripts/afrows-udp-echo.py`)

```python
#!/usr/bin/env python3
# Minimal UDP echo so the app can detect whether THIS network can reach the
# Afrows server over UDP (a proxy for "WireGuard/UDP will work"). Echoes any
# datagram back to its sender. Port from AFROWS_UDP_PROBE_PORT (default 51821).
import os, socket
port = int(os.environ.get('AFROWS_UDP_PROBE_PORT', '51821'))
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(('0.0.0.0', port))
print(f'afrows-udp-echo on :{port}', flush=True)
while True:
    data, addr = s.recvfrom(64)
    try:
        s.sendto(data[:64], addr)
    except OSError:
        pass
```

- [ ] **Step 2: systemd unit** (`scripts/afrows-udp-echo.service`)

```ini
[Unit]
Description=Afrows UDP reachability echo (app Auto-protocol probe)
After=network.target
[Service]
Environment=AFROWS_UDP_PROBE_PORT=51821
ExecStart=/usr/bin/python3 /usr/local/bin/afrows-udp-echo.py
Restart=always
[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Deploy notes (run at deploy time, not now)**

`scp scripts/afrows-udp-echo.py root@94.74.145.199:/usr/local/bin/`, `scp` the unit to `/etc/systemd/system/`, `systemctl enable --now afrows-udp-echo`, and open UDP 51821 in the firewall. (Operator-gated deploy.)

- [ ] **Step 4: Commit**

```bash
git add scripts/afrows-udp-echo.py scripts/afrows-udp-echo.service
git commit -m "feat(infra): UDP echo responder for the app's Auto-protocol reachability probe"
```

---

## Task 5: ProtocolPicker (Auto: detect network, then pick) + per-network cache

**Files:**
- Create: `apps/native-client/lib/vpn/protocol_picker.dart`
- Test: `apps/native-client/test/protocol_picker_test.dart`

- [ ] **Step 1: Write the failing test** (`test/protocol_picker_test.dart`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:afrows_vpn/vpn/vpn_protocol.dart';
import 'package:afrows_vpn/vpn/protocol_picker.dart';

void main() {
  final avail = [
    const ProtocolConfig(protocol: VpnProtocol.wireguard, payload: 'wg'),
    const ProtocolConfig(protocol: VpnProtocol.reality, payload: 'r'),
    const ProtocolConfig(protocol: VpnProtocol.vless, payload: 'v'),
  ];

  test('udp reachable -> WireGuard', () async {
    final p = await resolveAuto(avail, udpReachable: () async => true, cached: null);
    expect(p.protocol, VpnProtocol.wireguard);
  });

  test('udp blocked -> Reality (then VLESS)', () async {
    final p = await resolveAuto(avail, udpReachable: () async => false, cached: null);
    expect(p.protocol, VpnProtocol.reality);
  });

  test('cached winner is used without probing', () async {
    var probed = false;
    final p = await resolveAuto(avail, udpReachable: () async { probed = true; return true; }, cached: VpnProtocol.vless);
    expect(p.protocol, VpnProtocol.vless);
    expect(probed, isFalse);
  });

  test('udp blocked but no reality -> vless', () async {
    final noReality = [avail[0], avail[2]];
    final p = await resolveAuto(noReality, udpReachable: () async => false, cached: null);
    expect(p.protocol, VpnProtocol.vless);
  });
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter test test/protocol_picker_test.dart`
Expected: FAIL — `protocol_picker.dart` missing.

- [ ] **Step 3: Implement `protocol_picker.dart`**

```dart
import 'dart:async';
import 'dart:io';
import 'vpn_protocol.dart';

/// Pure resolver: given available protocols, a UDP-reachability probe, and an
/// optional cached choice, returns the concrete protocol Auto should use.
/// Order: cached (if still available) -> [udp ok ? WireGuard] -> Reality -> VLESS.
Future<ProtocolConfig> resolveAuto(
  List<ProtocolConfig> avail, {
  required Future<bool> Function() udpReachable,
  required VpnProtocol? cached,
}) async {
  ProtocolConfig? pick(VpnProtocol p) => protocolConfigFor(avail, p);

  if (cached != null) {
    final c = pick(cached);
    if (c != null) return c;
  }
  final wg = pick(VpnProtocol.wireguard);
  if (wg != null && await udpReachable()) return wg;
  return pick(VpnProtocol.reality) ?? pick(VpnProtocol.vless) ?? wg ?? avail.first;
}

/// Real UDP probe: send a datagram to the server's echo port and await a reply.
/// host = the WireGuard endpoint host (server IP); probePort default 51821.
Future<bool> probeUdpReachable(String host, {int probePort = 51821, Duration timeout = const Duration(seconds: 3)}) async {
  RawDatagramSocket? sock;
  try {
    sock = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
    final dest = (await InternetAddress.lookup(host)).first;
    final payload = [1, 2, 3, 4];
    final completer = Completer<bool>();
    sock.listen((e) {
      if (e == RawSocketEvent.read && sock!.receive() != null && !completer.isCompleted) {
        completer.complete(true);
      }
    });
    sock.send(payload, dest, probePort);
    return await completer.future.timeout(timeout, onTimeout: () => false);
  } catch (_) {
    return false;
  } finally {
    sock?.close();
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter test test/protocol_picker_test.dart`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/native-client/lib/vpn/protocol_picker.dart apps/native-client/test/protocol_picker_test.dart
git commit -m "feat(app): Auto protocol picker (UDP-reachability probe + per-network cache)"
```

---

## Task 6: VpnController (owns active engine, switches)

**Files:**
- Create: `apps/native-client/lib/vpn/vpn_controller.dart`

- [ ] **Step 1: Implement** (`lib/vpn/vpn_controller.dart`)

```dart
import 'dart:async';
import 'vpn_engine.dart';
import 'vpn_protocol.dart';
import 'wireguard_engine.dart';
import 'v2ray_engine.dart';

/// Owns the two engines and exposes a single status stream. Routes start() to
/// the engine for the resolved concrete protocol; only one runs at a time.
class VpnController {
  final WireguardEngine _wg = WireguardEngine();
  final V2rayEngine _v2 = V2rayEngine();
  final _ctrl = StreamController<EngineStatus>.broadcast();
  StreamSubscription? _sub;
  VpnProtocol? active; // concrete protocol currently driving the tunnel

  Stream<EngineStatus> status() => _ctrl.stream;

  VpnEngine _engineFor(VpnProtocol p) =>
      p == VpnProtocol.wireguard ? _wg : _v2;

  Future<void> ensureReady() => _wg.ensureReady();

  Future<bool> start(ProtocolConfig config) async {
    await stop();
    final engine = _engineFor(config.protocol);
    _sub = engine.status().listen(_ctrl.add);
    final ok = await engine.start(config);
    if (ok) active = config.protocol;
    return ok;
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    if (active != null) await _engineFor(active!).stop();
    active = null;
  }

  void dispose() {
    _sub?.cancel();
    _wg.dispose();
    _v2.dispose();
    _ctrl.close();
  }
}
```

- [ ] **Step 2: Analyze**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter analyze lib/vpn`
Expected: No issues.

- [ ] **Step 3: Commit**

```bash
git add apps/native-client/lib/vpn/vpn_controller.dart
git commit -m "feat(app): VpnController routes to WG/xray engine, one active at a time"
```

---

## Task 7: Connect screen — selector UI, switching, Auto, live stats

**Files:**
- Modify: `apps/native-client/lib/connect_screen.dart`
- Modify: `apps/native-client/lib/app_version.dart`

- [ ] **Step 1: Load available protocols + selection state**

In `_ConnectScreenState`, replace the direct `WireguardVpn _vpn` usage with `VpnController`. Add:

```dart
final _controller = VpnController();
List<ProtocolConfig> _avail = [];
VpnProtocol _selected = VpnProtocol.auto; // persisted; default Auto
VpnProtocol? _activeProto; // what Auto resolved to / current concrete
```

In `_init` (account mode), after the config fetch, load links + persisted selection:

```dart
final links = await AfrowsApi().fetchSubscriptionLinks(widget.account!.token);
if (mounted) setState(() => _avail = availableProtocols(links));
_selected = await SessionStore().loadProtocol(); // returns VpnProtocol.auto if none
```

- [ ] **Step 2: Resolve + connect through the controller**

Replace the connect path (`_vpn.start(_configLink!)`) with protocol resolution:

```dart
ProtocolConfig? cfg;
if (_selected == VpnProtocol.auto) {
  final wgHost = _wgEndpointHost(); // parse from the wireguard payload, else server host
  final cached = await SessionStore().loadAutoChoice(_networkKey);
  cfg = await resolveAuto(_avail, cached: cached,
      udpReachable: () => probeUdpReachable(wgHost));
  await SessionStore().saveAutoChoice(_networkKey, cfg.protocol);
} else {
  cfg = protocolConfigFor(_avail, _selected);
}
if (cfg == null) { _snack('No config for this protocol'); return; }
final ok = await _controller.start(cfg);
if (ok) setState(() => _activeProto = cfg!.protocol);
```

`_networkKey` = a best-effort network id (e.g. from `connectivity_plus`/wifi SSID if available, else the literal `'default'`). If adding a network-id dependency is undesirable, use `'default'` for v1 (the cache still avoids re-probing within a session).

- [ ] **Step 3: Selector widget + active-protocol display**

Add a protocol selector below the connect button, locked while connected (reuse the `_BypassToggle`'s "Disconnect to change" pattern):

```dart
Widget _protocolSelector() {
  final items = [VpnProtocol.auto, ..._avail.map((c) => c.protocol)];
  return Row(children: [
    const Text('Protocol', style: TextStyle(color: Colors.white60)),
    const Spacer(),
    DropdownButton<VpnProtocol>(
      value: _selected,
      dropdownColor: _panel,
      onChanged: (_connected || _connecting) ? null : (p) async {
        if (p == null) return;
        setState(() => _selected = p);
        await SessionStore().saveProtocol(p);
      },
      items: items.map((p) => DropdownMenuItem(value: p, child: Text(p.label))).toList(),
    ),
  ]);
}
```

When connected, show the active protocol in the status subtitle: `Connected · ${(_activeProto ?? _selected).label}`.

- [ ] **Step 4: Stats from the active engine**

Wire `_controller.status()` into `_onStatus`. For the up/down cards: if the active engine reports byte totals (xray), use them as the session totals (baseline at connect, same per-session delta logic already in place); if WireGuard (totals 0), keep the existing `_pollUsage` server-metered path. Gate `_pollUsage` to only run when `_activeProto == VpnProtocol.wireguard`.

- [ ] **Step 5: SessionStore persistence helpers** (`lib/vpn_config.dart`)

```dart
Future<VpnProtocol> loadProtocol() async {
  final p = (await SharedPreferences.getInstance()).getString('afrows_protocol');
  return VpnProtocol.values.firstWhere((v) => v.name == p, orElse: () => VpnProtocol.auto);
}
Future<void> saveProtocol(VpnProtocol p) async =>
    (await SharedPreferences.getInstance()).setString('afrows_protocol', p.name);
Future<VpnProtocol?> loadAutoChoice(String net) async {
  final p = (await SharedPreferences.getInstance()).getString('afrows_auto_$net');
  return p == null ? null : VpnProtocol.values.firstWhere((v) => v.name == p, orElse: () => VpnProtocol.auto);
}
Future<void> saveAutoChoice(String net, VpnProtocol p) async =>
    (await SharedPreferences.getInstance()).setString('afrows_auto_$net', p.name);
```

(Confirm `shared_preferences` is a dep; `vpn_config.dart` already persists the session, so reuse its storage mechanism if it isn't SharedPreferences.)

- [ ] **Step 6: Bump version** (`lib/app_version.dart`)

```dart
const String kAppVersion = '2.5.0';
const String kBuildTag = '2026-06-21-protocols';
```

- [ ] **Step 7: Analyze**

Run: `cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter analyze`
Expected: No issues found.

- [ ] **Step 8: Commit**

```bash
git add apps/native-client/lib/connect_screen.dart apps/native-client/lib/vpn_config.dart apps/native-client/lib/app_version.dart
git commit -m "feat(app): protocol selector + Auto + dual-engine wiring + live stats (v2.5.0)"
```

---

## Task 8: Build, device matrix, deploy (operator-gated)

**Files:** none (verification + deploy)

- [ ] **Step 1: Full analyze + unit tests**

```bash
cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter analyze && /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter test
```
Expected: no issues; vpn_protocol + protocol_picker tests pass.

- [ ] **Step 2: Build the APK**

```bash
cd apps/native-client && PUB_HOSTED_URL=https://pub.flutter-io.cn FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn /d/Programs/flutter_windows_3.27.3-stable/flutter/flutter/bin/flutter build apk --release
```

- [ ] **Step 3: Deploy the UDP echo (operator-gated)** — ship `afrows-udp-echo.py` + unit, enable, open UDP 51821 (Task 4 Step 3).

- [ ] **Step 4: Device matrix**
  - Ben's UDP-blocked Wi-Fi: Auto → resolves to Reality, browses, live up/down shows. ✓
  - A UDP-OK network (mobile data): Auto → WireGuard. ✓
  - Manual pick each protocol → connects; switching requires disconnect (locked while connected). ✓
  - WireGuard still shows server-metered usage. ✓

- [ ] **Step 5: Upload APK** to `/opt/afrows/downloads/afrows.apk` (atomic swap, verify md5 + nginx 200), as in prior releases.

---

## Self-Review notes (addressed)

- **Spec coverage:** show protocols (T1, T7), change protocol (T7), change → reconnect via the chosen engine (T6/T7), Auto detect-network-then-pick (T5/T7), per-network memory (T5/T7), live stats for TCP protocols (T3/T7), dual-engine (T2/T3/T6), Phase 0 gate (T0), backend unchanged except UDP echo (T4). All mapped.
- **Engine deviation** from spec (sing-box → flutter_v2ray/xray) is flagged at the top and reflects the repo reality + the operator's proven xray clients.
- **Type consistency:** `VpnProtocol`, `ProtocolConfig`, `availableProtocols`, `protocolConfigFor`, `resolveAuto`, `probeUdpReachable`, `EngineStatus`, `VpnEngine`, `VpnController` used consistently across tasks.
- **Risk:** Task 0 is a hard gate — if flutter_v2ray can't connect on-device, stop and re-scope before building UI.
- **Known refinement points** (verify against the pinned `flutter_v2ray`): exact `V2RayStatus` field names and `parseFromURL`/`getFullConfiguration` signatures; the `_networkKey` source (SSID dep optional, `'default'` acceptable for v1).
