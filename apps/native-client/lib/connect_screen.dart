import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';

import 'api.dart';
import 'app_version.dart';
import 'diag.dart';
import 'diag_screen.dart';
import 'start_screen.dart';
import 'vpn_config.dart';

const _teal = Color(0xFF18B6A6);
const _panel = Color(0xFF12201F);
const _line = Color(0xFF24302F);

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key, this.account, this.accountConfigUri});

  /// When set, the screen is in "account mode" (logged-in user): config comes
  /// from the subscription and quota is shown. When null, it's BYO-vless mode.
  final AccountSession? account;
  final String? accountConfigUri;

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _store = VpnConfigStore();
  late final FlutterV2ray _v2ray = FlutterV2ray(onStatusChanged: _onStatus);

  bool _ready = false;
  String _state = 'DISCONNECTED';
  int _uploadSpeed = 0;
  int _downloadSpeed = 0;
  int _uploadTotal = 0;
  int _downloadTotal = 0;
  String _duration = '00:00:00';
  String? _configLink;
  String _remark = '';
  AccountInfo? _account; // live account (GB remaining) in account mode
  Timer? _accountTimer;

  bool get _connected => _state.toUpperCase() == 'CONNECTED';
  bool get _connecting => _state.toUpperCase() == 'CONNECTING';

  @override
  void initState() {
    super.initState();
    _init();
  }

  bool get _accountMode => widget.account != null;

  Future<void> _init() async {
    await _v2ray.initializeV2Ray();
    if (_accountMode) {
      _configLink = widget.accountConfigUri;
      _account = widget.account!.account;
      _remark = widget.account!.account.displayName ?? 'Afrows';
      unawaited(_refreshAccount());
      _accountTimer = Timer.periodic(const Duration(seconds: 30), (_) => unawaited(_refreshAccount()));
    } else {
      final link = await _store.load();
      if (link != null) {
        _configLink = link;
        try {
          _remark = FlutterV2ray.parseFromURL(link).remark;
        } catch (_) {}
      }
    }
    Diag.I.log('init: mode=${_accountMode ? "account" : "manual"}, '
        'config=${_configLink == null ? "NONE" : "${_configLink!.length} chars"}');
    if (mounted) setState(() => _ready = true);
  }

  /// Live-refresh the account (GB remaining) from the backend; persists it.
  Future<void> _refreshAccount() async {
    final token = widget.account?.token;
    if (token == null) return;
    final fresh = await AfrowsApi().fetchAccount(token);
    if (fresh == null || !mounted) return;
    setState(() => _account = fresh);
    await SessionStore().save(AccountSession(token: token, account: fresh), widget.accountConfigUri);
  }

  @override
  void dispose() {
    _accountTimer?.cancel();
    super.dispose();
  }

  void _onStatus(V2RayStatus status) {
    if (!mounted) return;
    if (status.state != _state) {
      Diag.I.log('status -> ${status.state}');
    }
    // log traffic once it starts moving (confirms the tunnel carries data)
    if (status.download + status.upload > 0 && _downloadTotal + _uploadTotal == 0) {
      Diag.I.log('traffic flowing: down=${status.download}B up=${status.upload}B');
    }
    setState(() {
      _state = status.state;
      _uploadSpeed = status.uploadSpeed;
      _downloadSpeed = status.downloadSpeed;
      _uploadTotal = status.upload;
      _downloadTotal = status.download;
      _duration = status.duration;
    });
  }

  Future<void> _toggle() async {
    if (_connected || _connecting) {
      Diag.I.log('Disconnect tapped');
      await _v2ray.stopV2Ray();
      return;
    }
    if (_configLink == null) {
      await _editConfig();
      if (_configLink == null) return;
    }
    Diag.I.log('Connect tapped (mode=${_accountMode ? "account" : "manual"}, link=${_configLink!.length} chars)');
    final V2RayURL parsed;
    try {
      parsed = FlutterV2ray.parseFromURL(_configLink!);
      Diag.I.log('parsed: ${parsed.address}:${parsed.port} remark="${parsed.remark}"');
    } catch (e) {
      Diag.I.log('parseFromURL FAILED: $e');
      _snack('Invalid vless:// link — fix it in settings');
      return;
    }
    final String fullConfig;
    try {
      fullConfig = parsed.getFullConfiguration();
      // log the streamSettings region (where ws/tls/path live) so we can verify it
      final idx = fullConfig.indexOf('streamSettings');
      final region = idx >= 0
          ? fullConfig.substring(idx, (idx + 700).clamp(0, fullConfig.length))
          : fullConfig;
      Diag.I.log('streamSettings: $region');
    } catch (e) {
      Diag.I.log('getFullConfiguration FAILED: $e');
      _snack('Could not build config: $e');
      return;
    }
    final granted = await _v2ray.requestPermission();
    Diag.I.log('VPN permission granted=$granted');
    if (!granted) {
      _snack('VPN permission is required to connect');
      return;
    }
    try {
      await _v2ray.startV2Ray(
        remark: parsed.remark.isNotEmpty ? parsed.remark : 'Afrows',
        config: fullConfig,
        proxyOnly: false,
      );
      Diag.I.log('startV2Ray() returned (VpnService starting)');
    } catch (e) {
      Diag.I.log('startV2Ray FAILED: $e');
      _snack('Start failed: $e');
    }
  }

  Future<void> _signOut() async {
    try {
      await _v2ray.stopV2Ray();
    } catch (_) {}
    await SessionStore().clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const StartScreen()),
      (route) => false,
    );
  }

  Future<void> _editConfig() async {
    final ctrl = TextEditingController(text: _configLink ?? '');
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          left: 16,
          right: 16,
          top: 18,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Server config',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            const Text('Paste a vless:// link',
                style: TextStyle(color: Colors.white54, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              maxLines: 4,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              decoration: InputDecoration(
                hintText: 'vless://...',
                filled: true,
                fillColor: const Color(0xFF0B1416),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _line),
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: _teal),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Save'),
              ),
            ),
          ],
        ),
      ),
    );
    if (saved == true) {
      final link = ctrl.text.trim();
      if (link.isEmpty) return;
      try {
        final parsed = FlutterV2ray.parseFromURL(link);
        await _store.save(link);
        if (mounted) {
          setState(() {
            _configLink = link;
            _remark = parsed.remark;
          });
        }
      } catch (_) {
        _snack('That does not look like a valid vless:// link');
      }
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg), backgroundColor: _panel));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Afrows', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            tooltip: 'Diagnostics',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const DiagScreen()),
            ),
            icon: const Icon(Icons.bug_report_outlined),
          ),
          if (_accountMode)
            IconButton(
              tooltip: 'Sign out',
              onPressed: () {
                _signOut();
              },
              icon: const Icon(Icons.logout),
            )
          else
            IconButton(
              tooltip: 'Server config',
              onPressed: _editConfig,
              icon: const Icon(Icons.settings_outlined),
            ),
        ],
      ),
      body: !_ready
          ? const Center(child: CircularProgressIndicator(color: _teal))
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    const Spacer(),
                    _StatusPill(state: _state),
                    if (_accountMode && _account?.remainingBytes != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        '${_fmtBytes(_account!.remainingBytes!)} remaining',
                        style: const TextStyle(color: _teal, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ],
                    const SizedBox(height: 28),
                    _ConnectButton(
                      connected: _connected,
                      connecting: _connecting,
                      onTap: _toggle,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      _configLink == null
                          ? (_accountMode ? 'No active config yet — contact your seller' : 'No server — tap to add one')
                          : (_remark.isNotEmpty ? _remark : 'Server ready'),
                      style: const TextStyle(color: Colors.white60),
                    ),
                    if (_connected) ...[
                      const SizedBox(height: 6),
                      Text(_duration,
                          style: const TextStyle(
                              color: Colors.white38,
                              fontFeatures: [FontFeature.tabularFigures()])),
                    ],
                    const Spacer(),
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            icon: Icons.south,
                            label: 'Download',
                            speed: _fmtSpeed(_downloadSpeed),
                            total: _fmtBytes(_downloadTotal),
                            color: _teal,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            icon: Icons.north,
                            label: 'Upload',
                            speed: _fmtSpeed(_uploadSpeed),
                            total: _fmtBytes(_uploadTotal),
                            color: const Color(0xFF6C8CFF),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text('Afrows v$kAppVersion · $kBuildTag',
                        style: const TextStyle(color: Colors.white24, fontSize: 11)),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
    );
  }
}

