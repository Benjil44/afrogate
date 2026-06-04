from __future__ import annotations

import ctypes
import hashlib
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

IGNORED_FILESYSTEMS = {
    "autofs",
    "binfmt_misc",
    "cgroup",
    "cgroup2",
    "configfs",
    "debugfs",
    "devpts",
    "devtmpfs",
    "fusectl",
    "hugetlbfs",
    "mqueue",
    "nsfs",
    "overlay",
    "proc",
    "pstore",
    "rpc_pipefs",
    "securityfs",
    "squashfs",
    "sysfs",
    "tmpfs",
    "tracefs",
}


PING_TIME_PATTERN = re.compile(r"time(?P<operator>[=<])\s*(?P<value>\d+(?:\.\d+)?)\s*ms", re.IGNORECASE)
WINDOWS_PACKET_PATTERN = re.compile(
    r"Sent\s*=\s*(?P<sent>\d+),\s*Received\s*=\s*(?P<received>\d+),\s*Lost\s*=\s*(?P<lost>\d+)\s*\((?P<loss>\d+(?:\.\d+)?)%\s*loss\)",
    re.IGNORECASE,
)
UNIX_PACKET_PATTERN = re.compile(
    r"(?P<sent>\d+)\s+packets transmitted,\s*(?P<received>\d+)(?:\s+packets)?\s+received.*?(?P<loss>\d+(?:\.\d+)?)%\s+packet loss",
    re.IGNORECASE,
)
SAFE_PING_TARGET_PATTERN = re.compile(r"[A-Za-z0-9_.:\-\[\]]{1,253}")
SAFE_ROUTE_HOST_PATTERN = re.compile(r"[A-Za-z0-9_.:\-\[\]]{1,253}")
ROUTE_PROBE_PAYLOAD = b"afrows-route-probe\n"


def collect_metrics(
    agent_id: str,
    state_file: str | None = None,
    ping_targets: tuple[str, ...] | list[str] | None = None,
    ping_count: int = 3,
    ping_timeout_seconds: int = 2,
    tcp_probe_targets: tuple[str, ...] | list[str] | None = None,
    udp_probe_targets: tuple[str, ...] | list[str] | None = None,
    quic_probe_targets: tuple[str, ...] | list[str] | None = None,
    dns_probe_targets: tuple[str, ...] | list[str] | None = None,
    mtu_probe_targets: tuple[str, ...] | list[str] | None = None,
    route_probe_count: int = 2,
    route_probe_timeout_seconds: int = 2,
    route_probe_mtu_min_bytes: int = 1280,
    route_probe_mtu_max_bytes: int = 1500,
    route_probe_tunnel_overhead_bytes: int = 80,
    route_probe_configured_mtu_bytes: int | None = None,
    route_probe_metadata: dict[str, str | None] | None = None,
) -> dict[str, object]:
    now = time.time()
    previous_state = _load_state(state_file)
    network_interfaces, inbound_bps, outbound_bps, next_state = _collect_network_interfaces(previous_state, now)
    wireguard_interfaces, wireguard_state = _collect_wireguard_interfaces(previous_state, now)
    ping_ms, jitter_ms, packet_loss_percent = _collect_ping_probe(
        ping_targets or (),
        ping_count,
        ping_timeout_seconds,
    )
    route_probes = _collect_route_probes(
        tcp_probe_targets or (),
        udp_probe_targets or (),
        quic_probe_targets or (),
        dns_probe_targets or (),
        mtu_probe_targets or (),
        wireguard_interfaces,
        route_probe_count,
        route_probe_timeout_seconds,
        route_probe_mtu_min_bytes,
        route_probe_mtu_max_bytes,
        route_probe_tunnel_overhead_bytes,
        route_probe_configured_mtu_bytes,
        route_probe_metadata,
    )
    storages = _collect_storages()

    next_state["wireGuard"] = wireguard_state
    _save_state(state_file, next_state)

    return {
        "serverId": agent_id,
        "hostname": socket.gethostname(),
        "cpuPercent": _load_average_percent(),
        "ramPercent": _memory_percent(),
        "diskFreePercent": _lowest_disk_free_percent(storages),
        "storages": storages,
        "networkInterfaces": network_interfaces,
        "wireGuardInterfaces": wireguard_interfaces,
        "routeProbes": route_probes,
        "inboundBps": inbound_bps,
        "outboundBps": outbound_bps,
        "pingMs": ping_ms,
        "jitterMs": jitter_ms,
        "packetLossPercent": packet_loss_percent,
        "platform": platform.platform(),
    }


