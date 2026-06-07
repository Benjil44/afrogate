import 'package:shared_preferences/shared_preferences.dart';

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
