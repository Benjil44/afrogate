import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'app_version.dart';
import 'diag.dart';
import 'diag_screen.dart';
import 'start_screen.dart';
import 'wireguard_vpn.dart';
import 'vpn_config.dart';
import 'vpn/vpn_protocol.dart';
import 'vpn/vpn_engine.dart';
import 'vpn/vpn_controller.dart';
import 'vpn/protocol_picker.dart';

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
  final _controller = VpnController();
  StreamSubscription<EngineStatus>? _statusSub;
  DateTime? _connectedAt;
  Timer? _uptimeTimer; // ticks the duration each second (WG plugin emits no periodic status)
  Timer? _usageTimer; // polls server-side WG usage for the up/down cards

  bool _ready = false;
  String _state = 'DISCONNECTED';
  int _uploadTotal = 0; // THIS session's upload (server cumulative - baseline)
  int _downloadTotal = 0; // THIS session's download
  // Server-side counters are cumulative for the peer (they don't reset between
  // sessions), so snapshot them at connect and show the delta. Null = not yet
  // baselined for the current session (next poll sets it; cards read 0).
  int? _rxAtConnect;
  int? _txAtConnect;
  String _duration = '00:00:00';
  String? _configLink;
  String _remark = '';
  AccountInfo? _account; // live account (GB remaining) in account mode
  Timer? _accountTimer;
  String _egressMode = 'smart'; // 'smart' = Ireland direct + foreign via bypass; 'full' = all via bypass
  bool _egressBusy = false;
  GamingMode _gaming = const GamingMode(entitled: false, enabled: false);
  bool _gamingBusy = false;

  // ── Protocol selector state ──
  List<ProtocolConfig> _avail = []; // concrete protocols this account has
  VpnProtocol _selected = VpnProtocol.auto; // user choice (persisted); default Auto
  VpnProtocol? _activeProto; // what Auto resolved to / the running concrete protocol
  // Per-network cache key for the Auto choice. 'default' for v1 (no SSID dep).
  static const _networkKey = 'default';

  bool get _connected => _state.toUpperCase() == 'CONNECTED';
  bool get _connecting => _state.toUpperCase() == 'CONNECTING';

  @override
  void initState() {
    super.initState();
    _init();
  }

  bool get _accountMode => widget.account != null;

  Future<void> _init() async {
    _statusSub = _controller.status().listen(_onStatus);
    // The WireGuard plugin only emits on stage change (no periodic status), so
    // tick the uptime ourselves once a second while connected.
    _uptimeTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || !_connected || _connectedAt == null) return;
      setState(() => _duration = _fmtDuration(_connectedAt));
    });
    // Initialize the WireGuard backend early so the one-time VPN consent dialog
    // is handled before the user taps Connect.
    await _controller.ensureReady();
    if (_accountMode) {
      _configLink = widget.accountConfigUri;
      _account = widget.account!.account;
      _remark = widget.account!.account.displayName ?? 'Afrows';
      // Load the available transports + the user's persisted protocol choice so
      // the selector reflects what this account actually has.
      try {
        final links = await AfrowsApi().fetchSubscriptionLinks(widget.account!.token);
        if (mounted) setState(() => _avail = availableProtocols(links));
      } catch (e) {
        Diag.I.log('subscription links fetch failed: $e');
      }
      _selected = await SessionStore().loadProtocol();
      // The server renders the WireGuard config live (e.g. split-tunnel so the
      // API stays reachable WHILE connected). A config cached from an older
      // login can be stale (full-tunnel) and strand the stats/usage polls, so
      // always pull a fresh one on launch and use it for the next connect.
      unawaited(_refreshConfig());
      unawaited(_refreshAccount());
      unawaited(_loadEgressMode());
      unawaited(_loadGamingMode());
      _accountTimer = Timer.periodic(const Duration(seconds: 30), (_) => unawaited(_refreshAccount()));
      // Poll server-side WG usage so the up/down cards show real data (the
      // WireGuard plugin reports no on-device byte counters).
      _usageTimer = Timer.periodic(const Duration(seconds: 5), (_) => unawaited(_pollUsage()));
    } else {
      final link = await _store.load();
      if (link != null) {
        _configLink = link;
        try {
          _remark = parseWgConf(link).remark;
        } catch (_) {}
      }
    }
    Diag.I.log('init: mode=${_accountMode ? "account" : "manual"}, '
        'config=${_configLink == null ? "NONE" : "${_configLink!.length} chars"}');
    if (mounted) setState(() => _ready = true);
  }

  /// Server-metered WireGuard usage (the wireguard_flutter plugin reports no
  /// byte counters, and the on-device /proc read is sandboxed on MIUI). The
  /// server counters are CUMULATIVE for the peer, so we snapshot them at connect
  /// and show THIS session's delta — the cards start at 0 each connect, grow
  /// during the session, freeze on disconnect, and reset on the next connect.
  /// rxBytes = upload, txBytes = download (server's view of the client).
  Future<void> _pollUsage() async {
    final token = widget.account?.token;
    if (token == null || !_connected) return;
    // Only WireGuard relies on the server-metered counters; the xray engine
    // reports its own on-device byte totals (see _onStatus), so skip the poll.
    if (_activeProto != VpnProtocol.wireguard) return;
    final u = await AfrowsApi().fetchWireguardUsage(token);
    if (u == null) {
      Diag.I.log('wg-usage: null (request failed/no peer)');
      return;
    }
    if (!mounted) return;
    // First poll of this session: baseline the cumulative counters.
    _rxAtConnect ??= u.rxBytes;
    _txAtConnect ??= u.txBytes;
    // Clamp: if the server counter reset below the baseline (e.g. wg0 restart),
    // treat it as a fresh start instead of showing a negative.
    var up = u.rxBytes - _rxAtConnect!;
    var down = u.txBytes - _txAtConnect!;
    if (up < 0) {
      up = 0;
      _rxAtConnect = u.rxBytes;
    }
    if (down < 0) {
      down = 0;
      _txAtConnect = u.txBytes;
    }
    Diag.I.log('wg-usage: cum down=${u.txBytes} up=${u.rxBytes} | session down=$down up=$up');
    setState(() {
      _downloadTotal = down;
      _uploadTotal = up;
    });
  }

  /// Live-refresh the account (GB remaining) from the backend; persists it.
  Future<void> _refreshAccount() async {
    final token = widget.account?.token;
    if (token == null) return;
    final fresh = await AfrowsApi().fetchAccount(token);
    if (fresh == null || !mounted) return;
    setState(() => _account = fresh);
    // Persist with the CURRENT config (which _refreshConfig may have updated),
    // not the stale one we were launched with — else we'd re-cache the old one.
    await SessionStore().save(AccountSession(token: token, account: fresh), _configLink);
  }

  /// Pull a freshly-rendered WireGuard config from the server and adopt it if it
  /// changed. Guards against a stale (e.g. full-tunnel) config cached from an
  /// older login. Does NOT touch a live tunnel — the new config applies on the
  /// next connect. Best-effort: keeps the cached config if the fetch fails.
  Future<void> _refreshConfig() async {
    final token = widget.account?.token;
    if (token == null) return;
    try {
      final fresh = await AfrowsApi().firstConfigUri(token);
      if (fresh == null || fresh.isEmpty || !mounted || fresh == _configLink) return;
      Diag.I.log('config refreshed from server (${fresh.length} chars)');
      setState(() {
        _configLink = fresh;
        try {
          _remark = parseWgConf(fresh).remark;
        } catch (_) {}
      });
      await SessionStore().save(
        AccountSession(token: token, account: _account ?? widget.account!.account),
        fresh,
      );
    } catch (e) {
      Diag.I.log('config refresh failed: $e');
    }
  }

  Future<void> _loadEgressMode() async {
    final token = widget.account?.token;
    if (token == null) return;
    final mode = await AfrowsApi().fetchEgressMode(token);
    if (mounted) setState(() => _egressMode = mode);
  }

  /// Toggle the global egress mode. 'full' routes ALL traffic through the foreign
  /// bypass (for when Ireland filters the local internet too); 'smart' keeps Irelandian
  /// sites direct (fast) and sends only foreign traffic through the bypass.
  Future<void> _setEgress(bool full) async {
    final token = widget.account?.token;
    if (token == null || _egressBusy) return;
    final want = full ? 'full' : 'smart';
    setState(() => _egressBusy = true);
    final applied = await AfrowsApi().setEgressMode(token, want);
    if (!mounted) return;
    setState(() {
      _egressBusy = false;
      if (applied != null) _egressMode = applied;
    });
    Diag.I.log('egress-mode -> ${applied ?? "FAILED"}');
    if (applied == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not change bypass mode')),
      );
    }
  }

  Future<void> _loadGamingMode() async {
    final token = widget.account?.token;
    if (token == null) return;
    final g = await AfrowsApi().fetchGamingMode(token);
    if (mounted) setState(() => _gaming = g);
  }

  /// Toggle gaming (low-ping Starlink) egress. Only entitled accounts can turn it
  /// on; the server rejects otherwise. Briefly reconnects existing sessions.
  Future<void> _setGaming(bool enabled) async {
    final token = widget.account?.token;
    if (token == null || _gamingBusy) return;
    setState(() => _gamingBusy = true);
    final applied = await AfrowsApi().setGamingMode(token, enabled);
    if (!mounted) return;
    setState(() {
      _gamingBusy = false;
      if (applied != null) _gaming = applied;
    });
    Diag.I.log('gaming-mode -> ${applied?.enabled ?? "FAILED"}');
    if (applied == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not change game mode')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(
          'Game mode ${applied.enabled ? "ON (Starlink)" : "OFF (Germany)"} — wait ~30s, then Connect',
        )),
      );
    }
  }

  @override
  void dispose() {
    _accountTimer?.cancel();
    _uptimeTimer?.cancel();
    _usageTimer?.cancel();
    _statusSub?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onStatus(EngineStatus status) {
    if (!mounted) return;
    if (status.state != _state) {
      Diag.I.log('status -> ${status.state}${status.error != null ? " (${status.error})" : ""}');
      if (status.state == 'ERROR' && status.error != null) _snack(status.error!);
    }
    final connected = status.state.toUpperCase() == 'CONNECTED';
    final freshConnect = connected && !_connected; // transition into CONNECTED
    _connectedAt = connected ? (_connectedAt ?? DateTime.now()) : null;
    // Does the active engine report its own byte totals? xray (Reality/VLESS)
    // does; WireGuard reports 0 (its usage comes from the server poll).
    final engineMetered = _activeProto != null && _activeProto != VpnProtocol.wireguard;
    setState(() {
      _state = status.state;
      if (freshConnect) {
        // New session: zero the cards and drop the baseline so the next sample
        // re-snapshots. On disconnect we leave the last values frozen on screen.
        _downloadTotal = 0;
        _uploadTotal = 0;
        _rxAtConnect = null;
        _txAtConnect = null;
      }
      if (engineMetered && connected) {
        // xray reports cumulative totals; snapshot at connect, show the delta
        // (same per-session baseline logic used for the WireGuard server poll).
        _rxAtConnect ??= status.uplinkTotal;
        _txAtConnect ??= status.downlinkTotal;
        var up = status.uplinkTotal - _rxAtConnect!;
        var down = status.downlinkTotal - _txAtConnect!;
        if (up < 0) {
          up = 0;
          _rxAtConnect = status.uplinkTotal;
        }
        if (down < 0) {
          down = 0;
          _txAtConnect = status.downlinkTotal;
        }
        _uploadTotal = up;
        _downloadTotal = down;
      }
      // For WireGuard the up/down cards are owned by _pollUsage (server-metered),
      // so don't overwrite them here (the plugin reports 0 totals anyway).
      _duration = _fmtDuration(_connectedAt);
    });
  }

  Future<void> _toggle() async {
    if (_connected || _connecting) {
      Diag.I.log('Disconnect tapped');
      setState(() => _state = 'DISCONNECTED'); // immediate UI feedback
      await _controller.stop();
      return;
    }
    Diag.I.log('Connect tapped (mode=${_accountMode ? "account" : "manual"}, sel=${_selected.label})');

    // Resolve the concrete protocol + payload to connect with.
    final ProtocolConfig? cfg = await _resolveConfig();
    if (cfg == null) return; // _resolveConfig already surfaced the reason

    setState(() {
      _state = 'CONNECTING';
      _activeProto = cfg.protocol;
    });
    try {
      final ok = await _controller.start(cfg);
      Diag.I.log('start(${cfg.protocol.label}) -> $ok');
      if (!ok) {
        _snack('Allow the VPN permission, then tap Connect again');
        if (mounted) setState(() => _state = 'DISCONNECTED');
      }
    } catch (e) {
      Diag.I.log('start FAILED: $e');
      _snack('Start failed: $e');
      if (mounted) setState(() => _state = 'DISCONNECTED');
    }
  }

  /// Pick the protocol + payload for this connect. In account mode this honours
  /// the selector (Auto resolves via UDP-reachability probe with a per-network
  /// cache); in manual mode it wraps the pasted WireGuard config.
  Future<ProtocolConfig?> _resolveConfig() async {
    if (!_accountMode) {
      // Manual (BYO) mode: the pasted config is a WireGuard .conf.
      if (_configLink == null) {
        await _editConfig();
        if (_configLink == null) return null;
      }
      try {
        final c = parseWgConf(_configLink!);
        Diag.I.log('parsed WG: endpoint=${c.endpoint} address=${c.address}');
      } catch (e) {
        Diag.I.log('parse FAILED: $e');
        _snack('Invalid WireGuard config');
        return null;
      }
      return ProtocolConfig(protocol: VpnProtocol.wireguard, payload: _configLink!);
    }

    // Account mode: drive off the available protocols + selection.
    if (_avail.isEmpty) {
      _snack('No protocols available — contact your seller');
      return null;
    }
    if (_selected == VpnProtocol.auto) {
      final cached = await SessionStore().loadAutoChoice(_networkKey);
      final cfg = resolveAuto(_avail, cached: cached);
      await SessionStore().saveAutoChoice(_networkKey, cfg.protocol);
      Diag.I.log('Auto resolved -> ${cfg.protocol.label} (cached=${cached?.label})');
      return cfg;
    }
    final cfg = protocolConfigFor(_avail, _selected);
    if (cfg == null) {
      _snack('No config for ${_selected.label}');
      return null;
    }
    return cfg;
  }

  Future<void> _signOut() async {
    try {
      await _controller.stop();
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
            const Text('Paste a WireGuard config (.conf)',
                style: TextStyle(color: Colors.white54, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              maxLines: 8,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              decoration: InputDecoration(
                hintText: '[Interface]\nPrivateKey = ...\nAddress = 10.8.0.x/32\n\n[Peer]\nPublicKey = ...\nEndpoint = host:port\nAllowedIPs = 0.0.0.0/0',
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
        final parsed = parseWgConf(link);
        await _store.save(link);
        if (mounted) {
          setState(() {
            _configLink = link;
            _remark = parsed.remark;
          });
        }
      } catch (_) {
        _snack('That does not look like a valid WireGuard config');
      }
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg), backgroundColor: _panel));
  }

  /// Protocol picker: Auto + each available concrete protocol. Locked while
  /// connected/connecting (same "Disconnect to change" rule as the toggles).
  Widget _protocolSelector() {
    final locked = _connected || _connecting;
    final items = <VpnProtocol>[VpnProtocol.auto, ..._avail.map((c) => c.protocol)];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          const Icon(Icons.swap_horiz, size: 18, color: _teal),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Protocol',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text(
                  locked ? 'Disconnect to change' : 'Auto picks the best for this network',
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          ),
          DropdownButton<VpnProtocol>(
            value: _selected,
            dropdownColor: _panel,
            underline: const SizedBox.shrink(),
            style: const TextStyle(color: Colors.white, fontSize: 14),
            iconEnabledColor: _teal,
            onChanged: locked
                ? null
                : (p) async {
                    if (p == null) return;
                    setState(() => _selected = p);
                    await SessionStore().saveProtocol(p);
                  },
            items: items
                .map((p) => DropdownMenuItem(value: p, child: Text(p.label)))
                .toList(),
          ),
        ],
      ),
    );
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
                      Text('Connected · ${(_activeProto ?? _selected).label}',
                          style: const TextStyle(color: Colors.white54, fontSize: 12)),
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
                            total: _fmtBytes(_downloadTotal),
                            color: _teal,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            icon: Icons.north,
                            label: 'Upload',
                            total: _fmtBytes(_uploadTotal),
                            color: const Color(0xFF6C8CFF),
                          ),
                        ),
                      ],
                    ),
                    if (_accountMode) ...[
                      if (_avail.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _protocolSelector(),
                      ],
                      const SizedBox(height: 12),
                      _BypassToggle(
                        full: _egressMode == 'full',
                        busy: _egressBusy,
                        locked: _connected || _connecting,
                        onChanged: _setEgress,
                      ),
                      if (_gaming.entitled) ...[
                        const SizedBox(height: 12),
                        _GamingToggle(
                          enabled: _gaming.enabled,
                          busy: _gamingBusy,
                          locked: _connected || _connecting,
                          onChanged: _setGaming,
                        ),
                      ],
                    ],
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

