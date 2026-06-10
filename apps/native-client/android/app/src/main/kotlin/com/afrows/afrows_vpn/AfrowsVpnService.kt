package com.afrows.afrows_vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import io.nekohasekai.libbox.CommandClient
import io.nekohasekai.libbox.CommandClientHandler
import io.nekohasekai.libbox.CommandClientOptions
import io.nekohasekai.libbox.CommandServer
import io.nekohasekai.libbox.CommandServerHandler
import io.nekohasekai.libbox.ConnectionEvents
import io.nekohasekai.libbox.ExchangeContext
import io.nekohasekai.libbox.InterfaceUpdateListener
import io.nekohasekai.libbox.Libbox
import io.nekohasekai.libbox.LocalDNSTransport
import io.nekohasekai.libbox.LogIterator
import io.nekohasekai.libbox.NetworkInterface as LibboxNetworkInterface
import io.nekohasekai.libbox.NetworkInterfaceIterator
import io.nekohasekai.libbox.Notification as LibboxNotification
import io.nekohasekai.libbox.OutboundGroupIterator
import io.nekohasekai.libbox.PlatformInterface
import io.nekohasekai.libbox.SetupOptions
import io.nekohasekai.libbox.StatusMessage
import io.nekohasekai.libbox.StringIterator
import io.nekohasekai.libbox.SystemProxyStatus
import io.nekohasekai.libbox.TunOptions
import io.nekohasekai.libbox.WIFIState
import java.io.File
import java.net.Inet6Address
import java.net.NetworkInterface as JavaNetworkInterface

/**
 * Native VpnService running sing-box via libbox. Replaces flutter_v2ray.
 * Implements PlatformInterface (tun + interface info) and CommandServerHandler.
 */
class AfrowsVpnService : VpnService(), PlatformInterface, CommandServerHandler {

    companion object {
        const val ACTION_START = "com.afrows.afrows_vpn.START"
        const val ACTION_STOP = "com.afrows.afrows_vpn.STOP"
        const val EXTRA_CONFIG = "config"
        private const val NOTIF_CHANNEL = "afrows_vpn"
        private const val NOTIF_ID = 0x4146 // "AF"

        /** Pushed status maps go here (set by MainActivity's EventChannel). */
        @Volatile
        var statusSink: ((Map<String, Any?>) -> Unit)? = null

        @Volatile
        var running: Boolean = false
    }

