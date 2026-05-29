CREATE INDEX IF NOT EXISTS agent_tokens_server_active_idx
  ON agent_tokens (server_id, created_at)
  WHERE revoked_at IS NULL;