String _fmtDuration(DateTime? since) {
  if (since == null) return '00:00:00';
  final d = DateTime.now().difference(since);
  final h = d.inHours.toString().padLeft(2, '0');
  final m = (d.inMinutes % 60).toString().padLeft(2, '0');
  final s = (d.inSeconds % 60).toString().padLeft(2, '0');
  return '$h:$m:$s';
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
    required this.total,
    required this.color,
  });
  final IconData icon;
  final String label;
  final String total; // cumulative session usage (size)
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
          Text(total,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

/// Global "filtering bypass" toggle. OFF = Smart (Ireland sites direct/fast, foreign
/// via the bypass). ON = Full (everything via the bypass — for when Ireland filters
/// the local internet too).
class _BypassToggle extends StatelessWidget {
  const _BypassToggle({required this.full, required this.busy, required this.locked, required this.onChanged});
  final bool full;
  final bool busy;
  final bool locked; // can't change while connected (it restarts the egress engine)
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Icon(full ? Icons.public : Icons.alt_route, size: 18, color: _teal),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Full bypass',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text(
                  locked
                      ? 'Disconnect to change'
                      : (full ? 'All traffic via the bypass' : 'Smart: Ireland direct, foreign via bypass'),
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          ),
          busy
              ? const SizedBox(
                  width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _teal))
              : Switch(
                  value: full,
                  activeThumbColor: _teal,
                  onChanged: locked ? null : onChanged,
                ),
        ],
      ),
    );
  }
}

/// Gaming-mode toggle, shown only to entitled accounts. ON routes foreign traffic
/// through the low-ping Starlink path (Ireland stays direct).
class _GamingToggle extends StatelessWidget {
  const _GamingToggle({required this.enabled, required this.busy, required this.locked, required this.onChanged});
  final bool enabled;
  final bool busy;
  final bool locked; // can't change while connected (it restarts the egress engine)
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Icon(Icons.sports_esports, size: 18, color: _teal),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Game mode',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text(
                  locked
                      ? 'Disconnect to change'
                      : (enabled ? 'Low-ping route on' : 'Lower ping for gaming'),
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          ),
          busy
              ? const SizedBox(
                  width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _teal))
              : Switch(
                  value: enabled,
                  activeThumbColor: _teal,
                  onChanged: locked ? null : onChanged,
                ),
        ],
      ),
    );
  }
}
