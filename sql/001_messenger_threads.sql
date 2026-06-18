-- Optional: messenger thread persistence (shared Supabase)
-- Run manually if you want cross-deploy session memory.
-- Default: in-memory sessions in messenger-bot (OK for Render).

CREATE TABLE IF NOT EXISTS messenger_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  project_slug TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, psid)
);

CREATE INDEX IF NOT EXISTS idx_messenger_threads_updated ON messenger_threads (updated_at DESC);
