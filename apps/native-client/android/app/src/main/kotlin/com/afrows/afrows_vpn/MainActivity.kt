package com.afrows.afrows_vpn

import io.flutter.embedding.android.FlutterActivity

// VPN is handled entirely by the wireguard_flutter plugin (native
// com.wireguard.android GoBackend + its own VpnService), which auto-registers
// via GeneratedPluginRegistrant. No custom MethodChannel/VpnService wiring is
// needed here. The plugin casts the host Activity to FlutterActivity, so this
// must extend FlutterActivity.
class MainActivity : FlutterActivity()
