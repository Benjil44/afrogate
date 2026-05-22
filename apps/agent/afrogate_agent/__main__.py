from __future__ import annotations

import argparse
import json
import time

from .client import push_metrics
from .collect import collect_metrics
from .config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AfroGate monitoring agent.")
    parser.add_argument("--once", action="store_true", help="Collect and push one payload.")
    args = parser.parse_args()

    config = load_config()

    while True:
        payload = collect_metrics(config.agent_id)

        if config.api_url:
            response = push_metrics(
                config.api_url,
                config.token,
                payload,
                proxy_url=config.outbound_proxy_url,
            )
            print(json.dumps(response, indent=2))
        else:
            print(json.dumps(payload, indent=2))

        if args.once:
            return

        time.sleep(config.interval_seconds)
