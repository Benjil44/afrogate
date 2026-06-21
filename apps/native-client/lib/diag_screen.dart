import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';

import 'app_version.dart';
import 'diag.dart';

/// On-device diagnostics log viewer (copyable). Opened from the connect screen.
///
/// TEMPORARY (Phase 0 spike): also hosts a "VLESS test" harness that lets the
/// operator paste a known-good vless:// URI and connect through flutter_v2ray
/// (xray-core in-app) to prove VLESS/Reality works on a real device before we
/// build the full protocol-selector feature. Remove once the spike is done.
class DiagScreen extends StatefulWidget {
  const DiagScreen({super.key});

  @override
  State<DiagScreen> createState() => _DiagScreenState();
}

class _DiagScreenState extends State<DiagScreen> {
  final TextEditingController _uriCtrl = TextEditingController();

  // Phase 0 spike: xray-core engine. Created once; status pushed to the diag log.
  late final FlutterV2ray _v2 = FlutterV2ray(
    onStatusChanged: (s) {
      Diag.I.log('v2ray ${s.state} up=${s.upload} down=${s.download}');
    },
  );
  bool _v2Initialized = false;

  @override
  void dispose() {
    _uriCtrl.dispose();
    super.dispose();
  }

  Future<void> _connectV2() async {
    final uri = _uriCtrl.text.trim();
    if (uri.isEmpty) {
      Diag.I.log('v2ray test: paste a vless:// URI first');
      return;
    }
    try {
      if (!_v2Initialized) {
        await _v2.initializeV2Ray();
        _v2Initialized = true;
        Diag.I.log('v2ray initialized');
      }
      final parser = FlutterV2ray.parseFromURL(uri);
      Diag.I.log('v2ray parsed remark=${parser.remark}');
      if (await _v2.requestPermission()) {
        await _v2.startV2Ray(
          remark: parser.remark,
          config: parser.getFullConfiguration(),
          proxyOnly: false,
        );
        Diag.I.log('v2ray startV2Ray requested');
      } else {
        Diag.I.log('v2ray: VPN permission denied');
      }
    } catch (e) {
      Diag.I.log('v2ray ERROR: $e');
    }
  }

  Future<void> _stopV2() async {
    try {
      await _v2.stopV2Ray();
      Diag.I.log('v2ray stop requested');
    } catch (e) {
      Diag.I.log('v2ray stop ERROR: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Diagnostics  ·  v$kAppVersion'),
        actions: [
          IconButton(
            tooltip: 'Copy logs',
            icon: const Icon(Icons.copy),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: Diag.I.dump()));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Logs copied to clipboard')));
              }
            },
          ),
          IconButton(tooltip: 'Clear', icon: const Icon(Icons.delete_outline), onPressed: Diag.I.clear),
        ],
      ),
      body: Column(
        children: [
          // TEMPORARY Phase 0 VLESS test harness.
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('VLESS test (xray-core)',
                    style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                TextField(
                  controller: _uriCtrl,
                  minLines: 1,
                  maxLines: 3,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                  decoration: const InputDecoration(
                    hintText: 'Paste vless:// URI',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _connectV2,
                        child: const Text('Connect (v2ray test)'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: _stopV2,
                      child: const Text('Stop'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ValueListenableBuilder<List<String>>(
              valueListenable: Diag.I.lines,
              builder: (context, lines, _) {
                if (lines.isEmpty) {
                  return const Center(
                    child: Text('No logs yet.\nGo back and tap Connect.',
                        textAlign: TextAlign.center, style: TextStyle(color: Colors.white54)),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: lines.length,
                  itemBuilder: (context, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: SelectableText(
                      lines[i],
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12, height: 1.3, color: Colors.white70),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
