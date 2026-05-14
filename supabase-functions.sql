-- ============================================================
-- eFootball Tournaments – RPC Functions (Full Updated Version)
-- Run AFTER all migration SQL files
-- ============================================================

-- ============================================================
-- 1. generate_league_fixtures
--    Round-robin schedule. With home_away=true each pair plays
--    twice (home leg + away leg), sharing a pair_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_league_fixtures(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_home_away  boolean;
  v_players    uuid[];
  v_n          int;
  v_rounds     int;
  v_round      int;
  v_i          int;
  v_home       uuid;
  v_away       uuid;
  v_dummy      uuid;
  v_schedule   uuid[];
  v_pair_id    uuid;
  -- store first-leg pairs for second-leg insertion
  v_leg1_home  uuid[];
  v_leg1_away  uuid[];
  v_leg1_ids   uuid[];
  v_leg1_round int[];
  v_pair_count int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT home_away INTO v_home_away FROM public.tournaments WHERE id = p_tournament_id;

  DELETE FROM public.fixtures  WHERE tournament_id = p_tournament_id;
  DELETE FROM public.standings WHERE tournament_id = p_tournament_id;

  SELECT array_agg(id ORDER BY created_at) INTO v_players
  FROM public.players WHERE tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  IF v_n < 2 THEN RAISE EXCEPTION 'Need at least 2 players'; END IF;

  IF v_n % 2 = 1 THEN v_players := v_players || null::uuid; v_n := v_n + 1; END IF;
  v_rounds := v_n - 1;

  v_leg1_home  := array[]::uuid[];
  v_leg1_away  := array[]::uuid[];
  v_leg1_ids   := array[]::uuid[];
  v_leg1_round := array[]::int[];

  -- First leg
  FOR v_round IN 1..v_rounds LOOP
    v_schedule := v_players;
    FOR v_i IN 1..(v_n/2) LOOP
      v_home := v_schedule[v_i];
      v_away := v_schedule[v_n - v_i + 1];
      IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
        v_pair_id := CASE WHEN v_home_away THEN uuid_generate_v4() ELSE NULL END;
        INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
        VALUES (p_tournament_id, v_home, v_away, v_round, 'regular', 1, v_pair_id);
        IF v_home_away THEN
          v_pair_count  := v_pair_count + 1;
          v_leg1_home  := v_leg1_home  || v_home;
          v_leg1_away  := v_leg1_away  || v_away;
          v_leg1_ids   := v_leg1_ids   || v_pair_id;
          v_leg1_round := v_leg1_round || v_round;
        END IF;
      END IF;
    END LOOP;
    v_dummy := v_players[2];
    FOR v_i IN 2..(v_n-1) LOOP v_players[v_i] := v_players[v_i+1]; END LOOP;
    v_players[v_n] := v_dummy;
  END LOOP;

  -- Second leg (reversed home/away, rounds v_rounds+1 ... 2*v_rounds)
  IF v_home_away THEN
    FOR v_i IN 1..v_pair_count LOOP
      INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
      VALUES (p_tournament_id, v_leg1_away[v_i], v_leg1_home[v_i],
              v_leg1_round[v_i] + v_rounds, 'regular', 2, v_leg1_ids[v_i]);
    END LOOP;
  END IF;

  INSERT INTO public.standings(tournament_id, player_id)
  SELECT p_tournament_id, id FROM public.players WHERE tournament_id = p_tournament_id
  ON CONFLICT (tournament_id, player_id) DO NOTHING;

  UPDATE public.tournaments SET status = 'active' WHERE id = p_tournament_id;
END;
$$;

-- ============================================================
-- 2. generate_knockout_fixtures
--    Round 1 bracket. With home_away=true each matchup gets
--    leg 1 and leg 2 (reversed H/A), sharing a pair_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_knockout_fixtures(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_home_away boolean;
  v_players   uuid[];
  v_n         int;
  v_i         int;
  v_pair_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT home_away INTO v_home_away FROM public.tournaments WHERE id = p_tournament_id;

  DELETE FROM public.fixtures WHERE tournament_id = p_tournament_id;

  SELECT array_agg(id ORDER BY random()) INTO v_players
  FROM public.players WHERE tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  IF v_n < 2 THEN RAISE EXCEPTION 'Need at least 2 players'; END IF;

  v_i := 1;
  WHILE v_i < v_n LOOP
    v_pair_id := CASE WHEN v_home_away THEN uuid_generate_v4() ELSE NULL END;
    INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
    VALUES (p_tournament_id, v_players[v_i], v_players[v_i+1], 1, 'regular', 1, v_pair_id);
    IF v_home_away THEN
      INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
      VALUES (p_tournament_id, v_players[v_i+1], v_players[v_i], 1, 'regular', 2, v_pair_id);
    END IF;
    v_i := v_i + 2;
  END LOOP;

  UPDATE public.tournaments SET status = 'active' WHERE id = p_tournament_id;
END;
$$;

-- ============================================================
-- 3. generate_group_stage_fixtures
--    Round-robin within groups. home_away=true doubles each pair.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_group_stage_fixtures(
  p_tournament_id uuid,
  p_num_groups    int DEFAULT 4
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_home_away    boolean;
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
  v_pair_id      uuid;
  v_leg1_home    uuid[];
  v_leg1_away    uuid[];
  v_leg1_ids     uuid[];
  v_leg1_round   int[];
  v_pair_count   int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF p_num_groups < 2 THEN RAISE EXCEPTION 'Need at least 2 groups'; END IF;

  SELECT home_away INTO v_home_away FROM public.tournaments WHERE id = p_tournament_id;

  DELETE FROM public.fixtures  WHERE tournament_id = p_tournament_id;
  DELETE FROM public.standings WHERE tournament_id = p_tournament_id;

  SELECT array_agg(id ORDER BY random()) INTO v_players
  FROM public.players WHERE tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  IF v_n < p_num_groups * 2 THEN
    RAISE EXCEPTION 'Need at least % players for % groups (got %)', p_num_groups * 2, p_num_groups, v_n;
  END IF;

  FOR v_i IN 1..v_n LOOP
    UPDATE public.players SET group_number = ((v_i-1) % p_num_groups) + 1
    WHERE id = v_players[v_i];
  END LOOP;

  FOR v_g IN 1..p_num_groups LOOP
    SELECT array_agg(id ORDER BY created_at) INTO v_group_players
    FROM public.players WHERE tournament_id = p_tournament_id AND group_number = v_g;

    v_group_size := array_length(v_group_players, 1);
    IF v_group_size % 2 = 1 THEN
      v_group_players := v_group_players || null::uuid;
      v_group_size := v_group_size + 1;
    END IF;
    v_rounds := v_group_size - 1;

    v_leg1_home  := array[]::uuid[];
    v_leg1_away  := array[]::uuid[];
    v_leg1_ids   := array[]::uuid[];
    v_leg1_round := array[]::int[];
    v_pair_count := 0;

    FOR v_round IN 1..v_rounds LOOP
      v_schedule := v_group_players;
      FOR v_i IN 1..(v_group_size/2) LOOP
        v_home := v_schedule[v_i];
        v_away := v_schedule[v_group_size - v_i + 1];
        IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
          v_pair_id := CASE WHEN v_home_away THEN uuid_generate_v4() ELSE NULL END;
          INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
          VALUES (p_tournament_id, v_home, v_away, v_round, 'group', 1, v_pair_id);
          IF v_home_away THEN
            v_pair_count  := v_pair_count + 1;
            v_leg1_home  := v_leg1_home  || v_home;
            v_leg1_away  := v_leg1_away  || v_away;
            v_leg1_ids   := v_leg1_ids   || v_pair_id;
            v_leg1_round := v_leg1_round || v_round;
          END IF;
        END IF;
      END LOOP;
      v_dummy := v_group_players[2];
      FOR v_i IN 2..(v_group_size-1) LOOP v_group_players[v_i] := v_group_players[v_i+1]; END LOOP;
      v_group_players[v_group_size] := v_dummy;
    END LOOP;

    IF v_home_away THEN
      FOR v_i IN 1..v_pair_count LOOP
        INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
        VALUES (p_tournament_id, v_leg1_away[v_i], v_leg1_home[v_i],
                v_leg1_round[v_i] + v_rounds, 'group', 2, v_leg1_ids[v_i]);
      END LOOP;
    END IF;

    INSERT INTO public.standings(tournament_id, player_id)
    SELECT p_tournament_id, id FROM public.players
    WHERE tournament_id = p_tournament_id AND group_number = v_g
    ON CONFLICT (tournament_id, player_id) DO NOTHING;
  END LOOP;

  UPDATE public.tournaments SET status = 'active', num_groups = p_num_groups
  WHERE id = p_tournament_id;
END;
$$;

-- ============================================================
-- 4. advance_group_to_knockout
--    Seeded bracket from top N per group. Uses tournament.teams_advancing.
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_group_to_knockout(
  p_tournament_id   uuid,
  p_teams_advancing int DEFAULT 2
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_home_away   boolean;
  v_num_groups  int;
  v_g           int;
  v_rank        int;
  v_player      uuid;
  v_qualifiers  uuid[];
  v_tier        uuid[];
  v_total       int;
  v_i           int;
  v_pair_id     uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.fixtures
    WHERE tournament_id = p_tournament_id AND phase = 'group' AND status <> 'completed'
  ) THEN RAISE EXCEPTION 'Not all group stage fixtures are completed'; END IF;

  SELECT num_groups, home_away INTO v_num_groups, v_home_away
  FROM public.tournaments WHERE id = p_tournament_id;

  v_qualifiers := array[]::uuid[];
  FOR v_rank IN 1..p_teams_advancing LOOP
    v_tier := array[]::uuid[];
    FOR v_g IN 1..v_num_groups LOOP
      SELECT s.player_id INTO v_player
      FROM public.standings s
      JOIN public.players p ON p.id = s.player_id
      WHERE s.tournament_id = p_tournament_id AND p.group_number = v_g
      ORDER BY s.points DESC, s.goal_difference DESC, s.goals_for DESC
      LIMIT 1 OFFSET (v_rank - 1);
      IF v_player IS NOT NULL THEN v_tier := v_tier || v_player; END IF;
    END LOOP;
    v_qualifiers := v_qualifiers || v_tier;
  END LOOP;

  v_total := array_length(v_qualifiers, 1);
  IF v_total < 2 THEN RAISE EXCEPTION 'Not enough qualifiers'; END IF;

  -- Seeded pairing: seed 1 vs seed N, seed 2 vs seed N-1, etc.
  v_i := 1;
  WHILE v_i <= v_total / 2 LOOP
    v_pair_id := CASE WHEN v_home_away THEN uuid_generate_v4() ELSE NULL END;
    INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
    VALUES (p_tournament_id, v_qualifiers[v_i], v_qualifiers[v_total - v_i + 1], 1, 'knockout', 1, v_pair_id);
    IF v_home_away THEN
      INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
      VALUES (p_tournament_id, v_qualifiers[v_total - v_i + 1], v_qualifiers[v_i], 1, 'knockout', 2, v_pair_id);
    END IF;
    v_i := v_i + 1;
  END LOOP;
END;
$$;

-- ============================================================
-- 5. process_match_result
--    Records score; updates standings for league + group phase.
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
  IF v_tournament.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.fixtures
  SET home_score = p_home_score, away_score = p_away_score,
      status = 'completed', played_at = now()
  WHERE id = p_fixture_id;

  IF v_tournament.format = 'league'
     OR (v_tournament.format = 'group_knockout' AND v_fixture.phase = 'group')
  THEN
    INSERT INTO public.standings(tournament_id, player_id, played, won, drawn, lost, goals_for, goals_against, points)
    VALUES (
      v_fixture.tournament_id, v_fixture.home_player_id, 1,
      CASE WHEN p_home_score > p_away_score THEN 1 ELSE 0 END,
      CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
      CASE WHEN p_home_score < p_away_score THEN 1 ELSE 0 END,
      p_home_score, p_away_score,
      CASE WHEN p_home_score > p_away_score THEN 3 WHEN p_home_score = p_away_score THEN 1 ELSE 0 END
    )
    ON CONFLICT (tournament_id, player_id) DO UPDATE SET
      played = standings.played+1, won = standings.won+excluded.won,
      drawn = standings.drawn+excluded.drawn, lost = standings.lost+excluded.lost,
      goals_for = standings.goals_for+excluded.goals_for,
      goals_against = standings.goals_against+excluded.goals_against,
      points = standings.points+excluded.points;

    INSERT INTO public.standings(tournament_id, player_id, played, won, drawn, lost, goals_for, goals_against, points)
    VALUES (
      v_fixture.tournament_id, v_fixture.away_player_id, 1,
      CASE WHEN p_away_score > p_home_score THEN 1 ELSE 0 END,
      CASE WHEN p_home_score = p_away_score THEN 1 ELSE 0 END,
      CASE WHEN p_away_score < p_home_score THEN 1 ELSE 0 END,
      p_away_score, p_home_score,
      CASE WHEN p_away_score > p_home_score THEN 3 WHEN p_home_score = p_away_score THEN 1 ELSE 0 END
    )
    ON CONFLICT (tournament_id, player_id) DO UPDATE SET
      played = standings.played+1, won = standings.won+excluded.won,
      drawn = standings.drawn+excluded.drawn, lost = standings.lost+excluded.lost,
      goals_for = standings.goals_for+excluded.goals_for,
      goals_against = standings.goals_against+excluded.goals_against,
      points = standings.points+excluded.points;
  END IF;
END;
$$;

-- ============================================================
-- 6. advance_knockout_round
--    Phase-aware. Supports single-leg and 2-legged (aggregate) ties.
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_knockout_round(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_home_away     boolean;
  v_active_phase  text;
  v_current_round int;
  v_winners       uuid[];
  v_fixture       record;
  v_leg1          public.fixtures%rowtype;
  v_leg2          public.fixtures%rowtype;
  v_a_goals       int;
  v_b_goals       int;
  v_pid           uuid;
  v_i             int;
  v_pair_id       uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT home_away INTO v_home_away FROM public.tournaments WHERE id = p_tournament_id;

  v_active_phase := CASE
    WHEN EXISTS (SELECT 1 FROM public.fixtures WHERE tournament_id = p_tournament_id AND phase = 'knockout')
    THEN 'knockout' ELSE 'regular' END;

  -- Highest round where ALL fixtures are completed
  SELECT max(r.round) INTO v_current_round FROM (
    SELECT round,
           count(*) AS total,
           count(*) FILTER (WHERE status = 'completed') AS done
    FROM public.fixtures
    WHERE tournament_id = p_tournament_id AND phase = v_active_phase
    GROUP BY round
    HAVING count(*) = count(*) FILTER (WHERE status = 'completed')
  ) r;

  IF v_current_round IS NULL THEN
    RAISE EXCEPTION 'No fully-completed round found in phase %', v_active_phase;
  END IF;

  v_winners := array[]::uuid[];

  IF v_home_away THEN
    -- 2-legged: group by pair_id, calculate aggregate
    FOR v_pid IN
      SELECT DISTINCT pair_id FROM public.fixtures
      WHERE tournament_id = p_tournament_id AND phase = v_active_phase
        AND round = v_current_round AND pair_id IS NOT NULL
      ORDER BY pair_id
    LOOP
      SELECT * INTO v_leg1 FROM public.fixtures
      WHERE pair_id = v_pid AND leg = 1 LIMIT 1;
      SELECT * INTO v_leg2 FROM public.fixtures
      WHERE pair_id = v_pid AND leg = 2 LIMIT 1;

      -- Player A = leg1 home; Player B = leg1 away
      v_a_goals := COALESCE(v_leg1.home_score, 0) + COALESCE(v_leg2.away_score, 0);
      v_b_goals := COALESCE(v_leg1.away_score, 0) + COALESCE(v_leg2.home_score, 0);

      IF v_a_goals >= v_b_goals THEN
        v_winners := v_winners || v_leg1.home_player_id;
      ELSE
        v_winners := v_winners || v_leg1.away_player_id;
      END IF;
    END LOOP;
  ELSE
    -- Single-leg: winner per fixture
    FOR v_fixture IN
      SELECT * FROM public.fixtures
      WHERE tournament_id = p_tournament_id AND phase = v_active_phase
        AND round = v_current_round
      ORDER BY created_at
    LOOP
      IF v_fixture.home_score > v_fixture.away_score THEN
        v_winners := v_winners || v_fixture.home_player_id;
      ELSIF v_fixture.away_score > v_fixture.home_score THEN
        v_winners := v_winners || v_fixture.away_player_id;
      ELSE
        v_winners := v_winners || v_fixture.home_player_id;
      END IF;
    END LOOP;
  END IF;

  IF array_length(v_winners, 1) = 1 THEN
    UPDATE public.tournaments SET status = 'completed' WHERE id = p_tournament_id;
    RETURN;
  END IF;

  -- Create next round
  v_i := 1;
  WHILE v_i < array_length(v_winners, 1) LOOP
    v_pair_id := CASE WHEN v_home_away THEN uuid_generate_v4() ELSE NULL END;
    INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
    VALUES (p_tournament_id, v_winners[v_i], v_winners[v_i+1], v_current_round+1, v_active_phase, 1, v_pair_id);
    IF v_home_away THEN
      INSERT INTO public.fixtures(tournament_id, home_player_id, away_player_id, round, phase, leg, pair_id)
      VALUES (p_tournament_id, v_winners[v_i+1], v_winners[v_i], v_current_round+1, v_active_phase, 2, v_pair_id);
    END IF;
    v_i := v_i + 2;
  END LOOP;
END;
$$;
