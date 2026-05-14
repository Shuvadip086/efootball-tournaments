/**
 * Calculate top scorers from completed fixtures.
 * "Goals" here means total goals the player has put on the board across
 * all completed matches (sum of home_score when home + away_score when away).
 * No new tables required — purely derived from existing fixtures rows.
 */
export function calculateTopScorers(fixtures, players) {
  const goals    = {}
  const matches  = {}
  const conceded = {}
  const wins     = {}

  players.forEach(p => {
    goals[p.id] = 0
    matches[p.id] = 0
    conceded[p.id] = 0
    wins[p.id] = 0
  })

  fixtures
    .filter(f => f.status === 'completed')
    .forEach(f => {
      const h = f.home_score ?? 0
      const a = f.away_score ?? 0
      if (f.home_player_id in goals) {
        goals[f.home_player_id]    += h
        conceded[f.home_player_id] += a
        matches[f.home_player_id]  += 1
        if (h > a) wins[f.home_player_id] += 1
      }
      if (f.away_player_id in goals) {
        goals[f.away_player_id]    += a
        conceded[f.away_player_id] += h
        matches[f.away_player_id]  += 1
        if (a > h) wins[f.away_player_id] += 1
      }
    })

  return players
    .map(p => ({
      player:   p,
      goals:    goals[p.id]    ?? 0,
      conceded: conceded[p.id] ?? 0,
      matches:  matches[p.id]  ?? 0,
      wins:     wins[p.id]     ?? 0,
      avg:      matches[p.id]
        ? (goals[p.id] / matches[p.id]).toFixed(2)
        : '0.00',
    }))
    .filter(s => s.matches > 0)
    .sort((a, b) =>
      b.goals - a.goals ||
      a.conceded - b.conceded ||
      b.matches - a.matches
    )
}
