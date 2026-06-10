package com.afrows.afrows_vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "afrows/vpn"
    private val eventsName = "afrows/vpn/status"
    private val vpnRequest = 0x0f01
    private var pendingPrepare: MethodChannel.Result? = null
    private var pendingConfig: String? = null
    private val main = Handler(Looper.getMainLooper())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val config = call.argument<String>("config")
                    if (config.isNullOrEmpty()) {
                        result.error("no_config", "config required", null)
                    } else {
                        val prep = VpnService.prepare(this)
                        if (prep != null) {
                            pendingPrepare = result
                            pendingConfig = config
                            startActivityForResult(prep, vpnRequest)
                        } else {
                            startVpn(config)
                            result.success(true)
                        }
                    }
                }
                "stop" -> {
                    startService(Intent(this, AfrowsVpnService::class.java).setAction(AfrowsVpnService.ACTION_STOP))
                    result.success(true)
                }
                "isRunning" -> result.success(AfrowsVpnService.running)
                else -> result.notImplemented()
            }
        }
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, eventsName).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    AfrowsVpnService.statusSink = { map -> main.post { events?.success(map) } }
                }
                override fun onCancel(arguments: Any?) {
                    AfrowsVpnService.statusSink = null
                }
            },
        )
    }

    private fun startVpn(config: String) {
        val intent = Intent(this, AfrowsVpnService::class.java)
            .setAction(AfrowsVpnService.ACTION_START)
            .putExtra(AfrowsVpnService.EXTRA_CONFIG, config)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == vpnRequest) {
            val r = pendingPrepare
            pendingPrepare = null
            if (resultCode == Activity.RESULT_OK) {
                pendingConfig?.let { startVpn(it) }
                r?.success(true)
            } else {
                r?.success(false)
            }
            pendingConfig = null
        }
    }
}
