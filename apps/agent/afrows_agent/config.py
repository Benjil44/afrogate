from dataclasses import dataclass
import os


@dataclass(frozen=True)
class AgentConfig:
    agent_id: str
    api_url: str | None
    token: str | None
    outbound_proxy_url: str | None
    state_file: str | None
    interval_seconds: int
    ping_targets: tuple[str, ...]
    ping_count: int
    ping_timeout_seconds: int
    tcp_probe_targets: tuple[str, ...]
    udp_probe_targets: tuple[str, ...]
    quic_probe_targets: tuple[str, ...]
    dns_probe_targets: tuple[str, ...]
    mtu_probe_targets: tuple[str, ...]
    route_probe_count: int
    route_probe_timeout_seconds: int
    route_probe_mtu_min_bytes: int
    route_probe_mtu_max_bytes: int
    route_probe_tunnel_overhead_bytes: int
    route_probe_configured_mtu_bytes: int | None
    route_probe_route_group: str | None
    route_probe_outbound_id: str | None
    route_probe_outbound_key: str | None
    route_probe_outbound_name: str | None
    route_probe_operator: str | None
    route_probe_score_profile: str | None


def load_config() -> AgentConfig:
    return AgentConfig(
        agent_id=os.getenv("AFROWS_AGENT_ID", "local-dev-agent"),
        api_url=os.getenv("AFROWS_API_URL"),
        token=os.getenv("AFROWS_AGENT_TOKEN"),
        outbound_proxy_url=os.getenv("AFROWS_OUTBOUND_PROXY_URL"),
        state_file=os.getenv("AFROWS_AGENT_STATE_FILE"),
        interval_seconds=_bounded_int("AFROWS_PUSH_INTERVAL_SECONDS", 10, 1, 3600),
        ping_targets=_parse_targets(os.getenv("AFROWS_PING_TARGETS", "")),
        ping_count=_bounded_int("AFROWS_PING_COUNT", 3, 1, 10),
        ping_timeout_seconds=_bounded_int("AFROWS_PING_TIMEOUT_SECONDS", 2, 1, 10),
        tcp_probe_targets=_parse_targets(os.getenv("AFROWS_TCP_PROBE_TARGETS", "")),
        udp_probe_targets=_parse_targets(os.getenv("AFROWS_UDP_PROBE_TARGETS", "")),
        quic_probe_targets=_parse_targets(os.getenv("AFROWS_QUIC_PROBE_TARGETS", "")),
        dns_probe_targets=_parse_targets(os.getenv("AFROWS_DNS_PROBE_TARGETS", "")),
        mtu_probe_targets=_parse_targets(os.getenv("AFROWS_MTU_PROBE_TARGETS", "")),
        route_probe_count=_bounded_int("AFROWS_ROUTE_PROBE_COUNT", 2, 1, 5),
        route_probe_timeout_seconds=_bounded_int("AFROWS_ROUTE_PROBE_TIMEOUT_SECONDS", 2, 1, 10),
        route_probe_mtu_min_bytes=_bounded_int("AFROWS_ROUTE_PROBE_MTU_MIN_BYTES", 1280, 576, 9000),
        route_probe_mtu_max_bytes=_bounded_int("AFROWS_ROUTE_PROBE_MTU_MAX_BYTES", 1500, 576, 9000),
        route_probe_tunnel_overhead_bytes=_bounded_int("AFROWS_ROUTE_PROBE_TUNNEL_OVERHEAD_BYTES", 80, 40, 240),
        route_probe_configured_mtu_bytes=_optional_int("AFROWS_ROUTE_PROBE_CONFIGURED_MTU_BYTES", 576, 9000),
        route_probe_route_group=_optional_string(os.getenv("AFROWS_ROUTE_PROBE_ROUTE_GROUP")),
        route_probe_outbound_id=_optional_string(os.getenv("AFROWS_ROUTE_PROBE_OUTBOUND_ID")),
        route_probe_outbound_key=_optional_string(os.getenv("AFROWS_ROUTE_PROBE_OUTBOUND_KEY")),
        route_probe_outbound_name=_optional_string(os.getenv("AFROWS_ROUTE_PROBE_OUTBOUND_NAME")),
        route_probe_operator=_optional_string(os.getenv("AFROWS_ROUTE_PROBE_OPERATOR")),
        route_probe_score_profile=_optional_string(os.getenv("AFROWS_ROUTE_PROBE_SCORE_PROFILE")),
    )


def _parse_targets(value: str) -> tuple[str, ...]:
    targets = [target.strip() for target in value.replace(";", ",").split(",")]

    return tuple(target for target in targets if target)


def _optional_string(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default

    return max(minimum, min(maximum, value))


def _optional_int(name: str, minimum: int, maximum: int) -> int | None:
    value = os.getenv(name)
    if value is None or not value.strip():
        return None

    try:
        parsed = int(value)
    except ValueError:
        return None

    return max(minimum, min(maximum, parsed))
