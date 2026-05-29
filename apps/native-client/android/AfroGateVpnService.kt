package com.afrogate.client

import android.content.pm.PackageManager
import android.net.VpnService

data class SplitTunnelApp(
  val id: String,
  val label: String,
  val androidPackage: String?,
)

data class SplitTunnelProfile(
  val mode: String,
  val selectedApps: List<SplitTunnelApp>,
)

class AfroGateVpnService : VpnService() {
  fun applySplitTunnel(builder: Builder, profile: SplitTunnelProfile): List<String> {
    if (profile.mode != "selected_apps") return emptyList()

    val rejectedPackages = mutableListOf<String>()
    for (app in profile.selectedApps) {
      val packageName = app.androidPackage?.trim().orEmpty()
      if (packageName.isEmpty()) continue

      try {
        builder.addAllowedApplication(packageName)
      } catch (error: PackageManager.NameNotFoundException) {
        rejectedPackages += packageName
      }
    }

    return rejectedPackages
  }
}
