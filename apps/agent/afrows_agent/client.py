from __future__ import annotations

import json
from urllib import request


def push_metrics(
    api_url: str,
    token: str | None,
    payload: dict[str, object],
    proxy_url: str | None = None,
) -> dict[str, object]:
    url = f"{api_url.rstrip('/')}/metrics"
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "afrows-agent/0.1.0",
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url, data=body, headers=headers, method="POST")

    opener = _build_opener(proxy_url)
    with opener.open(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def push_heartbeat(
    api_url: str,
    token: str | None,
    payload: dict[str, object],
    proxy_url: str | None = None,
) -> dict[str, object]:
    url = f"{api_url.rstrip('/')}/agents/heartbeat"
    body = json.dumps({
        "serverId": payload.get("serverId"),
        "hostname": payload.get("hostname"),
        "platform": payload.get("platform"),
        "status": "healthy",
    }).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "afrows-agent/0.1.0",
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url, data=body, headers=headers, method="POST")

    opener = _build_opener(proxy_url)
    with opener.open(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def _build_opener(proxy_url: str | None) -> request.OpenerDirector:
    if not proxy_url:
        return request.build_opener()

    return request.build_opener(
        request.ProxyHandler({
            "http": proxy_url,
            "https": proxy_url,
        }),
    )