String _fmtSpeed(int bytesPerSec) {
  if (bytesPerSec <= 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  double v = bytesPerSec.toDouble();
  var i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return '${v.toStringAsFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}';
}

String _fmtBytes(int bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  double v = bytes.toDouble();
  var i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return '${v.toStringAsFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}';
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.state});
  final String state;

  @override
  Widget build(BuildContext context) {
    final up = state.toUpperCase();
    final connected = up == 'CONNECTED';
    final connecting = up == 'CONNECTING';
    final color = connected
        ? _teal
        : connecting
            ? const Color(0xFFE5B567)
            : Colors.white38;
    final label = connected
        ? 'Connected'
        : connecting
            ? 'Connecting…'
            : 'Disconnected';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(label,
              style: TextStyle(color: color, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _ConnectButton extends StatelessWidget {
  const _ConnectButton({
    required this.connected,
    required this.connecting,
    required this.onTap,
  });
  final bool connected;
  final bool connecting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = connected || connecting;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        width: 180,
        height: 180,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: active
                ? [_teal, const Color(0xFF0E7A6F)]
                : [const Color(0xFF1B2A29), const Color(0xFF14201F)],
          ),
          boxShadow: active
              ? [BoxShadow(color: _teal.withValues(alpha: 0.4), blurRadius: 32, spreadRadius: 2)]
              : null,
          border: Border.all(
            color: active ? _teal : _line,
            width: 2,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              connected ? Icons.power_settings_new : Icons.power_settings_new,
              size: 56,
              color: active ? Colors.white : Colors.white54,
            ),
            const SizedBox(height: 8),
            Text(
              connecting ? '…' : (connected ? 'Disconnect' : 'Connect'),
              style: TextStyle(
                color: active ? Colors.white : Colors.white54,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.speed,
    required this.total,
    required this.color,
  });
  final IconData icon;
  final String label;
  final String speed;
  final String total;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(color: Colors.white60, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 10),
          Text(speed,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(total, style: const TextStyle(color: Colors.white38, fontSize: 12)),
        ],
      ),
    );
  }
}
