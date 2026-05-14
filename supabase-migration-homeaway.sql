-- ============================================================
-- Migration: Home & Away legs + configurable advancement
-- Run this in Supabase SQL Editor AFTER supabase-migration-group-knockout.sql
-- ============================================================

-- 1. home_away: when true, each matchup creates 2 legs (home + away)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS home_away boolean NOT NULL DEFAULT false;

-- 2. teams_advancing: how many players advance from each group (default 2)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS teams_advancing int NOT NULL DEFAULT 2;

-- 3. pair_id: links the two legs of a 2-legged tie together
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS pair_id uuid;
