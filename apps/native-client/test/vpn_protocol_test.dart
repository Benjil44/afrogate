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
