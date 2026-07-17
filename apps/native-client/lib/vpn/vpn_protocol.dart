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
/// configLinks, in preference order: WireGuard, VLESS. Reality is intentionally
/// NOT offered: it needs the server to reach its camouflage dest for the TLS
/// handshake, which Afrows's Ireland uplink filters, so reality never connects here.
List<ProtocolConfig> availableProtocols(List<dynamic> links) {
  ProtocolConfig? wg, vless;
  for (final l in links) {
    final m = (l as Map).cast<String, dynamic>();
    final outbound = (m['outboundId'] as String?) ?? '';
    final text = (m['configText'] as String?)?.trim();
    final uri = (m['uri'] as String?)?.trim();
    final isReality = outbound == 'afrows-reality' || (uri?.contains('security=reality') ?? false);
    if (text != null && text.isNotEmpty && text.contains('[Interface]')) {
      wg = ProtocolConfig(protocol: VpnProtocol.wireguard, payload: text);
    } else if (uri != null && uri.startsWith('vless://') && !isReality) {
      vless = ProtocolConfig(protocol: VpnProtocol.vless, payload: uri);
    }
  }
  return [wg, vless].whereType<ProtocolConfig>().toList();
}

ProtocolConfig? protocolConfigFor(List<ProtocolConfig> avail, VpnProtocol p) {
  for (final c in avail) {
    if (c.protocol == p) return c;
  }
  return null;
}