def _load_average_percent() -> float | None:
    try:
        load_1m = os.getloadavg()[0]
    except (AttributeError, OSError):
        return None

    cpu_count = os.cpu_count() or 1
    return round(min(100, (load_1m / cpu_count) * 100), 2)


def _memory_percent() -> float | None:
    meminfo_path = Path("/proc/meminfo")

    if meminfo_path.exists():
        values: dict[str, int] = {}
        for line in meminfo_path.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition(":")
            parts = value.strip().split()
            if parts:
                values[key] = int(parts[0]) * 1024

        total = values.get("MemTotal")
        available = values.get("MemAvailable")
        if total and available is not None:
            return round(((total - available) / total) * 100, 2)

    if platform.system().lower() == "windows":
        return _windows_memory_percent()

    return None


def _windows_memory_percent() -> float | None:
    class MemoryStatus(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    status = MemoryStatus()
    status.dwLength = ctypes.sizeof(MemoryStatus)

    if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return float(status.dwMemoryLoad)

    return None


def _collect_storages() -> list[dict[str, object]]:
    if platform.system().lower() == "windows":
        return _collect_windows_storages()

    mounts_path = Path("/proc/mounts")
    if not mounts_path.exists():
        return [_storage_payload("/", None, None)]

    storages: list[dict[str, object]] = []
    seen_paths: set[str] = set()

    for line in mounts_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue

        device, mount_path, filesystem = parts[:3]
        mount_path = mount_path.replace("\\040", " ")

        if filesystem in IGNORED_FILESYSTEMS or mount_path in seen_paths:
            continue

        payload = _storage_payload(mount_path, device, filesystem)
        if payload:
            seen_paths.add(mount_path)
            storages.append(payload)

    return storages or [_storage_payload("/", None, None)]


def _collect_windows_storages() -> list[dict[str, object]]:
    storages: list[dict[str, object]] = []

    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        path = f"{letter}:\\"
        if not Path(path).exists():
            continue

        payload = _storage_payload(path, path, "windows")
        if payload:
            storages.append(payload)

    return storages


def _storage_payload(path: str, device: str | None, filesystem: str | None) -> dict[str, object]:
    try:
        usage = shutil.disk_usage(path)
    except OSError:
        return {}

    free_percent = round((usage.free / usage.total) * 100, 2) if usage.total else None
    used_percent = round(100 - free_percent, 2) if free_percent is not None else None

    return {
        "path": path,
        "device": device,
        "filesystem": filesystem,
        "totalBytes": usage.total,
        "freeBytes": usage.free,
        "usedPercent": used_percent,
        "freePercent": free_percent,
    }


def _lowest_disk_free_percent(storages: list[dict[str, object]]) -> float | None:
    values = [
        storage["freePercent"]
        for storage in storages
        if isinstance(storage.get("freePercent"), (float, int))
    ]

    return float(min(values)) if values else None


def _collect_network_interfaces(
    previous_state: dict[str, Any],
    now: float,
) -> tuple[list[dict[str, object]], float | None, float | None, dict[str, Any]]:
    counters = _read_network_counters()
    previous_timestamp = previous_state.get("timestamp")
    previous_interfaces = previous_state.get("interfaces", {})
    elapsed = now - previous_timestamp if isinstance(previous_timestamp, (float, int)) else None
    interfaces: list[dict[str, object]] = []
    total_rx_bps = 0.0
    total_tx_bps = 0.0
    has_rates = False

    for name, values in counters.items():
        previous = previous_interfaces.get(name, {}) if isinstance(previous_interfaces, dict) else {}
        rx_bps = _rate(values["rxBytes"], previous.get("rxBytes"), elapsed)
        tx_bps = _rate(values["txBytes"], previous.get("txBytes"), elapsed)

        if rx_bps is not None:
            total_rx_bps += rx_bps
            has_rates = True
        if tx_bps is not None:
            total_tx_bps += tx_bps
            has_rates = True

        interfaces.append({
            "name": name,
            "rxBytes": values["rxBytes"],
            "txBytes": values["txBytes"],
            "rxBps": rx_bps,
            "txBps": tx_bps,
        })

    return (
        interfaces,
        round(total_rx_bps, 2) if has_rates else None,
        round(total_tx_bps, 2) if has_rates else None,
        {"timestamp": now, "interfaces": counters},
    )


def _read_network_counters() -> dict[str, dict[str, int]]:
    netdev_path = Path("/proc/net/dev")
    if not netdev_path.exists():
        return {}

    counters: dict[str, dict[str, int]] = {}

    for line in netdev_path.read_text(encoding="utf-8").splitlines()[2:]:
        if ":" not in line:
            continue

        name, values = line.split(":", 1)
        name = name.strip()
        if name == "lo":
            continue

        fields = values.split()
        if len(fields) < 16:
            continue

        counters[name] = {
            "rxBytes": int(fields[0]),
            "txBytes": int(fields[8]),
        }

    return counters


def _collect_wireguard_interfaces(
    previous_state: dict[str, Any],
    now: float,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    dump = _read_wireguard_dump()
    if not dump:
        return [], {"interfaces": {}}

    previous_timestamp = previous_state.get("timestamp")
    elapsed = now - previous_timestamp if isinstance(previous_timestamp, (float, int)) else None
    previous_wireguard = previous_state.get("wireGuard", {})
    previous_interfaces = (
        previous_wireguard.get("interfaces", {})
        if isinstance(previous_wireguard, dict)
        else {}
    )
    interfaces: dict[str, dict[str, object]] = {}
    peers_by_interface: dict[str, list[dict[str, object]]] = {}
    next_interfaces: dict[str, dict[str, object]] = {}

    for raw_line in dump.splitlines():
        parts = raw_line.split("\t")
        if len(parts) == 5:
            interface_name = parts[0].strip()
            listen_port = _parse_wireguard_int(parts[3])

            if interface_name:
                interfaces[interface_name] = {
                    "name": interface_name,
                    "listenPort": listen_port,
                }
            continue

        if len(parts) < 9:
            continue

        interface_name = parts[0].strip()
        public_key = parts[1].strip()
        if not interface_name or not public_key:
            continue

        public_key_hash = _fingerprint_wireguard_key(public_key)
        previous_interface = (
            previous_interfaces.get(interface_name, {})
            if isinstance(previous_interfaces, dict)
            else {}
        )
        previous_peers = (
            previous_interface.get("peers", {})
            if isinstance(previous_interface, dict)
            else {}
        )
        previous_peer = (
            previous_peers.get(public_key_hash, {})
            if isinstance(previous_peers, dict)
            else {}
        )
        latest_handshake_timestamp = _parse_wireguard_int(parts[5])
        rx_bytes = _parse_wireguard_int(parts[6])
        tx_bytes = _parse_wireguard_int(parts[7])
        persistent_keepalive = _parse_wireguard_int(parts[8])
        latest_handshake_at = _wireguard_handshake_at(latest_handshake_timestamp)
        latest_handshake_age = (
            round(now - latest_handshake_timestamp)
            if latest_handshake_timestamp and latest_handshake_timestamp > 0
            else None
        )

        peer = {
            "publicKeyHash": public_key_hash,
            "latestHandshakeAt": latest_handshake_at,
            "latestHandshakeAgeSeconds": latest_handshake_age,
            "rxBytes": rx_bytes,
            "txBytes": tx_bytes,
            "rxBps": _rate(rx_bytes, previous_peer.get("rxBytes"), elapsed) if rx_bytes is not None else None,
            "txBps": _rate(tx_bytes, previous_peer.get("txBytes"), elapsed) if tx_bytes is not None else None,
            "persistentKeepaliveSeconds": persistent_keepalive,
            "status": _wireguard_peer_status(latest_handshake_age),
        }
        peers_by_interface.setdefault(interface_name, []).append(peer)

    payloads: list[dict[str, object]] = []

    for interface_name in sorted(set(interfaces) | set(peers_by_interface)):
        peer_payloads = peers_by_interface.get(interface_name, [])
        peer_count = len(peer_payloads)
        active_peer_count = sum(1 for peer in peer_payloads if peer.get("status") == "active")
        rx_bytes = sum(
            peer["rxBytes"]
            for peer in peer_payloads
            if isinstance(peer.get("rxBytes"), int)
        )
        tx_bytes = sum(
            peer["txBytes"]
            for peer in peer_payloads
            if isinstance(peer.get("txBytes"), int)
        )
        latest_handshake_ages = [
            peer["latestHandshakeAgeSeconds"]
            for peer in peer_payloads
            if isinstance(peer.get("latestHandshakeAgeSeconds"), int)
        ]
        latest_handshake_age = min(latest_handshake_ages) if latest_handshake_ages else None
        latest_handshake_at = _wireguard_latest_handshake_at(peer_payloads)
        previous_interface = (
            previous_interfaces.get(interface_name, {})
            if isinstance(previous_interfaces, dict)
            else {}
        )

        payloads.append({
            "name": interface_name,
            "listenPort": interfaces.get(interface_name, {}).get("listenPort"),
            "peerCount": peer_count,
            "activePeerCount": active_peer_count,
            "latestHandshakeAt": latest_handshake_at,
            "latestHandshakeAgeSeconds": latest_handshake_age,
            "rxBytes": rx_bytes,
            "txBytes": tx_bytes,
            "rxBps": _rate(rx_bytes, previous_interface.get("rxBytes"), elapsed),
            "txBps": _rate(tx_bytes, previous_interface.get("txBytes"), elapsed),
            "status": _wireguard_interface_status(peer_count, active_peer_count),
            "peers": peer_payloads,
        })
        next_interfaces[interface_name] = {
            "rxBytes": rx_bytes,
            "txBytes": tx_bytes,
            "peers": {
                str(peer["publicKeyHash"]): {
                    "rxBytes": peer.get("rxBytes"),
                    "txBytes": peer.get("txBytes"),
                }
                for peer in peer_payloads
            },
        }

    return payloads, {"interfaces": next_interfaces}


def _read_wireguard_dump() -> str:
    try:
        result = subprocess.run(
            ["wg", "show", "all", "dump"],
            capture_output=True,
            check=False,
            text=True,
            timeout=3,
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return ""

    if result.returncode != 0:
        return ""

    return result.stdout


def _parse_wireguard_int(value: str) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed >= 0 else None


def _fingerprint_wireguard_key(public_key: str) -> str:
    return hashlib.sha256(public_key.encode("utf-8")).hexdigest()[:16]


def _wireguard_handshake_at(timestamp: int | None) -> str | None:
    if not timestamp or timestamp <= 0:
        return None

    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp))


def _wireguard_latest_handshake_at(peers: list[dict[str, object]]) -> str | None:
    candidates = [
        (age, handshake_at)
        for age, handshake_at in (
            (peer.get("latestHandshakeAgeSeconds"), peer.get("latestHandshakeAt"))
            for peer in peers
        )
        if isinstance(age, int) and isinstance(handshake_at, str)
    ]
    if not candidates:
        return None

    return min(candidates, key=lambda item: item[0])[1]


def _wireguard_peer_status(latest_handshake_age: int | None) -> str:
    if latest_handshake_age is None:
        return "never"
    if latest_handshake_age <= 180:
        return "active"

    return "stale"


def _wireguard_interface_status(peer_count: int, active_peer_count: int) -> str:
    if peer_count == 0:
        return "unknown"
    if active_peer_count == peer_count:
        return "up"
    if active_peer_count > 0:
        return "degraded"

    return "down"


def _collect_ping_probe(
    targets: tuple[str, ...] | list[str],
    count: int,
    timeout_seconds: int,
) -> tuple[float | None, float | None, float | None]:
    results = [
        result
        for target in targets[:4]
        if _is_safe_ping_target(target)
        for result in [_run_ping_probe(target, count, timeout_seconds)]
        if result
    ]
    if not results:
        return None, None, None

    ping_values = [
        result["pingMs"]
        for result in results
        if isinstance(result.get("pingMs"), (float, int))
    ]
    jitter_values = [
        result["jitterMs"]
        for result in results
        if isinstance(result.get("jitterMs"), (float, int))
    ]
    loss_values = [
        result["packetLossPercent"]
        for result in results
        if isinstance(result.get("packetLossPercent"), (float, int))
    ]

    ping_ms = round(sum(ping_values) / len(ping_values), 2) if ping_values else None
    jitter_ms = round(max(jitter_values), 2) if jitter_values else None
    packet_loss_percent = round(max(loss_values), 2) if loss_values else None

    return ping_ms, jitter_ms, packet_loss_percent


def _run_ping_probe(target: str, count: int, timeout_seconds: int) -> dict[str, object] | None:
    count = max(1, min(10, int(count)))
    timeout_seconds = max(1, min(10, int(timeout_seconds)))
    system_name = platform.system().lower()
    command = (
        ["ping", "-n", str(count), "-w", str(timeout_seconds * 1000), target]
        if system_name == "windows"
        else ["ping", "-n", "-c", str(count), "-W", str(timeout_seconds), target]
    )

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            check=False,
            text=True,
            timeout=max(3, count * (timeout_seconds + 1) + 2),
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return None

    output = f"{result.stdout}\n{result.stderr}"
    samples = _parse_ping_samples(output)
    packet_loss_percent = _parse_packet_loss(output)

    if packet_loss_percent is None:
        packet_loss_percent = round(((count - len(samples)) / count) * 100, 2)

    return {
        "target": target,
        "pingMs": round(sum(samples) / len(samples), 2) if samples else None,
        "jitterMs": _calculate_jitter(samples),
        "packetLossPercent": packet_loss_percent,
    }


def _parse_ping_samples(output: str) -> list[float]:
    samples: list[float] = []

    for match in PING_TIME_PATTERN.finditer(output):
        value = float(match.group("value"))
        if match.group("operator") == "<":
            value = max(0.0, value / 2)
        samples.append(value)

    return samples


def _parse_packet_loss(output: str) -> float | None:
    for pattern in [WINDOWS_PACKET_PATTERN, UNIX_PACKET_PATTERN]:
        match = pattern.search(output)
        if match:
            return round(float(match.group("loss")), 2)

    return None


def _calculate_jitter(samples: list[float]) -> float | None:
    if not samples:
        return None
    if len(samples) == 1:
        return 0.0

    deltas = [abs(current - previous) for previous, current in zip(samples, samples[1:])]
    return round(sum(deltas) / len(deltas), 2)


def _is_safe_ping_target(target: str) -> bool:
    return bool(target and not target.startswith("-") and SAFE_PING_TARGET_PATTERN.fullmatch(target))


def _collect_route_probes(
    tcp_targets: tuple[str, ...] | list[str],
    udp_targets: tuple[str, ...] | list[str],
    quic_targets: tuple[str, ...] | list[str],
    dns_targets: tuple[str, ...] | list[str],
    mtu_targets: tuple[str, ...] | list[str],
    wireguard_interfaces: list[dict[str, object]],
    count: int,
    timeout_seconds: int,
    mtu_min_bytes: int,
    mtu_max_bytes: int,
    tunnel_overhead_bytes: int,
    configured_mtu_bytes: int | None,
    metadata: dict[str, str | None] | None = None,
) -> list[dict[str, object]]:
    count = max(1, min(5, int(count)))
    timeout_seconds = max(1, min(10, int(timeout_seconds)))
    probes: list[dict[str, object]] = []

    for target in tcp_targets[:4]:
        parsed = _parse_route_host_port(target)
        if parsed:
            probes.append(_run_tcp_route_probe("tcp", target, parsed[0], parsed[1], count, timeout_seconds))

    for target in udp_targets[:4]:
        parsed = _parse_route_host_port(target)
        if parsed:
            probes.append(_run_udp_route_probe("udp", target, parsed[0], parsed[1], count, timeout_seconds))

    for target in quic_targets[:4]:
        parsed = _parse_route_host_port(target)
        if parsed:
            probes.append(_run_udp_route_probe(
                "quic",
                target,
                parsed[0],
                parsed[1],
                count,
                timeout_seconds,
                "quic_udp_response",
            ))

    for target in dns_targets[:4]:
        if _is_safe_route_host(target):
            probes.append(_run_dns_route_probe(target, count, timeout_seconds))

    for target in mtu_targets[:4]:
        if _is_safe_route_host(target):
            probes.append(_run_mtu_route_probe(
                target,
                timeout_seconds,
                mtu_min_bytes,
                mtu_max_bytes,
                tunnel_overhead_bytes,
                configured_mtu_bytes,
            ))

    for interface in wireguard_interfaces[:8]:
        probe = _run_wireguard_route_probe(interface)
        if probe:
            probes.append(probe)

    return [_with_route_probe_metadata(probe, metadata) for probe in probes]


def _with_route_probe_metadata(
    probe: dict[str, object],
    metadata: dict[str, str | None] | None,
) -> dict[str, object]:
    if not metadata:
        return probe

    enriched = dict(probe)
    for key in ["routeGroup", "outboundId", "outboundKey", "outboundName", "operator", "scoreProfile"]:
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            enriched[key] = value.strip()

    return enriched


def _run_tcp_route_probe(
    protocol: str,
    target: str,
    host: str,
    port: int,
    count: int,
    timeout_seconds: int,
) -> dict[str, object]:
    samples: list[float] = []

    for _ in range(count):
        started = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=timeout_seconds):
                samples.append((time.perf_counter() - started) * 1000)
        except OSError:
            continue

    return _route_probe_result(protocol, target, "tcp_connect", samples, count)


