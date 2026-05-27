from __future__ import annotations

import argparse
import json
import time

from .client import push_heartbeat, push_metrics
from .collect import collect_metrics
from .config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AfroGate monitoring agent.")
    parser.add_argument("--once", action="store_true", help="Collect and push one payload.")
    args = parser.parse_args()

    config = load_config()

    while True:
        payload = collect_metrics(
            config.agent_id,
            config.state_file,
            config.ping_targets,
            config.ping_count,
            config.ping_timeout_seconds,
            config.tcp_probe_targets,
            config.udp_probe_targets,
            config.quic_probe_targets,
            config.dns_probe_targets,
            config.route_probe_count,
            config.route_probe_timeout_seconds,
            {
                "routeGroup": config.route_probe_route_group,
                "outboundId": config.route_probe_outbound_id,
                "outboundKey": config.route_probe_outbound_key,
                "outboundName": config.route_probe_outbound_name,
                "operator": config.route_probe_operator,
                "scoreProfile": config.route_probe_score_profile,
            },
        )

        if config.api_url:
            heartbeat_response = push_heartbeat(
                config.api_url,
                config.token,
                payload,
                proxy_url=config.outbound_proxy_url,
            )
            response = push_metrics(
                config.api_url,
                config.token,
                payload,
                proxy_url=config.outbound_proxy_url,
            )
            print(json.dumps({
                "heartbeat": heartbeat_response,
                "metrics": response,
            }, indent=2))
        else:
            print(json.dumps(payload, indent=2))

        if args.once:
            return

        time.sleep(config.interval_seconds)
