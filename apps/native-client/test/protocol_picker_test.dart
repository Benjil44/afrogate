import 'package:flutter_test/flutter_test.dart';
import 'package:afrows_vpn/vpn/vpn_protocol.dart';
import 'package:afrows_vpn/vpn/protocol_picker.dart';

void main() {
  final avail = [
    const ProtocolConfig(protocol: VpnProtocol.wireguard, payload: 'wg'),
    const ProtocolConfig(protocol: VpnProtocol.vless, payload: 'v'),
  ];

  test('Auto prefers VLESS-WS (works on every network)', () {
    final p = resolveAuto(avail, cached: null);
    expect(p.protocol, VpnProtocol.vless);
  });

  test('Auto falls to WireGuard when the account has no VLESS', () {
    final wgOnly = [const ProtocolConfig(protocol: VpnProtocol.wireguard, payload: 'wg')];
    final p = resolveAuto(wgOnly, cached: null);
    expect(p.protocol, VpnProtocol.wireguard);
  });

  test('cached choice is honored when still available', () {
    final p = resolveAuto(avail, cached: VpnProtocol.wireguard);
    expect(p.protocol, VpnProtocol.wireguard);
  });

  test('cached choice no longer available -> falls back to VLESS', () {
    final p = resolveAuto(avail, cached: VpnProtocol.reality);
    expect(p.protocol, VpnProtocol.vless);
  });
}
