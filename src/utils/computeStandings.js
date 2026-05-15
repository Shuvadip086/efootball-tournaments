/**
 * Compute standings directly from completed fixtures.
 * This is the single source of truth — never relies on the DB `standings`
 * table (which can drift if a fixture's score was edited after first save,
 * because the trigger increments instead of replacing).
 *
 * Returns rows in the same shape the UI expects:
 *   { id, player_id, played, won, drawn, lost, goals_for, goals_against,
 *     goal_difference, points }
 */
export function computeStandings(fixtures, players, { phase } = {}) {
  // Initialise a zero row for every player so they always show up.
  const rows = {}
  players.forEach(p => {
    rows[p.id] = {
      id:              `derived-${p.id}`,
      player_id:       p.id,
      played:          0,
      won:             0,
      drawn:           0,
      lost:            0,
      goals_for:       0,
      goals_against:   0,
      goal_difference: 0,
      points:          0,
    }
  })

  fixtures
    .filter(f => f.status === 'completed')
    .filter(f => !phase || f.phase === phase)
    .forEach(f => {
      const h = f.home_score ?? 0
      const a = f.away_score ?? 0
      const home = rows[f.home_player_id]
      const away = rows[f.away_player_id]
      if (!home || !away) return

      home.played += 1
      away.played += 1
      home.goals_for     += h
      home.goals_against += a
      away.goals_for     += a
      away.goals_against += h

      if (h > a) {
        home.won  += 1; home.points += 3
        away.lost += 1
      } else if (a > h) {
        away.won  += 1; away.points += 3
        home.lost += 1
      } else {
        home.drawn += 1; home.points += 1
        away.drawn += 1; away.points += 1
      }
    })

  return Object.values(rows).map(r => ({
    ...r,
    goal_difference: r.goals_for - r.goals_against,
  }))
}
