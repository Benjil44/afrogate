import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';

/// Live status pushed from the native sing-box VpnService.
class SingboxStatus {
  final String state; // CONNECTED | DISCONNECTED | ERROR
  final int uplink; // bytes/sec
  final int downlink; // bytes/sec
  final int uplinkTotal;
  final int downlinkTotal;
  final String? error;
  final String? log;

  const SingboxStatus({
    required this.state,
    this.uplink = 0,
    this.downlink = 0,
    this.uplinkTotal = 0,
    this.downlinkTotal = 0,
    this.error,
    this.log,
  });

  factory SingboxStatus.fromMap(Map<dynamic, dynamic> m) => SingboxStatus(
        state: (m['state'] as String?) ?? 'DISCONNECTED',
        uplink: (m['uplink'] as num?)?.toInt() ?? 0,
        downlink: (m['downlink'] as num?)?.toInt() ?? 0,
        uplinkTotal: (m['uplinkTotal'] as num?)?.toInt() ?? 0,
        downlinkTotal: (m['downlinkTotal'] as num?)?.toInt() ?? 0,
        error: m['error'] as String?,
        log: m['log'] as String?,
      );
}

/// Bridge to the native VpnService running sing-box (libbox).
class SingboxVpn {
  static const _method = MethodChannel('afrows/vpn');
  static const _events = EventChannel('afrows/vpn/status');

  Stream<SingboxStatus> status() =>
      _events.receiveBroadcastStream().map((e) => SingboxStatus.fromMap(e as Map));

  /// Starts the tunnel with a sing-box JSON config. Returns false if the user
  /// declined the VPN permission prompt.
  Future<bool> start(String configJson) async =>
      (await _method.invokeMethod<bool>('start', {'config': configJson})) ?? false;

  Future<void> stop() => _method.invokeMethod<void>('stop');

  Future<bool> isRunning() async =>
      (await _method.invokeMethod<bool>('isRunning')) ?? false;
}

/// Parsed VLESS link fields.
class VlessLink {
  final String uuid;
  final String host;
  final int port;
  final String security; // tls | reality | none
  final String network; // ws | tcp
  final String sni;
  final String wsPath;
  final String wsHost;
  final String fingerprint;
  final String flow;
  final String remark;

  const VlessLink({
    required this.uuid,
    required this.host,
    required this.port,
    required this.security,
    required this.network,
    required this.sni,
    required this.wsPath,
    required this.wsHost,
    required this.fingerprint,
    required this.flow,
    required this.remark,
  });
}

VlessLink parseVless(String uri) {
  final u = Uri.parse(uri.trim());
  final q = u.queryParameters;
  final sni = q['sni'] ?? q['host'] ?? u.host;
  final remark = u.fragment.isNotEmpty ? Uri.decodeComponent(u.fragment) : 'Afrows';
  return VlessLink(
    uuid: u.userInfo,
    host: u.host,
    port: u.hasPort ? u.port : 443,
    security: q['security'] ?? 'none',
    network: q['type'] ?? 'tcp',
    sni: sni,
    wsPath: q['path'] ?? '/',
    wsHost: q['host'] ?? sni,
    fingerprint: q['fp'] ?? 'chrome',
    flow: q['flow'] ?? '',
    remark: remark,
  );
}

/// Builds a sing-box (v1.13) full-tunnel JSON config from a VLESS link.
String buildSingboxConfig(String uri) {
  final c = parseVless(uri);

  final outbound = <String, dynamic>{
    'type': 'vless',
    'tag': 'proxy',
    'server': c.host,
    'server_port': c.port,
    'uuid': c.uuid,
  };
  if (c.flow.isNotEmpty) outbound['flow'] = c.flow;
  if (c.security == 'tls' || c.security == 'reality') {
    outbound['tls'] = <String, dynamic>{
      'enabled': true,
      'server_name': c.sni,
      'utls': {'enabled': true, 'fingerprint': c.fingerprint},
    };
  }
  if (c.network == 'ws') {
    outbound['transport'] = <String, dynamic>{
      'type': 'ws',
      'path': c.wsPath,
      'headers': {'Host': c.wsHost},
    };
  }

  final config = <String, dynamic>{
    'log': {'level': 'info'},
    'dns': {
      'servers': [
        {'tag': 'proxy-dns', 'address': 'https://1.1.1.1/dns-query', 'detour': 'proxy'},
        {'tag': 'local-dns', 'address': '223.5.5.5', 'detour': 'direct'},
      ],
      'final': 'proxy-dns',
      'strategy': 'ipv4_only',
    },
    'inbounds': [
      {
        'type': 'tun',
        'tag': 'tun-in',
        'address': ['172.19.0.1/30'],
        'auto_route': true,
        'strict_route': false,
        'stack': 'gvisor',
      }
    ],
    'outbounds': [
      outbound,
      {'type': 'direct', 'tag': 'direct'},
    ],
    'route': {
      'auto_detect_interface': true,
      'final': 'proxy',
      'rules': [
        {'action': 'sniff'},
        {'protocol': 'dns', 'action': 'hijack-dns'},
        {'ip_is_private': true, 'outbound': 'direct'},
      ],
    },
  };
  return jsonEncode(config);
}