    private var commandServer: CommandServer? = null
    private var commandClient: CommandClient? = null
    private var tunFd: ParcelFileDescriptor? = null
    @Volatile private var defaultListener: InterfaceUpdateListener? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopEverything()
                return START_NOT_STICKY
            }
            else -> {
                val config = intent?.getStringExtra(EXTRA_CONFIG)
                if (config.isNullOrEmpty()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                goForeground("Connecting…")
                Thread { startBox(config) }.start()
            }
        }
        return START_STICKY
    }

    private fun startBox(config: String) {
        try {
            val base = filesDir.absolutePath
            File("$base/work").mkdirs()
            Libbox.setup(SetupOptions().apply {
                basePath = base
                workingPath = "$base/work"
                tempPath = cacheDir.absolutePath
                fixAndroidStack = true
                logMaxLines = 200
            })
            val server = CommandServer(this, this)
            server.start()
            commandServer = server
            server.startOrReloadService(config, null)
            commandServer = server
            running = true
            startStatusClient()
            pushStatus(mapOf("state" to "CONNECTED"))
            updateNotification("Connected")
        } catch (e: Exception) {
            pushStatus(mapOf("state" to "ERROR", "error" to (e.message ?: "start failed")))
            stopEverything()
        }
    }

    private fun startStatusClient() {
        try {
            val opts = CommandClientOptions().apply {
                addCommand(Libbox.CommandStatus)
                statusInterval = 1_000_000_000L // 1s in ns
            }
            val client = CommandClient(object : CommandClientHandler {
                override fun connected() { pushStatus(mapOf("state" to "CONNECTED")) }
                override fun disconnected(message: String?) {}
                override fun clearLogs() {}
                override fun initializeClashMode(modeList: StringIterator?, currentMode: String?) {}
                override fun setDefaultLogLevel(level: Int) {}
                override fun updateClashMode(mode: String?) {}
                override fun writeConnectionEvents(message: ConnectionEvents?) {}
                override fun writeGroups(message: OutboundGroupIterator?) {}
                override fun writeLogs(messageList: LogIterator?) {}
                override fun writeStatus(message: StatusMessage?) {
                    if (message == null) return
                    pushStatus(
                        mapOf(
                            "state" to "CONNECTED",
                            "uplink" to message.uplink,
                            "downlink" to message.downlink,
                            "uplinkTotal" to message.uplinkTotal,
                            "downlinkTotal" to message.downlinkTotal,
                        )
                    )
                }
            }, opts)
            client.connect()
            commandClient = client
        } catch (_: Exception) {
            // stats are best-effort
        }
    }

    private fun stopEverything() {
        running = false
        try { commandClient?.disconnect() } catch (_: Exception) {}
        try { commandServer?.closeService() } catch (_: Exception) {}
        try { commandServer?.close() } catch (_: Exception) {}
        commandClient = null
        commandServer = null
        try { networkCallback?.let { (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(it) } } catch (_: Exception) {}
        networkCallback = null
        try { tunFd?.close() } catch (_: Exception) {}
        tunFd = null
        pushStatus(mapOf("state" to "DISCONNECTED"))
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopEverything()
        super.onDestroy()
    }

    private fun pushStatus(map: Map<String, Any?>) {
        try { statusSink?.invoke(map) } catch (_: Exception) {}
    }

    // ---------------- PlatformInterface ----------------

    override fun openTun(options: TunOptions): Int {
        val builder = Builder()
        builder.setMtu(options.getMTU())
        builder.setSession("Afrows")

        val inet4 = options.inet4Address
        while (inet4.hasNext()) { val p = inet4.next(); builder.addAddress(p.address(), p.prefix()) }
        val inet6 = options.inet6Address
        while (inet6.hasNext()) { val p = inet6.next(); builder.addAddress(p.address(), p.prefix()) }

        if (options.autoRoute) {
            val r4 = options.inet4RouteAddress
            if (r4.hasNext()) { while (r4.hasNext()) { val p = r4.next(); builder.addRoute(p.address(), p.prefix()) } }
            else { builder.addRoute("0.0.0.0", 0) }
            val r6 = options.inet6RouteAddress
            if (r6.hasNext()) { while (r6.hasNext()) { val p = r6.next(); builder.addRoute(p.address(), p.prefix()) } }
        }

        try { builder.addDnsServer(options.getDNSServerAddress().value) } catch (_: Exception) {}

        // per-app routing (don't tunnel our own app to avoid loops on the API calls)
        try {
            val incl = options.includePackage
            var any = false
            while (incl.hasNext()) { builder.addAllowedApplication(incl.next()); any = true }
            if (!any) {
                val excl = options.excludePackage
                while (excl.hasNext()) { try { builder.addDisallowedApplication(excl.next()) } catch (_: Exception) {} }
            }
        } catch (_: Exception) {}
        try { builder.addDisallowedApplication(packageName) } catch (_: Exception) {}

        builder.setBlocking(false)
        val pfd = builder.establish() ?: throw IllegalStateException("VpnService.establish() returned null")
        tunFd = pfd
        return pfd.fd
    }

    override fun autoDetectInterfaceControl(fd: Int) {
        protect(fd) // CRITICAL: keep egress sockets off the tun (no loop)
    }

    override fun usePlatformAutoDetectInterfaceControl(): Boolean = true

    override fun useProcFS(): Boolean = false

    override fun findConnectionOwner(ipProto: Int, srcIp: String?, srcPort: Int, destIp: String?, destPort: Int) =
        throw UnsupportedOperationException("findConnectionOwner")

    override fun includeAllNetworks(): Boolean = false

    override fun localDNSTransport(): LocalDNSTransport? = null

    override fun readWIFIState(): WIFIState? = null

    override fun sendNotification(notification: LibboxNotification?) {}

    override fun clearDNSCache() {}

    override fun systemCertificates(): StringIterator? = null

    override fun underNetworkExtension(): Boolean = false

    override fun getInterfaces(): NetworkInterfaceIterator {
        val list = ArrayList<LibboxNetworkInterface>()
        for (iface in JavaNetworkInterface.getNetworkInterfaces()) {
            if (!iface.isUp) continue
            val item = LibboxNetworkInterface()
            item.name = iface.name
            item.index = iface.index
            try { item.setMTU(iface.mtu) } catch (_: Exception) {}
            val addrs = ArrayList<String>()
            for (a in iface.interfaceAddresses) {
                val host = a.address.hostAddress ?: continue
                addrs.add("$host/${a.networkPrefixLength}")
            }
            item.addresses = StringList(addrs)
            item.type = Libbox.InterfaceTypeOther
            list.add(item)
        }
        return InterfaceList(list)
    }

    override fun startDefaultInterfaceMonitor(listener: InterfaceUpdateListener) {
        defaultListener = listener
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { notifyDefault(cm, network) }
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) { notifyDefault(cm, network) }
            override fun onLost(network: Network) {
                try { listener.updateDefaultInterface("", -1, false, false) } catch (_: Exception) {}
            }
        }
        networkCallback = cb
        try { cm.registerDefaultNetworkCallback(cb) } catch (_: Exception) {}
        cm.activeNetwork?.let { notifyDefault(cm, it) }
    }

    private fun notifyDefault(cm: ConnectivityManager, network: Network) {
        val listener = defaultListener ?: return
        try {
            val linkProps = cm.getLinkProperties(network) ?: return
            val name = linkProps.interfaceName ?: return
            val index = JavaNetworkInterface.getByName(name)?.index ?: -1
            listener.updateDefaultInterface(name, index, false, false)
        } catch (_: Exception) {}
    }

    override fun closeDefaultInterfaceMonitor(listener: InterfaceUpdateListener) {
        defaultListener = null
        try { networkCallback?.let { (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(it) } } catch (_: Exception) {}
        networkCallback = null
    }

    // ---------------- CommandServerHandler ----------------

    override fun serviceReload() {}
    override fun serviceStop() { stopEverything() }
    override fun getSystemProxyStatus(): SystemProxyStatus = SystemProxyStatus().apply { available = false; enabled = false }
    override fun setSystemProxyEnabled(isEnabled: Boolean) {}
    override fun writeDebugMessage(message: String?) {}

    // ---------------- notification ----------------

    private fun goForeground(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel(NOTIF_CHANNEL, "Afrows VPN", NotificationManager.IMPORTANCE_LOW))
        }
        val notif = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): Notification {
        val pi = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(this, NOTIF_CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setContentTitle("Afrows VPN")
            .setContentText(text)
            .setSmallIcon(applicationInfo.icon)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }
}

/** libbox StringIterator backed by a Kotlin list. */
private class StringList(private val items: List<String>) : StringIterator {
    private var i = 0
    override fun hasNext(): Boolean = i < items.size
    override fun next(): String = items[i++]
    override fun len(): Int = items.size
}

/** libbox NetworkInterfaceIterator backed by a Kotlin list. */
private class InterfaceList(private val items: List<io.nekohasekai.libbox.NetworkInterface>) : NetworkInterfaceIterator {
    private var i = 0
    override fun hasNext(): Boolean = i < items.size
    override fun next(): io.nekohasekai.libbox.NetworkInterface = items[i++]
}