def _run_udp_route_probe(
    protocol: str,
    target: str,
    host: str,
    port: int,
    count: int,
    timeout_seconds: int,
    mode: str = "udp_response",
) -> dict[str, object]:
    samples: list[float] = []

    for _ in range(count):
        started = time.perf_counter()
        try:
            address = _resolve_socket_address(host, port, socket.SOCK_DGRAM)
            if not address:
                continue

            family, socket_type, proto, _, sockaddr = address
            with socket.socket(family, socket_type, proto) as sock:
                sock.settimeout(timeout_seconds)
                sock.sendto(ROUTE_PROBE_PAYLOAD, sockaddr)
                sock.recvfrom(512)
                samples.append((time.perf_counter() - started) * 1000)
        except OSError:
            continue

    return _route_probe_result(protocol, target, mode, samples, count)


def _run_dns_route_probe(target: str, count: int, timeout_seconds: int) -> dict[str, object]:
    samples: list[float] = []

    for _ in range(count):
        started = time.perf_counter()
        original_timeout = socket.getdefaulttimeout()
        try:
            socket.setdefaulttimeout(timeout_seconds)
            socket.getaddrinfo(target, None)
            samples.append((time.perf_counter() - started) * 1000)
        except OSError:
            continue
        finally:
            socket.setdefaulttimeout(original_timeout)

    return _route_probe_result("dns", target, "dns_lookup", samples, count)


