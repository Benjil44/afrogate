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

  /// Returns the first connectable config URI from the user's subscription.
  Future<String?> firstConfigUri(String token) async {
    final res = await http.get(
      Uri.parse('$base/client/subscription'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final links = (((body['subscription'] as Map?)?['configLinks']) as List?) ?? const [];
    for (final link in links) {
      final uri = (link as Map)['uri'];
      if (uri is String && uri.trim().isNotEmpty) return uri.trim();
    }
    return null;
  }
}
