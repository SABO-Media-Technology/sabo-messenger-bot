-- Messenger inbox leads (shared Supabase diexsbzqwsbpilsymnfb)
-- Separate from sabo-mt website `leads` — schema tailored for FB PSID.

CREATE TABLE IF NOT EXISTS public.messenger_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT NOT NULL,
  page_name TEXT,
  project_slug TEXT,
  psid TEXT NOT NULL,
  phone TEXT,
  user_text TEXT,
  source TEXT NOT NULL DEFAULT 'messenger',
  tier TEXT,
  reply_layer TEXT,
  lead_score INTEGER NOT NULL DEFAULT 40,
  lead_status TEXT NOT NULL DEFAULT 'new_lead',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messenger_leads_created ON public.messenger_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messenger_leads_page_psid ON public.messenger_leads (page_id, psid);

ALTER TABLE public.messenger_leads ENABLE ROW LEVEL SECURITY;