def _run_mtu_route_probe(
    target: str,
    timeout_seconds: int,
    min_mtu_bytes: int,
    max_mtu_bytes: int,
    tunnel_overhead_bytes: int,
    configured_mtu_bytes: int | None,
) -> dict[str, object]:
    timeout_seconds = max(1, min(10, int(timeout_seconds)))
    min_mtu = max(576, min(9000, int(min_mtu_bytes)))
    max_mtu = max(576, min(9000, int(max_mtu_bytes)))
    if max_mtu < min_mtu:
        min_mtu, max_mtu = max_mtu, min_mtu

    overhead = max(40, min(240, int(tunnel_overhead_bytes)))
    checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    max_result = _run_mtu_ping(target, max_mtu, timeout_seconds)
    if max_result is None:
        return _mtu_route_probe_result(
            target,
            "unknown",
            None,
            max_mtu,
            overhead,
            configured_mtu_bytes,
            ["mtu_probe_unavailable"],
            checked_at,
        )
    if max_result:
        return _mtu_route_probe_result(
            target,
            "healthy",
            max_mtu,
            max_mtu,
            overhead,
            configured_mtu_bytes,
            ["max_mtu_ok"],
            checked_at,
        )

    min_result = _run_mtu_ping(target, min_mtu, timeout_seconds)
    if min_result is None:
        return _mtu_route_probe_result(
            target,
            "unknown",
            None,
            max_mtu,
            overhead,
            configured_mtu_bytes,
            ["mtu_probe_unavailable"],
            checked_at,
        )
    if not min_result:
        return _mtu_route_probe_result(
            target,
            "critical",
            None,
            max_mtu,
            overhead,
            configured_mtu_bytes,
            ["minimum_mtu_failed", "manual_review_required"],
            checked_at,
        )

    best_mtu = min_mtu
    low = min_mtu + 1
    high = max_mtu - 1
    attempts = 0

    while low <= high and attempts < 12:
        attempts += 1
        midpoint = (low + high) // 2
        result = _run_mtu_ping(target, midpoint, timeout_seconds)
        if result is None:
            break
        if result:
            best_mtu = midpoint
            low = midpoint + 1
        else:
            high = midpoint - 1

    return _mtu_route_probe_result(
        target,
        "degraded",
        best_mtu,
        max_mtu,
        overhead,
        configured_mtu_bytes,
        ["fragmentation_risk", "avoid_mid_session_change"],
        checked_at,
    )


