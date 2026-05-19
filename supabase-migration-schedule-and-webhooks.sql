-- ============================================================
-- Migration: scheduled match times + Discord webhook URL
-- ============================================================
-- Adds two small features:
--
--   1. fixtures.scheduled_at — optional timestamptz for "when is
--      this match scheduled to be played" so the UI can show
--      upcoming matches and a Live/Completed badge.
--
--   2. tournaments.discord_webhook_url — optional Discord webhook
--      URL. When set, the app POSTs a rich-embed notification to
--      the channel every time a match result is saved.
--
-- Existing RLS policies cover both columns:
--   · public read on fixtures + tournaments → viewers see scheduled
--     times and live status
--   · tournament-owner update → only the host can set webhooks /
--     schedules
--
-- Run this once in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste below → Run
-- ============================================================

alter table public.fixtures
  add column if not exists scheduled_at timestamptz;

alter table public.tournaments
  add column if not exists discord_webhook_url text;

-- Helpful index for upcoming-matches queries
create index if not exists idx_fixtures_scheduled_at
  on public.fixtures(tournament_id, scheduled_at)
  where scheduled_at is not null;
