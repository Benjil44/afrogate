from __future__ import annotations

import ctypes
import json
import os
import platform
import shutil
import socket
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


def collect_metrics(agent_id: str, state_file: str | None = None) -> dict[str, object]:
    now = time.time()
    previous_state = _load_state(state_file)
    network_interfaces, inbound_bps, outbound_bps, next_state = _collect_network_interfaces(previous_state, now)
    storages = _collect_storages()

    _save_state(state_file, next_state)

    return {
        "serverId": agent_id,
        "hostname": socket.gethostname(),
        "cpuPercent": _load_average_percent(),
        "ramPercent": _memory_percent(),
        "diskFreePercent": _lowest_disk_free_percent(storages),
        "storages": storages,
        "networkInterfaces": network_interfaces,
        "inboundBps": inbound_bps,
        "outboundBps": outbound_bps,
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

    return Path(tempfile.gettempdir()) / "afrogate-agent-state.json"
