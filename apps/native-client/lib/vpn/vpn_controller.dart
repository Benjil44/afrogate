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
