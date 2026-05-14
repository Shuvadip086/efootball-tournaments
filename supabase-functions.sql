-- ============================================================
-- eFootball Tournaments – RPC Functions
-- Run AFTER supabase-schema.sql + supabase-migration-group-knockout.sql
-- ============================================================

-- ============================================================
-- 1. generate_league_fixtures
--    Creates a round-robin schedule for all players in a tournament
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_league_fixtures(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_players uuid[];
  v_n int;
  v_rounds int;
  v_round int;
  v_i int;
  v_home uuid;
  v_away uuid;
  v_dummy uuid;
  v_schedule uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.fixtures WHERE tournament_id = p_tournament_id;

  SELECT array_agg(id ORDER BY created_at) INTO v_players
  FROM public.players WHERE tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  IF v_n < 2 THEN RAISE EXCEPTION 'Need at least 2 players'; END IF;

  IF v_n % 2 = 1 THEN
    v_players := v_players || null::uuid;
    v_n := v_n + 1;
  END IF;

  v_rounds := v_n - 1;

  FOR v_round IN 1..v_rounds LOOP
    v_schedule := v_players;
    FOR v_i IN 1..(v_n/2) LOOP
      v_home := v_schedule[v_i];
      v_away := v_schedule[v_n - v_i + 1];
      IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
        INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase)
        VALUES (p_tournament_id, v_home, v_away, v_round, 'regular');
      END IF;
    END LOOP;
    v_dummy := v_players[2];
    FOR v_i IN 2..(v_n - 1) LOOP
      v_players[v_i] := v_players[v_i + 1];
    END LOOP;
    v_players[v_n] := v_dummy;
  END LOOP;

  INSERT INTO public.standings(tournament_id, player_id)
  SELECT p_tournament_id, id FROM public.players WHERE tournament_id = p_tournament_id
  ON CONFLICT (tournament_id, player_id) DO NOTHING;

  UPDATE public.tournaments SET status = 'active' WHERE id = p_tournament_id;
END;
$$;

-- ============================================================
-- 2. generate_knockout_fixtures
--    Seeds round 1 of a single-elimination bracket
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_knockout_fixtures(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_players uuid[];
  v_n int;
  v_i int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.fixtures WHERE tournament_id = p_tournament_id;

  SELECT array_agg(id ORDER BY random()) INTO v_players
  FROM public.players WHERE tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  IF v_n < 2 THEN RAISE EXCEPTION 'Need at least 2 players'; END IF;

  v_i := 1;
  WHILE v_i < v_n LOOP
    INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase)
    VALUES (p_tournament_id, v_players[v_i], v_players[v_i + 1], 1, 'regular');
    v_i := v_i + 2;
  END LOOP;

  UPDATE public.tournaments SET status = 'active' WHERE id = p_tournament_id;
END;
$$;

-- ============================================================
-- 3. generate_group_stage_fixtures
--    Distributes players into groups and creates round-robin
--    fixtures within each group (phase = 'group')
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_group_stage_fixtures(
  p_tournament_id uuid,
  p_num_groups    int DEFAULT 4
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_players      uuid[];
  v_n            int;
  v_g            int;
  v_i            int;
  v_group_players uuid[];
  v_group_size   int;
  v_rounds       int;
  v_round        int;
  v_schedule     uuid[];
  v_home         uuid;
  v_away         uuid;
  v_dummy        uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_num_groups < 2 THEN
    RAISE EXCEPTION 'Need at least 2 groups';
  END IF;

  -- clear existing data
  DELETE FROM public.fixtures  WHERE tournament_id = p_tournament_id;
  DELETE FROM public.standings WHERE tournament_id = p_tournament_id;

  -- load players in random order for group assignment
  SELECT array_agg(id ORDER BY random()) INTO v_players
  FROM public.players WHERE tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  IF v_n < p_num_groups * 2 THEN
    RAISE EXCEPTION 'Need at least % players for % groups (got %)',
      p_num_groups * 2, p_num_groups, v_n;
  END IF;

  -- assign players to groups in round-robin order
  -- player 1 → group 1, player 2 → group 2, ... player k → group (k-1 mod num_groups)+1
  FOR v_i IN 1..v_n LOOP
    v_g := ((v_i - 1) % p_num_groups) + 1;
    UPDATE public.players
    SET group_number = v_g
    WHERE id = v_players[v_i];
  END LOOP;

  -- generate round-robin within each group
  FOR v_g IN 1..p_num_groups LOOP
    SELECT array_agg(id ORDER BY created_at) INTO v_group_players
    FROM public.players
    WHERE tournament_id = p_tournament_id AND group_number = v_g;

    v_group_size := array_length(v_group_players, 1);

    -- add dummy for odd-sized groups
    IF v_group_size % 2 = 1 THEN
      v_group_players := v_group_players || null::uuid;
      v_group_size := v_group_size + 1;
    END IF;

    v_rounds := v_group_size - 1;

    FOR v_round IN 1..v_rounds LOOP
      v_schedule := v_group_players;
      FOR v_i IN 1..(v_group_size / 2) LOOP
        v_home := v_schedule[v_i];
        v_away := v_schedule[v_group_size - v_i + 1];
        IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
          INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase)
          VALUES (p_tournament_id, v_home, v_away, v_round, 'group');
        END IF;
      END LOOP;
      -- rotate (keep index 1 fixed)
      v_dummy := v_group_players[2];
      FOR v_i IN 2..(v_group_size - 1) LOOP
        v_group_players[v_i] := v_group_players[v_i + 1];
      END LOOP;
      v_group_players[v_group_size] := v_dummy;
    END LOOP;

    -- create standings rows for this group's players
    INSERT INTO public.standings(tournament_id, player_id)
    SELECT p_tournament_id, id
    FROM public.players
    WHERE tournament_id = p_tournament_id AND group_number = v_g
    ON CONFLICT (tournament_id, player_id) DO NOTHING;
  END LOOP;

  -- persist num_groups and mark active
  UPDATE public.tournaments
  SET status = 'active', num_groups = p_num_groups
  WHERE id = p_tournament_id;
