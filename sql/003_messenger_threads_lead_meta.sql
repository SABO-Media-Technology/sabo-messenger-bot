-- Extend messenger_threads for full PSID session (messages + lead profile + meta)
-- Run after 001_messenger_threads.sql

ALTER TABLE messenger_threads
  ADD COLUMN IF NOT EXISTS lead JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
