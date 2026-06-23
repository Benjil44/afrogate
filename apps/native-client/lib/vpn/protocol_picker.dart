import 'vpn_protocol.dart';

/// Resolves Auto to a concrete protocol. Prefers **VLESS-WS (TCP 443)** because
/// it works on every network — including UDP-blocked ones and networks whose DPI
/// throttles WireGuard even when a UDP probe gets through (passing a tiny UDP
/// echo does not mean WireGuard will actually carry traffic, which is why the
/// probe was dropped). WireGuard is used only when the account has no VLESS.
/// A cached choice is honored if still available.
ProtocolConfig resolveAuto(List<ProtocolConfig> avail, {VpnProtocol? cached}) {
  ProtocolConfig? pick(VpnProtocol p) => protocolConfigFor(avail, p);
  if (cached != null) {
    final c = pick(cached);
    if (c != null) return c;
  }
  return pick(VpnProtocol.vless) ?? pick(VpnProtocol.wireguard) ?? avail.first;
}
