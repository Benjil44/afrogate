import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'connect_screen.dart';
import 'start_screen.dart';
import 'vpn_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const AfrowsApp());
}

class AfrowsApp extends StatelessWidget {
  const AfrowsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Afrows VPN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B1416),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF18B6A6),
          brightness: Brightness.dark,
        ),
      ),
      home: const _RootGate(),
    );
  }
}

/// Decides the first screen: restore a saved session (stay signed in) or show
/// the start screen.
class _RootGate extends StatefulWidget {
  const _RootGate();

  @override
  State<_RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<_RootGate> {
  late final Future<(AccountSession, String?)?> _session = SessionStore().load();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<(AccountSession, String?)?>(
      future: _session,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF18B6A6))));
        }
        final saved = snap.data;
        if (saved != null) {
          return ConnectScreen(account: saved.$1, accountConfigUri: saved.$2);
        }
        return const StartScreen();
      },
    );
  }
}
