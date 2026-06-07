import 'package:flutter/material.dart';

import 'start_screen.dart';

void main() => runApp(const AfrowsApp());

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
      home: const StartScreen(),
    );
  }
}
