-- ============================================================
-- eFootball Tournaments – RPC Functions
-- Run AFTER supabase-schema.sql
-- ============================================================

-- ============================================================
-- 1. generate_league_fixtures
--    Creates a round-robin schedule for all players in a tournament
-- ============================================================
create or replace function public.generate_league_fixtures(p_tournament_id uuid)
returns void language plpgsql security definer as $$
declare
  v_players uuid[];
  v_n int;
  v_rounds int;
  v_round int;
  v_i int;
  v_j int;
  v_home uuid;
  v_away uuid;
  v_dummy uuid;
  v_schedule uuid[];
begin
  -- verify caller owns the tournament
  if not exists (
    select 1 from public.tournaments
    where id = p_tournament_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  -- clear existing fixtures
  delete from public.fixtures where tournament_id = p_tournament_id;

  -- load players
  select array_agg(id order by created_at) into v_players
  from public.players where tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  if v_n < 2 then
    raise exception 'Need at least 2 players';
  end if;

  -- add dummy if odd number
  if v_n % 2 = 1 then
    v_players := v_players || null::uuid;
    v_n := v_n + 1;
  end if;

  v_rounds := v_n - 1;

  for v_round in 1..v_rounds loop
    v_schedule := v_players;
    -- rotate: fix first element, rotate rest
    for v_i in 1..(v_n/2) loop
      v_home := v_schedule[v_i];
      v_away := v_schedule[v_n - v_i + 1];
      -- skip if either is the dummy
      if v_home is not null and v_away is not null then
        insert into public.fixtures(tournament_id, home_player_id, away_player_id, round)
        values (p_tournament_id, v_home, v_away, v_round);
      end if;
    end loop;
    -- rotate array (keep index 1 fixed, rotate 2..n)
    v_dummy := v_players[2];
    for v_i in 2..(v_n - 1) loop
      v_players[v_i] := v_players[v_i + 1];
    end loop;
    v_players[v_n] := v_dummy;
  end loop;

  -- upsert standings rows
  insert into public.standings(tournament_id, player_id)
  select p_tournament_id, id from public.players where tournament_id = p_tournament_id
  on conflict (tournament_id, player_id) do nothing;

  -- mark tournament active
  update public.tournaments set status = 'active' where id = p_tournament_id;
end;
$$;

-- ============================================================
-- 2. generate_knockout_fixtures
--    Seeds round 1 of a single-elimination bracket
-- ============================================================
create or replace function public.generate_knockout_fixtures(p_tournament_id uuid)
returns void language plpgsql security definer as $$
declare
  v_players uuid[];
  v_n int;
  v_i int;
begin
  if not exists (
    select 1 from public.tournaments
    where id = p_tournament_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  delete from public.fixtures where tournament_id = p_tournament_id;

  -- shuffle players randomly
  select array_agg(id order by random()) into v_players
  from public.players where tournament_id = p_tournament_id;

  v_n := array_length(v_players, 1);
  if v_n < 2 then
    raise exception 'Need at least 2 players';
  end if;

  -- pair them up: 1v2, 3v4, ...
  v_i := 1;
  while v_i < v_n loop
    insert into public.fixtures(tournament_id, home_player_id, away_player_id, round)
    values (p_tournament_id, v_players[v_i], v_players[v_i + 1], 1);
    v_i := v_i + 2;
  end loop;

  update public.tournaments set status = 'active' where id = p_tournament_id;
end;
$$;

-- ============================================================
-- 3. process_match_result
--    Records score and updates league standings
-- ============================================================
create or replace function public.process_match_result(
  p_fixture_id uuid,
  p_home_score int,
  p_away_score int
)
returns void language plpgsql security definer as $$
declare
  v_fixture public.fixtures%rowtype;
  v_tournament public.tournaments%rowtype;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;

  select * into v_tournament from public.tournaments where id = v_fixture.tournament_id;
  if v_tournament.owner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  -- update fixture
  update public.fixtures
  set home_score = p_home_score,
      away_score = p_away_score,
      status = 'completed',
      played_at = now()
  where id = p_fixture_id;

  -- update standings only for league format
  if v_tournament.format = 'league' then
    -- home player
    insert into public.standings(tournament_id, player_id, played, won, drawn, lost, goals_for, goals_against, points)
    values (
      v_fixture.tournament_id, v_fixture.home_player_id,
      1,
      case when p_home_score > p_away_score then 1 else 0 end,
      case when p_home_score = p_away_score then 1 else 0 end,
      case when p_home_score < p_away_score then 1 else 0 end,
      p_home_score, p_away_score,
      case when p_home_score > p_away_score then 3 when p_home_score = p_away_score then 1 else 0 end
    )
    on conflict (tournament_id, player_id) do update set
      played = standings.played + 1,
      won = standings.won + excluded.won,
      drawn = standings.drawn + excluded.drawn,
      lost = standings.lost + excluded.lost,
      goals_for = standings.goals_for + excluded.goals_for,
      goals_against = standings.goals_against + excluded.goals_against,
      points = standings.points + excluded.points;

    -- away player
    insert into public.standings(tournament_id, player_id, played, won, drawn, lost, goals_for, goals_against, points)
    values (
      v_fixture.tournament_id, v_fixture.away_player_id,
      1,
      case when p_away_score > p_home_score then 1 else 0 end,
      case when p_home_score = p_away_score then 1 else 0 end,
      case when p_away_score < p_home_score then 1 else 0 end,
      p_away_score, p_home_score,
      case when p_away_score > p_home_score then 3 when p_home_score = p_away_score then 1 else 0 end
    )
    on conflict (tournament_id, player_id) do update set
      played = standings.played + 1,
      won = standings.won + excluded.won,
      drawn = standings.drawn + excluded.drawn,
      lost = standings.lost + excluded.lost,
      goals_for = standings.goals_for + excluded.goals_for,
      goals_against = standings.goals_against + excluded.goals_against,
      points = standings.points + excluded.points;
  end if;
end;
$$;

-- ============================================================
-- 4. advance_knockout_round
--    Generates next round fixtures from completed round winners
-- ============================================================
create or replace function public.advance_knockout_round(p_tournament_id uuid)
returns void language plpgsql security definer as $$
declare
  v_current_round int;
  v_winners uuid[];
  v_fixture record;
  v_i int;
begin
  if not exists (
    select 1 from public.tournaments
    where id = p_tournament_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  -- get the highest completed round
  select max(round) into v_current_round
  from public.fixtures
  where tournament_id = p_tournament_id and status = 'completed';

  if v_current_round is null then
    raise exception 'No completed fixtures found';
  end if;

  -- check all fixtures in current round are done
  if exists (
    select 1 from public.fixtures
    where tournament_id = p_tournament_id
      and round = v_current_round
      and status <> 'completed'
  ) then
    raise exception 'Not all fixtures in round % are completed', v_current_round;
  end if;

  -- collect winners
  v_winners := array[]::uuid[];
  for v_fixture in
    select * from public.fixtures
    where tournament_id = p_tournament_id and round = v_current_round
    order by created_at
  loop
    if v_fixture.home_score > v_fixture.away_score then
      v_winners := v_winners || v_fixture.home_player_id;
    elsif v_fixture.away_score > v_fixture.home_score then
      v_winners := v_winners || v_fixture.away_player_id;
    else
      -- draw: home advances (can be changed to penalties logic)
      v_winners := v_winners || v_fixture.home_player_id;
    end if;
  end loop;

  if array_length(v_winners, 1) = 1 then
    -- tournament over
    update public.tournaments set status = 'completed' where id = p_tournament_id;
    return;
  end if;

  -- create next round fixtures
  v_i := 1;
  while v_i < array_length(v_winners, 1) loop
    insert into public.fixtures(tournament_id, home_player_id, away_player_id, round)
    values (p_tournament_id, v_winners[v_i], v_winners[v_i + 1], v_current_round + 1);
    v_i := v_i + 2;
  end loop;
end;
$$;