END;
$$;

-- ============================================================
-- 4. advance_group_to_knockout
--    Takes the top p_teams_advancing players from each group
--    and seeds them into knockout round 1 (phase = 'knockout').
--    Seeding: 1st seeds from all groups, then 2nd seeds, etc.
--    Pairing: top seed vs bottom seed (standard bracket seeding).
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_group_to_knockout(
  p_tournament_id   uuid,
  p_teams_advancing int DEFAULT 2
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_num_groups  int;
  v_g           int;
  v_rank        int;
  v_player      uuid;
  v_qualifiers  uuid[];
  v_tier        uuid[];
  v_total       int;
  v_i           int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- ensure all group fixtures are done
  IF EXISTS (
    SELECT 1 FROM public.fixtures
    WHERE tournament_id = p_tournament_id
      AND phase = 'group'
      AND status <> 'completed'
  ) THEN
    RAISE EXCEPTION 'Not all group stage fixtures are completed';
  END IF;

  SELECT num_groups INTO v_num_groups
  FROM public.tournaments WHERE id = p_tournament_id;

  -- collect qualifiers tier by tier:
  -- first all 1st-place finishers, then all 2nd-place, etc.
  -- within each tier order by group number for consistent seeding
  v_qualifiers := array[]::uuid[];

  FOR v_rank IN 1..p_teams_advancing LOOP
    v_tier := array[]::uuid[];
    FOR v_g IN 1..v_num_groups LOOP
      SELECT s.player_id INTO v_player
      FROM public.standings s
      JOIN public.players p ON p.id = s.player_id
      WHERE s.tournament_id = p_tournament_id
        AND p.group_number   = v_g
      ORDER BY s.points DESC, s.goal_difference DESC, s.goals_for DESC
      LIMIT 1
      OFFSET (v_rank - 1);

      IF v_player IS NOT NULL THEN
        v_tier := v_tier || v_player;
      END IF;
    END LOOP;
    v_qualifiers := v_qualifiers || v_tier;
  END LOOP;

  v_total := array_length(v_qualifiers, 1);
  IF v_total < 2 THEN
    RAISE EXCEPTION 'Not enough qualifiers to create knockout fixtures';
  END IF;

  -- standard seeded bracket pairing:
  -- seed 1 vs seed N, seed 2 vs seed N-1, etc.
  v_i := 1;
  WHILE v_i <= v_total / 2 LOOP
    INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase)
    VALUES (p_tournament_id, v_qualifiers[v_i], v_qualifiers[v_total - v_i + 1], 1, 'knockout');
    v_i := v_i + 1;
  END LOOP;
END;
$$;

