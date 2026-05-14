-- ============================================================
-- Migration: Add Group + Knockout format support
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- 1. Expand the format check on tournaments to include 'group_knockout'
ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_format_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_format_check
  CHECK (format IN ('league', 'knockout', 'group_knockout'));

-- 2. Add num_groups column to tournaments (how many groups in group stage)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS num_groups int NOT NULL DEFAULT 4;

-- 3. Add group_number to players (which group they belong to in group_knockout)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS group_number int;

-- 4. Add phase column to fixtures
--    'regular'  = standard league or knockout fixture
--    'group'    = group stage fixture in a group_knockout tournament
--    'knockout' = knockout stage fixture in a group_knockout tournament
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'regular';

ALTER TABLE public.fixtures
  DROP CONSTRAINT IF EXISTS fixtures_phase_check;

ALTER TABLE public.fixtures
  ADD CONSTRAINT fixtures_phase_check
  CHECK (phase IN ('regular', 'group', 'knockout'));
