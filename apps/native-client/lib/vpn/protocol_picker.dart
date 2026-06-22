import 'dart:async';
import 'dart:io';
import 'vpn_protocol.dart';

/// Pure resolver: given available protocols, a UDP-reachability probe, and an
/// optional cached choice, returns the concrete protocol Auto should use.
/// Order: cached (if still available) -> [udp ok ? WireGuard] -> VLESS -> Reality.
/// On a UDP/port-restricted network we prefer VLESS-WS (TCP 443, proven to pass)
/// over Reality (TCP 8443, which such a network may also block).
Future<ProtocolConfig> resolveAuto(
  List<ProtocolConfig> avail, {
  required Future<bool> Function() udpReachable,
  required VpnProtocol? cached,
}) async {
  ProtocolConfig? pick(VpnProtocol p) => protocolConfigFor(avail, p);

  if (cached != null) {
    final c = pick(cached);
    if (c != null) return c;
  }
  final wg = pick(VpnProtocol.wireguard);
  if (wg != null && await udpReachable()) return wg;
  return pick(VpnProtocol.vless) ?? pick(VpnProtocol.reality) ?? wg ?? avail.first;
}

/// Real UDP probe: send a datagram to the server's echo port and await a reply.
/// host = the WireGuard endpoint host (server IP); probePort default 52000.
Future<bool> probeUdpReachable(String host, {int probePort = 52000, Duration timeout = const Duration(seconds: 3)}) async {
  RawDatagramSocket? sock;
  try {
    sock = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
    final dest = (await InternetAddress.lookup(host)).first;
    final payload = [1, 2, 3, 4];
    final completer = Completer<bool>();
    sock.listen((e) {
      if (e == RawSocketEvent.read && sock!.receive() != null && !completer.isCompleted) {
        completer.complete(true);
      }
    });
    sock.send(payload, dest, probePort);
    return await completer.future.timeout(timeout, onTimeout: () => false);
  } catch (_) {
    return false;
  } finally {
    sock?.close();
  }
}
