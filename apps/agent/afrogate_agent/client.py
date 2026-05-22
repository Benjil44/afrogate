from __future__ import annotations

import json
from urllib import request


def push_metrics(api_url: str, token: str | None, payload: dict[str, object]) -> dict[str, object]:
    url = f"{api_url.rstrip('/')}/metrics"
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "afrogate-agent/0.1.0",
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url, data=body, headers=headers, method="POST")
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))

