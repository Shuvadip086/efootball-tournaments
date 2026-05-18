-- ============================================================
-- Migration: add missing DELETE policy on public.fixtures
-- ============================================================
-- The original schema enabled RLS on the fixtures table and added
-- public read + tournament-owner insert + update policies, but
-- forgot the DELETE policy. As a result every DELETE silently
-- returns "0 rows affected" — breaking:
--
--   · the new "🗑 Delete matchup" button in the Bracket Editor
--   · the auto-strip Leg 2 logic that runs after advancing to the
--     Final
--   · manual 2-leg → 1-leg conversions (toggle button + the
--     "Convert Final to Single Match" banner)
--   · the "Add Missing Fixtures" feature's cleanup paths
--
-- Run this once in your Supabase SQL Editor (Dashboard → SQL Editor
-- → New query → paste → Run) and all delete actions in the app
-- will start working.
-- ============================================================

-- Drop a previous version if it exists (safe — no-op when absent)
drop policy if exists "fixtures: tournament owner delete" on public.fixtures;

-- Owner of the tournament can delete any fixture in their tournament
create policy "fixtures: tournament owner delete" on public.fixtures
  for delete using (
    exists (
      select 1
      from public.tournaments t
      where t.id = tournament_id
        and t.owner_id = auth.uid()
    )
  );

-- Verify the policy is active
-- (Optional check — Supabase will show this in the editor output)
-- select policyname, cmd from pg_policies where tablename = 'fixtures' order by cmd;
