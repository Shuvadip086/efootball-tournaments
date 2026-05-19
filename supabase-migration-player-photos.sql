-- ============================================================
-- Migration: add player photo storage in the players table
-- ============================================================
-- Until now poster photos were stored in localStorage, which is
-- per-device — uploading on a laptop didn't reach phones / other
-- browsers / co-organisers. This adds a server-side photo column so
-- photos sync across every device.
--
-- The photo is stored as a data-URL (base64) directly in the row.
-- We resize on the client to ~800px JPEG before upload so each
-- photo stays under ~200KB. No bucket / storage policy setup needed.
--
-- Run this once in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste below → Run
-- ============================================================

alter table public.players
  add column if not exists photo_data_url text;

-- RLS for the new column is inherited from the existing players
-- policies (public read + tournament-owner update), so no extra
-- policy changes are needed.

-- Verify
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'players' and column_name = 'photo_data_url';
