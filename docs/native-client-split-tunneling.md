# Native Client Per-App VPN Split Tunneling

AfroGate per-app VPN selection is a native-client responsibility. The control plane may provide client-scoped route and subscription data, but installed-app inventories, traffic contents, destination history, and non-selected apps must stay off the backend.

## Supported Boundary

- Android native clients can enforce include-only VPN routing with `VpnService.Builder.addAllowedApplication(packageName)`.
- iOS per-app VPN is a managed configuration capability. A normal consumer VPN app must not claim it can silently force arbitrary third-party apps into per-app VPN without the platform-managed profile path.
- The web client stores the selected app list locally and can copy a native profile JSON for a future native client/import path.
- The copied profile contains only explicitly selected apps, client config id, route group, and privacy flags.

## Default User Flow

1. User signs in to the AfroGate client surface with a client token.
2. User chooses `Selected apps` and keeps or changes apps such as Instagram, Telegram, WhatsApp, Chrome, Firefox, or YouTube.
3. Native Android client applies the selected Android package names through the VPN service builder.
4. Native iOS deployment uses a managed per-app VPN profile when available.
5. Apps outside the selected list stay on normal internet for include-only mode.

## Privacy Rules

- Do not upload installed-app inventory.
- Do not store non-selected apps.
- Do not infer app choice from traffic.
- Do not inspect DNS, destinations, or packet payloads to classify apps.
- Keep app selection local to the client device unless the user explicitly exports/imports a profile.

## Native Profile Shape

```json
{
  "version": 1,
  "generatedAt": "2026-05-29T00:00:00.000Z",
  "clientConfigId": "client-config-id",
  "routeGroup": "main",
  "mode": "selected_apps",
  "selectedApps": [
    {
      "id": "telegram",
      "label": "Telegram",
      "androidPackage": "org.telegram.messenger",
      "iosBundleId": "ph.telegra.Telegraph"
    }
  ],
  "privacy": {
    "localOnly": true,
    "installedAppInventoryShared": false,
    "trafficDestinationsShared": false
  },
  "nativeTargets": {
    "androidVpnService": true,
    "iosManagedPerAppVpn": true
  }
}
```