def _run_mtu_ping(target: str, packet_mtu_bytes: int, timeout_seconds: int) -> bool | None:
    payload_size = max(0, int(packet_mtu_bytes) - 28)
    system_name = platform.system().lower()
    if system_name == "windows":
        command = ["ping", "-n", "1", "-f", "-l", str(payload_size), "-w", str(timeout_seconds * 1000), target]
    elif system_name == "darwin":
        command = ["ping", "-c", "1", "-D", "-s", str(payload_size), "-W", str(timeout_seconds * 1000), target]
    else:
        command = ["ping", "-n", "-c", "1", "-M", "do", "-s", str(payload_size), "-W", str(timeout_seconds), target]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            check=False,
            text=True,
            timeout=max(3, timeout_seconds + 2),
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return None

    return result.returncode == 0


def _mtu_route_probe_result(
    target: str,
    status: str,
    path_mtu_bytes: int | None,
    tested_mtu_bytes: int,
    tunnel_overhead_bytes: int,
    configured_mtu_bytes: int | None,
    reason_codes: list[str],
    checked_at: str,
) -> dict[str, object]:
    recommended_tunnel_mtu = (
        max(576, path_mtu_bytes - tunnel_overhead_bytes)
        if isinstance(path_mtu_bytes, int)
        else None
    )
    mtu_status = _mtu_status(status, path_mtu_bytes, tested_mtu_bytes)
    mtu_recommendation = _mtu_recommendation(
        mtu_status,
        recommended_tunnel_mtu,
        configured_mtu_bytes,
    )
    normalized_reasons = list(dict.fromkeys(reason_codes + _mtu_reason_codes(
        mtu_status,
        mtu_recommendation,
        recommended_tunnel_mtu,
        configured_mtu_bytes,
    )))

    return {
        "protocol": "mtu",
        "target": target,
        "mode": "icmp_df_path_mtu",
        "status": status,
        "latencyMs": None,
        "jitterMs": None,
        "packetLossPercent": 0 if status == "healthy" else None,
        "pathMtuBytes": path_mtu_bytes,
        "recommendedTunnelMtuBytes": recommended_tunnel_mtu,
        "configuredMtuBytes": configured_mtu_bytes,
        "mtuStatus": mtu_status,
        "mtuRecommendation": mtu_recommendation,
        "mtuSessionSafe": mtu_recommendation == "keep",
        "mtuReasonCodes": normalized_reasons,
        "checkedAt": checked_at,
    }


