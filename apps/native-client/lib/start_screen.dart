import 'package:flutter/material.dart';

import 'app_version.dart';
import 'connect_screen.dart';
import 'login_screen.dart';

const _teal = Color(0xFF18B6A6);
const _line = Color(0xFF24302F);

/// First screen: "Do you have an Afrows account?" → login (account mode) or
/// bring-your-own vless (the self-serve connect screen).
class StartScreen extends StatelessWidget {
  const StartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Afrows',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, letterSpacing: 1)),
              const SizedBox(height: 8),
              const Text('Fast, stable, unfiltered',
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.white54)),
              const SizedBox(height: 48),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: _teal,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                ),
                child: const Text('I have an account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  side: const BorderSide(color: _line),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ConnectScreen()),
                ),
                child: const Text('Use my own config',
                    style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              const SizedBox(height: 28),
              Text('Afrows v$kAppVersion  ·  $kBuildTag',
                  textAlign: TextAlign.center, style: const TextStyle(color: Colors.white24, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
