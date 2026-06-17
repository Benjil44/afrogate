import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_version.dart';
import 'diag.dart';

/// On-device diagnostics log viewer (copyable). Opened from the connect screen.
class DiagScreen extends StatelessWidget {
  const DiagScreen({super.key});

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
      body: ValueListenableBuilder<List<String>>(
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
    );
  }
}
