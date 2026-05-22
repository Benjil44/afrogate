from __future__ import annotations

import os
import platform
import shutil
import socket


def collect_metrics(agent_id: str) -> dict[str, object]:
    disk = shutil.disk_usage("/")
    disk_free_percent = round((disk.free / disk.total) * 100, 2)

    return {
        "serverId": agent_id,
        "hostname": socket.gethostname(),
        "cpuPercent": _load_average_percent(),
        "ramPercent": None,
        "diskFreePercent": disk_free_percent,
        "platform": platform.platform(),
    }


def _load_average_percent() -> float | None:
    try:
        load_1m = os.getloadavg()[0]
    except (AttributeError, OSError):
        return None

    cpu_count = os.cpu_count() or 1
    return round(min(100, (load_1m / cpu_count) * 100), 2)

