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


def load_config() -> AgentConfig:
    return AgentConfig(
        agent_id=os.getenv("AFROGATE_AGENT_ID", "local-dev-agent"),
        api_url=os.getenv("AFROGATE_API_URL"),
        token=os.getenv("AFROGATE_AGENT_TOKEN"),
        outbound_proxy_url=os.getenv("AFROGATE_OUTBOUND_PROXY_URL"),
        state_file=os.getenv("AFROGATE_AGENT_STATE_FILE"),
        interval_seconds=int(os.getenv("AFROGATE_PUSH_INTERVAL_SECONDS", "10")),
    )