def _mtu_status(status: str, path_mtu_bytes: int | None, tested_mtu_bytes: int) -> str:
    if status == "unknown":
        return "unknown"
    if path_mtu_bytes is None:
        return "blocked"
    if path_mtu_bytes >= tested_mtu_bytes:
        return "healthy"

    return "fragmentationRisk"


def _mtu_recommendation(
    mtu_status: str,
    recommended_tunnel_mtu: int | None,
    configured_mtu_bytes: int | None,
) -> str:
    if mtu_status in {"blocked", "unknown"}:
        return "manualReview" if mtu_status == "blocked" else "none"
    if recommended_tunnel_mtu is None:
        return "none"
    if configured_mtu_bytes is not None and configured_mtu_bytes > recommended_tunnel_mtu + 8:
        return "reduce"
    if recommended_tunnel_mtu < 1320:
        return "manualReview"

    return "keep"


def _mtu_reason_codes(
    mtu_status: str,
    recommendation: str,
    recommended_tunnel_mtu: int | None,
    configured_mtu_bytes: int | None,
) -> list[str]:
    reasons: list[str] = []
    if mtu_status == "healthy":
        reasons.append("mtu_probe_healthy")
    if mtu_status == "fragmentationRisk":
        reasons.append("fragmentation_risk")
    if mtu_status == "blocked":
        reasons.append("mtu_probe_blocked")
    if recommendation == "reduce":
        reasons.extend(["configured_mtu_above_safe_path", "new_sessions_only"])
    if recommendation == "manualReview":
        reasons.append("manual_review_required")
    if recommended_tunnel_mtu is not None and recommended_tunnel_mtu < 1320:
        reasons.append("low_tunnel_mtu")
    if configured_mtu_bytes is None:
        reasons.append("configured_mtu_unknown")

    return reasons


