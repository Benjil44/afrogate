import 'package:flutter/material.dart';

import 'api.dart';
import 'connect_screen.dart';
import 'vpn_config.dart';

const _teal = Color(0xFF18B6A6);
const _line = Color(0xFF24302F);

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = AfrowsApi();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    final id = _identifier.text.trim();
    final pw = _password.text;
    if (id.isEmpty || pw.isEmpty) {
      setState(() => _error = 'Enter your email/username and password');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await _api.login(id, pw);
      final configUri = await _api.firstConfigUri(session.token);
      await SessionStore().save(session, configUri); // stay signed in after close
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => ConnectScreen(account: session, accountConfigUri: configUri)),
      );
    } on AfrowsApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not reach the server. Check your connection.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('Sign in')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              const Text('Use the email/username and password your seller gave you.',
                  style: TextStyle(color: Colors.white54)),
              const SizedBox(height: 20),
              TextField(
                controller: _identifier,
                autocorrect: false,
                enableSuggestions: false,
                keyboardType: TextInputType.emailAddress,
                decoration: _dec('Email or username'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: _dec('Password'),
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!, style: const TextStyle(color: Color(0xFFf08a8a), fontWeight: FontWeight.bold)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: _teal,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Sign in', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        filled: true,
        fillColor: const Color(0xFF12201F),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _line)),
        enabledBorder:
            OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _line)),
      );

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }
}
