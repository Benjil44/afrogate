import 'package:flutter/foundation.dart';

/// In-app diagnostics log. Captures connect steps, status changes, and errors
/// so issues can be seen on-device (and copied) without a USB/logcat hookup.
class Diag {
  Diag._();
  static final Diag I = Diag._();

  final ValueNotifier<List<String>> lines = ValueNotifier<List<String>>(<String>[]);

  void log(String message) {
    final ts = DateTime.now().toIso8601String().substring(11, 19);
    final next = <String>[...lines.value, '$ts  $message'];
    if (next.length > 400) next.removeRange(0, next.length - 400);
    lines.value = next;
    debugPrint('[AfrowsDiag] $message');
  }

  void clear() => lines.value = <String>[];

  String dump() => lines.value.join('\n');
}
