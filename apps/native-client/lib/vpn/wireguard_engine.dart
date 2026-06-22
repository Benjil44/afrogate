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
