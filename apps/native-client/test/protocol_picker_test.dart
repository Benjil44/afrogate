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
