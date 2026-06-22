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