-- ============================================================
-- 5. process_match_result
--    Records score; updates standings for league AND group phase
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_match_result(
  p_fixture_id  uuid,
  p_home_score  int,
  p_away_score  int
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixture    public.fixtures%rowtype;
  v_tournament public.tournaments%rowtype;
BEGIN
  SELECT * INTO v_fixture FROM public.fixtures WHERE id = p_fixture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fixture not found'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_fixture.tournament_id;
  IF v_tournament.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- record the score
  UPDATE public.fixtures
  SET home_score = p_home_score,
      away_score = p_away_score,
      status     = 'completed',
      played_at  = now()
  WHERE id = p_fixture_id;

  -- update standings for league format or group phase of group_knockout
  IF v_tournament.format = 'league'
     OR (v_tournament.format = 'group_knockout' AND v_fixture.phase = 'group')
  THEN
    -- home player
    INSERT INTO public.standings(tournament_id, player_id, played, won, drawn, lost, goals_for, goals_against, points)
    VALUES (
      v_fixture.tournament_id, v_fixture.home_player_id,
      1,
      CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
      CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
      CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
      p_home_score, p_away_score,
      CASE WHEN p_home_score > p_away_score THEN 3 WHEN p_home_score = p_away_score THEN 1 ELSE 0 END
    )
    ON CONFLICT (tournament_id, player_id) DO UPDATE SET
      played        = standings.played + 1,
      won           = standings.won   + excluded.won,
      drawn         = standings.drawn + excluded.drawn,
      lost          = standings.lost  + excluded.lost,
      goals_for     = standings.goals_for     + excluded.goals_for,
      goals_against = standings.goals_against + excluded.goals_against,
      points        = standings.points + excluded.points;

    -- away player
    INSERT INTO public.standings(tournament_id, player_id, played, won, drawn, lost, goals_for, goals_against, points)
    VALUES (
      v_fixture.tournament_id, v_fixture.away_player_id,
      1,
      CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
      CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
      CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
      p_away_score, p_home_score,
      CASE WHEN p_away_score > p_home_score THEN 3 WHEN p_home_score = p_away_score THEN 1 ELSE 0 END
    )
    ON CONFLICT (tournament_id, player_id) DO UPDATE SET
      played        = standings.played + 1,
      won           = standings.won   + excluded.won,
      drawn         = standings.drawn + excluded.drawn,
      lost          = standings.lost  + excluded.lost,
      goals_for     = standings.goals_for     + excluded.goals_for,
      goals_against = standings.goals_against + excluded.goals_against,
      points        = standings.points + excluded.points;
  END IF;
END;
$$;

-- ============================================================
-- 6. advance_knockout_round
--    Phase-aware: works for 'regular' knockout and the
--    'knockout' phase of a group_knockout tournament.
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_knockout_round(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_active_phase   text;
  v_current_round  int;
  v_winners        uuid[];
  v_fixture        record;
  v_i              int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- determine which phase to advance
  IF EXISTS (
    SELECT 1 FROM public.fixtures
    WHERE tournament_id = p_tournament_id AND phase = 'knockout'
  ) THEN
    v_active_phase := 'knockout';
  ELSE
    v_active_phase := 'regular';
  END IF;

  -- get the highest completed round in that phase
  SELECT max(round) INTO v_current_round
  FROM public.fixtures
  WHERE tournament_id = p_tournament_id
    AND phase  = v_active_phase
    AND status = 'completed';

  IF v_current_round IS NULL THEN
    RAISE EXCEPTION 'No completed fixtures found in phase %', v_active_phase;
  END IF;

  -- ensure all fixtures in that round are done
  IF EXISTS (
    SELECT 1 FROM public.fixtures
    WHERE tournament_id = p_tournament_id
      AND phase  = v_active_phase
      AND round  = v_current_round
      AND status <> 'completed'
  ) THEN
    RAISE EXCEPTION 'Not all fixtures in round % are completed', v_current_round;
  END IF;

  -- collect winners
  v_winners := array[]::uuid[];
  FOR v_fixture IN
    SELECT * FROM public.fixtures
    WHERE tournament_id = p_tournament_id
      AND phase  = v_active_phase
      AND round  = v_current_round
    ORDER BY created_at
  LOOP
    IF v_fixture.home_score > v_fixture.away_score THEN
      v_winners := v_winners || v_fixture.home_player_id;
    ELSIF v_fixture.away_score > v_fixture.home_score THEN
      v_winners := v_winners || v_fixture.away_player_id;
    ELSE
      -- draw: home advances (penalty shootout can be added later)
      v_winners := v_winners || v_fixture.home_player_id;
    END IF;
  END LOOP;

  IF array_length(v_winners, 1) = 1 THEN
    -- tournament complete
    UPDATE public.tournaments SET status = 'completed' WHERE id = p_tournament_id;
    RETURN;
  END IF;

  -- create next round fixtures in the same phase
  v_i := 1;
  WHILE v_i < array_length(v_winners, 1) LOOP
    INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase)
    VALUES (p_tournament_id, v_winners[v_i], v_winners[v_i + 1], v_current_round + 1, v_active_phase);
    v_i := v_i + 2;
  END LOOP;
END;
$$;
