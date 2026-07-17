import 'dart:convert';
import 'package:http/http.dart' as http;

/// Backend base URL. The app reaches this directly (subject to the same inbound
/// reachability as the panel). Override at build time with
/// --dart-define=AFROWS_API_BASE=https://host/api.
const String kApiBase =
    String.fromEnvironment('AFROWS_API_BASE', defaultValue: 'https://app.afrows.com/api');

class AccountSession {
  AccountSession({required this.token, required this.account});
  final String token;
  final AccountInfo account;
}

class AccountInfo {
  AccountInfo({this.displayName, this.quotaLimitBytes, this.usedBytes = 0, this.remainingBytes});
  final String? displayName;
  final int? quotaLimitBytes;
  final int usedBytes;
  final int? remainingBytes;

  factory AccountInfo.fromJson(Map<String, dynamic> j) => AccountInfo(
        displayName: j['displayName'] as String?,
        quotaLimitBytes: (j['quotaLimitBytes'] as num?)?.toInt(),
        usedBytes: (j['usedBytes'] as num?)?.toInt() ?? 0,
        remainingBytes: (j['remainingBytes'] as num?)?.toInt(),
      );
}

class WgUsage {
  WgUsage({required this.rxBytes, required this.txBytes});
  final int rxBytes; // bytes server received from client = client UPLOAD
  final int txBytes; // bytes server sent to client = client DOWNLOAD
}

class GamingMode {
  const GamingMode({required this.entitled, required this.enabled});
  final bool entitled; // admin granted the billed feature
  final bool enabled; // user's current on/off

  factory GamingMode.fromJson(Map<String, dynamic> j) => GamingMode(
        entitled: j['entitled'] == true,
        enabled: j['enabled'] == true,
      );
}

class AfrowsApiException implements Exception {
  AfrowsApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class AfrowsApi {
  AfrowsApi({this.base = kApiBase});
  final String base;

  Future<AccountSession> login(String identifier, String password) async {
    final res = await http
        .post(
          Uri.parse('$base/client/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'identifier': identifier, 'password': password}),
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode == 401) {
      throw AfrowsApiException('Invalid email or password');
    }
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw AfrowsApiException('Login failed (${res.statusCode})');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return AccountSession(
      token: body['token'] as String,
      account: AccountInfo.fromJson((body['account'] as Map).cast<String, dynamic>()),
    );
  }

  /// Fetches the current account (live GB remaining/usage). Returns null on error.
  Future<AccountInfo?> fetchAccount(String token) async {
    try {
      final res = await http.get(
        Uri.parse('$base/client/me'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final account = body['account'];
      if (account is Map) return AccountInfo.fromJson(account.cast<String, dynamic>());
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Live WireGuard usage for the account's peer, metered server-side (the
  /// wireguard_flutter plugin reports no byte counters). rxBytes = client upload,
  /// txBytes = client download. Returns null on error.
  Future<WgUsage?> fetchWireguardUsage(String token) async {
    try {
      final res = await http.get(
        Uri.parse('$base/client/wireguard-usage'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return null;
      final b = jsonDecode(res.body) as Map<String, dynamic>;
      return WgUsage(
        rxBytes: (b['rxBytes'] as num?)?.toInt() ?? 0,
        txBytes: (b['txBytes'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      return null;
    }
  }

  /// Global egress mode: 'smart' (Ireland direct, foreign via the bypass pool) or
  /// 'full' (everything via the bypass pool). Returns 'smart' on error.
  Future<String> fetchEgressMode(String token) async {
    try {
      final res = await http.get(
        Uri.parse('$base/client/egress-mode'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return 'smart';
      final b = jsonDecode(res.body) as Map<String, dynamic>;
      return b['mode'] == 'full' ? 'full' : 'smart';
    } catch (_) {
      return 'smart';
    }
  }

  /// Sets the global egress mode. Returns the applied mode, or null on failure.
  Future<String?> setEgressMode(String token, String mode) async {
    try {
      final res = await http.patch(
        Uri.parse('$base/client/egress-mode'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'mode': mode}),
      ).timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return null;
      final b = jsonDecode(res.body) as Map<String, dynamic>;
      return b['mode'] == 'full' ? 'full' : 'smart';
    } catch (_) {
      return null;
    }
  }

  /// Gaming (low-ping Starlink) mode. `entitled` = admin granted the feature
  /// (controls whether the app shows the toggle); `enabled` = the user's current
  /// on/off. Returns not-entitled/off on error.
  Future<GamingMode> fetchGamingMode(String token) async {
    try {
      final res = await http.get(
        Uri.parse('$base/client/gaming-mode'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return const GamingMode(entitled: false, enabled: false);
      final g = (jsonDecode(res.body) as Map)['gaming'];
      return g is Map ? GamingMode.fromJson(g.cast<String, dynamic>()) : const GamingMode(entitled: false, enabled: false);
    } catch (_) {
      return const GamingMode(entitled: false, enabled: false);
    }
  }

  /// Turns gaming mode on/off for this account. Returns the applied state, or
  /// null on failure (e.g. 403 when not entitled).
  Future<GamingMode?> setGamingMode(String token, bool enabled) async {
    try {
      final res = await http.patch(
        Uri.parse('$base/client/gaming-mode'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'enabled': enabled}),
      ).timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return null;
      final g = (jsonDecode(res.body) as Map)['gaming'];
      return g is Map ? GamingMode.fromJson(g.cast<String, dynamic>()) : null;
    } catch (_) {
      return null;
    }
  }

  /// Returns the first connectable config from the user's subscription. The app
  /// engine is WireGuard, so a rendered WireGuard `.conf` (`configText`) is
  /// preferred; falls back to the first `uri` for older accounts.
  Future<String?> firstConfigUri(String token) async {
    final res = await http.get(
      Uri.parse('$base/client/subscription'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final links = (((body['subscription'] as Map?)?['configLinks']) as List?) ?? const [];
    // Prefer a rendered WireGuard config (configText).
    for (final link in links) {
      final text = (link as Map)['configText'];
      if (text is String && text.trim().isNotEmpty) return text.trim();
    }
    // Fallback: a connectable URI.
    for (final link in links) {
      final uri = (link as Map)['uri'];
      if (uri is String && uri.trim().isNotEmpty) return uri.trim();
    }
    return null;
  }

  /// Returns all subscription configLinks (for the protocol selector).
  Future<List<dynamic>> fetchSubscriptionLinks(String token) async {
    final res = await http.get(
      Uri.parse('$base/client/subscription'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return const [];
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (((body['subscription'] as Map?)?['configLinks']) as List?) ?? const [];
  }
}
