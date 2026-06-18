-- Idempotency for webhook + inbox poller (24h dedupe across Render restarts)
CREATE TABLE IF NOT EXISTS messenger_processed_mids (
  message_id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  psid TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messenger_processed_mids_at
  ON messenger_processed_mids (processed_at DESC);
