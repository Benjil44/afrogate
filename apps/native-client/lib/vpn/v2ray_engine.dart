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
