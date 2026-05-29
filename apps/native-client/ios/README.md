# iOS Per-App VPN Notes

iOS per-app VPN is controlled through managed configuration profiles, usually from MDM. A normal consumer VPN app should not claim it can silently force arbitrary third-party apps into per-app VPN mode.

AfroGate's native profile can carry selected bundle identifiers for managed deployments, but enforcement belongs to the platform-managed per-app VPN configuration path.

Privacy boundary:

- Do not enumerate installed apps.
- Do not upload app inventories.
- Do not infer app choices from destinations or DNS.
- Import only apps explicitly selected by the user or managed deployment.