def _run_wireguard_route_probe(interface: dict[str, object]) -> dict[str, object] | None:
    interface_name = str(interface.get("name") or "").strip()
    if not interface_name:
        return None

    peer_count = _number_or_none(interface.get("peerCount"))
    active_peer_count = _number_or_none(interface.get("activePeerCount"))
    latest_handshake_age = _number_or_none(interface.get("latestHandshakeAgeSeconds"))
    status = _wireguard_route_probe_status(
        str(interface.get("status") or "unknown"),
        peer_count,
        active_peer_count,
        latest_handshake_age,
    )
    packet_loss_percent = _wireguard_route_probe_loss(status)

    return {
        "protocol": "wireguard",
        "target": f"interface:{interface_name}",
        "mode": "wireguard_handshake",
        "status": status,
        "latencyMs": None,
        "jitterMs": None,
        "packetLossPercent": packet_loss_percent,
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def _route_probe_result(
    protocol: str,
    target: str,
    mode: str,
    samples: list[float],
    count: int,
) -> dict[str, object]:
    packet_loss_percent = round(((count - len(samples)) / count) * 100, 2)

    return {
        "protocol": protocol,
        "target": target,
        "mode": mode,
        "status": _route_probe_status(protocol, packet_loss_percent, samples),
        "latencyMs": round(sum(samples) / len(samples), 2) if samples else None,
        "jitterMs": _calculate_jitter(samples),
        "packetLossPercent": packet_loss_percent,
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def _route_probe_status(protocol: str, packet_loss_percent: float, samples: list[float]) -> str:
    if not samples or packet_loss_percent >= 100:
        return "critical"

    protocol_name = protocol.lower()
    critical_loss = 75 if protocol_name in {"tcp", "dns"} else 50
    degraded_latency = {
        "tcp": 150,
        "udp": 100,
        "quic": 100,
        "dns": 80,
    }.get(protocol_name, 120)
    critical_latency = {
        "tcp": 1000,
        "udp": 750,
        "quic": 750,
        "dns": 500,
    }.get(protocol_name, 900)
    average_latency = sum(samples) / len(samples)
    jitter = _calculate_jitter(samples) or 0.0

    if packet_loss_percent >= critical_loss or average_latency >= critical_latency:
        return "critical"
    if packet_loss_percent > 0:
        return "degraded"

    if average_latency > degraded_latency:
        return "degraded"
    if protocol_name in {"udp", "quic"} and jitter > 20:
        return "degraded"
    if protocol_name in {"tcp", "dns"} and jitter > 50:
        return "degraded"

    return "healthy"


def _wireguard_route_probe_status(
    interface_status: str,
    peer_count: float | None,
    active_peer_count: float | None,
    latest_handshake_age: float | None,
) -> str:
    normalized_status = interface_status.lower()

    if normalized_status == "unknown" or not peer_count:
        return "unknown"
    if normalized_status == "down" or active_peer_count == 0:
        return "critical"
    if normalized_status == "degraded":
        return "degraded"
    if latest_handshake_age is not None and latest_handshake_age > 600:
        return "critical"
    if latest_handshake_age is not None and latest_handshake_age > 180:
        return "degraded"

    return "healthy"


def _wireguard_route_probe_loss(status: str) -> float | None:
    if status == "healthy":
        return 0.0
    if status == "degraded":
        return 10.0
    if status == "critical":
        return 100.0

    return None


def _number_or_none(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)

    return None


def _parse_route_host_port(target: str) -> tuple[str, int] | None:
    if not target or target.startswith("-") or "/" in target or "\\" in target:
        return None
    if "://" in target:
        return None

    host = ""
    port_text = ""

    if target.startswith("["):
        host, _, remainder = target[1:].partition("]")
        if not remainder.startswith(":"):
            return None
        port_text = remainder[1:]
    else:
        host, separator, port_text = target.rpartition(":")
        if not separator:
            return None

    if not _is_safe_route_host(host):
        return None

    try:
        port = int(port_text)
    except ValueError:
        return None

    if port < 1 or port > 65535:
        return None

    return host, port


def _is_safe_route_host(host: str) -> bool:
    return bool(host and not host.startswith("-") and SAFE_ROUTE_HOST_PATTERN.fullmatch(host))


def _resolve_socket_address(
    host: str,
    port: int,
    socket_type: int,
) -> tuple[int, int, int, str, tuple[Any, ...]] | None:
    try:
        addresses = socket.getaddrinfo(host, port, type=socket_type)
    except OSError:
        return None

    return addresses[0] if addresses else None


def _rate(current: int, previous: object, elapsed: float | None) -> float | None:
    if not isinstance(previous, int) or not elapsed or elapsed <= 0:
        return None

    delta = max(0, current - previous)
    return round(delta / elapsed, 2)


def _load_state(state_file: str | None) -> dict[str, Any]:
    path = _state_path(state_file)

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save_state(state_file: str | None, state: dict[str, Any]) -> None:
    path = _state_path(state_file)

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state), encoding="utf-8")
    except OSError:
        return


def _state_path(state_file: str | None) -> Path:
    if state_file:
        return Path(state_file)

    return Path(tempfile.gettempdir()) / "afrows-agent-state.json"
