import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// Persists the logged-in account session so the app stays signed in after it
/// is closed; cleared only on explicit sign-out.
class SessionStore {
  static const _kToken = 'afrows_token';
  static const _kName = 'afrows_name';
  static const _kQuota = 'afrows_quota';
  static const _kUsed = 'afrows_used';
  static const _kRemain = 'afrows_remain';
  static const _kUri = 'afrows_cfg_uri';

  Future<void> save(AccountSession session, String? configUri) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kToken, session.token);
    await p.setString(_kName, session.account.displayName ?? '');
    await p.setInt(_kUsed, session.account.usedBytes);
    if (session.account.quotaLimitBytes != null) {
      await p.setInt(_kQuota, session.account.quotaLimitBytes!);
    } else {
      await p.remove(_kQuota);
    }
    if (session.account.remainingBytes != null) {
      await p.setInt(_kRemain, session.account.remainingBytes!);
    } else {
      await p.remove(_kRemain);
    }
    if (configUri != null && configUri.isNotEmpty) {
      await p.setString(_kUri, configUri);
    } else {
      await p.remove(_kUri);
    }
  }

  /// Returns the saved session + last config URI, or null if not signed in.
  Future<(AccountSession, String?)?> load() async {
    final p = await SharedPreferences.getInstance();
    final token = p.getString(_kToken);
    if (token == null || token.isEmpty) return null;
    final name = p.getString(_kName);
    final account = AccountInfo(
      displayName: (name != null && name.isNotEmpty) ? name : null,
      quotaLimitBytes: p.getInt(_kQuota),
      usedBytes: p.getInt(_kUsed) ?? 0,
      remainingBytes: p.getInt(_kRemain),
    );
    return (AccountSession(token: token, account: account), p.getString(_kUri));
  }

  Future<void> clear() async {
    final p = await SharedPreferences.getInstance();
    for (final k in [_kToken, _kName, _kQuota, _kUsed, _kRemain, _kUri]) {
      await p.remove(k);
    }
  }
}

/// Stores the user-pasted `vless://` link locally on the device.
/// (MVP config source — later this can be fetched from the backend.)
class VpnConfigStore {
  static const _key = 'afrows_vless_link';

  Future<String?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_key);
    return (value != null && value.trim().isNotEmpty) ? value.trim() : null;
  }

  Future<void> save(String link) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, link.trim());
  }
}
