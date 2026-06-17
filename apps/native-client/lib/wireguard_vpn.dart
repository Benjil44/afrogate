import 'dart:async';

import 'package:wireguard_flutter/wireguard_flutter.dart';
import 'package:wireguard_flutter/wireguard_flutter_platform_interface.dart'
    show WireGuardFlutterInterface;

/// Engine status, shaped to match what ConnectScreen already consumes (so the
/// UI didn't have to change when we swapped xray-core -> WireGuard).
///
/// Note: the WireGuard plugin reports tunnel *stage* (connected/connecting/…)
/// but not byte counters, so uplink/downlink stay 0 here. Per-customer usage is
/// metered server-side from `wg show` (the dashboard is the source of truth).
class VpnStatus {
  const VpnStatus({
    required this.state,
    this.uplink = 0,
    this.downlink = 0,
    this.uplinkTotal = 0,
    this.downlinkTotal = 0,
    this.error,
    this.log,
  });

  /// DISCONNECTED | CONNECTING | CONNECTED | ERROR | LOG
  final String state;
  final int uplink; // bytes/sec
  final int downlink; // bytes/sec
  final int uplinkTotal; // bytes
  final int downlinkTotal; // bytes
  final String? error;
  final String? log;
}

/// Parsed view of a wg-quick `.conf`, for display + validation in the UI.
class WgConf {
  const WgConf({required this.endpoint, required this.address, required this.remark});
  final String endpoint; // host:port
  final String address; // tunnel client address
  final String remark; // display name (from a leading # comment, else endpoint)
}

/// Parse a wg-quick `.conf` string. Throws [FormatException] if it doesn't look
/// like a WireGuard config (missing [Interface]/[Peer]/Endpoint).
WgConf parseWgConf(String conf) {
  var endpoint = '';
  var address = '';
  var remark = '';
  var hasInterface = false;
  var hasPeer = false;
  for (final raw in conf.split('\n')) {
    final line = raw.trim();
    if (line.isEmpty) continue;
    if (line.startsWith('#')) {
      final c = line.substring(1).trim();
      if (remark.isEmpty && c.isNotEmpty) remark = c;
      continue;
    }
    final lower = line.toLowerCase();
    if (lower == '[interface]') {
      hasInterface = true;
      continue;
    }
    if (lower == '[peer]') {
      hasPeer = true;
      continue;
    }
    final idx = line.indexOf('=');
    if (idx < 0) continue;
    final key = line.substring(0, idx).trim().toLowerCase();
    final val = line.substring(idx + 1).trim();
    if (key == 'endpoint') {
      endpoint = val;
    } else if (key == 'address') {
      address = val;
    }
  }
  if (!hasInterface || !hasPeer || endpoint.isEmpty) {
    throw const FormatException('Not a valid WireGuard config');
  }
  return WgConf(
    endpoint: endpoint,
    address: address,
    remark: remark.isEmpty ? endpoint : remark,
  );
}

/// VPN engine backed by native WireGuard (the official com.wireguard.android
/// GoBackend) via the wireguard_flutter plugin. Replaces the xray-in-app engine
/// that never forwarded reliably on-device. The server runs kernel WireGuard
/// (wg0) which TPROXY-routes the tunnel through xray to the Germany exit.
///
/// `start()` takes a wg-quick `.conf` string (the same text the official
/// WireGuard app imports), NOT a vless:// link.
class WireguardVpn {
  WireguardVpn() {
    _wg = WireGuardFlutter.instance;
  }

  late final WireGuardFlutterInterface _wg;
  final StreamController<VpnStatus> _ctrl = StreamController<VpnStatus>.broadcast();
  StreamSubscription<VpnStage>? _stageSub;
  bool _inited = false;
  bool _userStopped = false; // ignore late CONNECTED broadcasts after a user stop
  String _lastState = 'DISCONNECTED';

  /// WireGuard interface name. Must be a valid wg name (<=15 chars, no spaces).
  static const _interfaceName = 'afrows';

  Stream<VpnStatus> status() => _ctrl.stream;

  /// Initialize the plugin and subscribe to stage changes. Calling this early
  /// (at screen load) pops the one-time Android VPN consent dialog before the
  /// user taps Connect, so the first connect succeeds without a retry.
  Future<void> ensureReady() => _ensureInit();

  Future<void> _ensureInit() async {
    if (_inited) return;
    _stageSub = _wg.vpnStageSnapshot.listen(_onStage);
    await _wg.initialize(interfaceName: _interfaceName);
    _inited = true;
  }

  void _onStage(VpnStage stage) {
    final mapped = _mapStage(stage);
    // After the user taps disconnect, ignore any in-flight CONNECTED broadcasts
    // so the button can't flip back to "Disconnect".
    if (_userStopped && mapped != 'DISCONNECTED') return;
    _lastState = mapped;
    _ctrl.add(VpnStatus(state: mapped));
  }

  String _mapStage(VpnStage stage) {
    switch (stage) {
      case VpnStage.connected:
        return 'CONNECTED';
      case VpnStage.connecting:
      case VpnStage.authenticating:
      case VpnStage.waitingConnection:
      case VpnStage.preparing:
      case VpnStage.reconnect:
        return 'CONNECTING';
      case VpnStage.denied:
        return 'DISCONNECTED';
      case VpnStage.disconnecting:
      case VpnStage.disconnected:
      case VpnStage.noConnection:
      case VpnStage.exiting:
        return 'DISCONNECTED';
    }
  }

  /// Whether the tunnel is currently up (best-effort: tracks the last reported
  /// stage, refreshed from the native side when possible).
  Future<bool> isRunning() async {
    try {
      return _mapStage(await _wg.stage()) == 'CONNECTED';
    } catch (_) {
      return _lastState == 'CONNECTED';
    }
  }

  /// Start from a wg-quick `.conf` string. Returns false if the VPN permission
  /// has not been granted yet (the consent dialog is shown; the user should tap
  /// Connect again once they allow it).
  Future<bool> start(String wgQuickConfig) async {
    _userStopped = false;
    await _ensureInit();
    _emit('CONNECTING');
    try {
      await _wg.startVpn(
        serverAddress: _endpointOf(wgQuickConfig),
        wgQuickConfig: wgQuickConfig,
        providerBundleIdentifier: 'com.afrows.afrows_vpn', // iOS only; unused on Android
      );
      return true;
    } catch (e) {
      // The plugin throws "Permissions are not given" the first time, right
      // after it pops the consent dialog. Surface as "not granted yet".
      final msg = e.toString().toLowerCase();
      if (msg.contains('permission')) {
        _emit('DISCONNECTED');
        return false;
      }
      rethrow;
    }
  }

  Future<void> stop() async {
    // Emit DISCONNECTED FIRST so the UI can't get stuck on "connected" if the
    // native stop call hangs or its stage broadcast is delayed.
    _userStopped = true;
    _emit('DISCONNECTED');
    try {
      await _wg.stopVpn();
    } catch (_) {
      // already optimistically marked disconnected
    }
  }

  /// Extract `host:port` from the conf's Endpoint line (used for the native
  /// notification/label). Falls back to empty string if not found.
  String _endpointOf(String conf) {
    for (final raw in conf.split('\n')) {
      final line = raw.trim();
      if (line.toLowerCase().startsWith('endpoint')) {
        final idx = line.indexOf('=');
        if (idx >= 0) return line.substring(idx + 1).trim();
      }
    }
    return '';
  }

  void _emit(String state) {
    _lastState = state;
    _ctrl.add(VpnStatus(state: state));
  }

  void dispose() {
    _stageSub?.cancel();
    _ctrl.close();
  }
}
