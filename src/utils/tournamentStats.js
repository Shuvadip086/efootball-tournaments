/**
 * Tournament-wide statistics, computed entirely from completed
 * fixtures. Inspired by the season-end UEFA Champions League stats
 * dashboard (top scorer, best attack, best defence, clean sheets,
 * biggest win, highest-scoring match, etc.).
 *
 * Input:
 *   fixtures   – array of fixture rows
 *   players    – array of player rows
 *   tournament – optional, used for header metadata
 *
 * Output object keys are documented below.
 */
export function computeTournamentStats(fixtures, players, tournament) {
  const completed = (fixtures ?? []).filter(f => f.status === 'completed')
  const totalMatches = completed.length

  let totalGoals = 0
  const perPlayer = {} // { [id]: { matches, gf, ga, won, drawn, lost, cleanSheets, biggestWin } }
  players?.forEach(p => {
    perPlayer[p.id] = {
      // Carry the whole player row so callers (e.g. TopScorersPoster)
      // can read photo_data_url / tournament_id directly.
      ...p,
      id: p.id, name: p.name,
      matches: 0, gf: 0, ga: 0,
      won: 0, drawn: 0, lost: 0,
      cleanSheets: 0,
    }
  })

  let highestScoring = null  // { fixture, total }
  let biggestWin    = null  // { fixture, margin }

  completed.forEach(f => {
    const hs = f.home_score ?? 0
    const as = f.away_score ?? 0
    totalGoals += hs + as

    const sum = hs + as
    if (!highestScoring || sum > highestScoring.total) {
      highestScoring = { fixture: f, total: sum }
    }
    const margin = Math.abs(hs - as)
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = { fixture: f, margin }
    }

    const home = perPlayer[f.home_player_id]
    const away = perPlayer[f.away_player_id]
    if (home) {
      home.matches += 1
      home.gf += hs; home.ga += as
      if (as === 0) home.cleanSheets += 1
      if (hs > as) home.won += 1
      else if (hs < as) home.lost += 1
      else home.drawn += 1
    }
    if (away) {
      away.matches += 1
      away.gf += as; away.ga += hs
      if (hs === 0) away.cleanSheets += 1
      if (as > hs) away.won += 1
      else if (as < hs) away.lost += 1
      else away.drawn += 1
    }
  })

  const playerList = Object.values(perPlayer).filter(p => p.matches > 0)

  // Derived per-player metrics
  playerList.forEach(p => {
    p.gd       = p.gf - p.ga
    p.avgGF    = p.matches ? p.gf / p.matches : 0
    p.avgGA    = p.matches ? p.ga / p.matches : 0
    p.points   = p.won * 3 + p.drawn
  })

  const topScorers   = [...playerList].sort((a, b) => b.gf - a.gf || a.ga - b.ga || b.matches - a.matches).slice(0, 5)
  const bestAttack   = playerList.length ? [...playerList].sort((a, b) => b.gf - a.gf)[0] : null
  const bestDefence  = playerList.length ? [...playerList].sort((a, b) => a.ga - b.ga || b.matches - a.matches)[0] : null
  const cleanSheets  = playerList.length ? [...playerList].sort((a, b) => b.cleanSheets - a.cleanSheets)[0] : null
  const mostMatches  = playerList.length ? [...playerList].sort((a, b) => b.matches - a.matches)[0] : null
  const mostWins     = playerList.length ? [...playerList].sort((a, b) => b.won - a.won)[0] : null

  // Tournament duration in days (created_at → most recent played_at)
  let durationDays = null
  if (tournament?.created_at) {
    const start = new Date(tournament.created_at).getTime()
    const lastPlayed = completed.reduce((max, f) => {
      const t = f.played_at ? new Date(f.played_at).getTime() : 0
      return Math.max(max, t)
    }, 0)
    const end = lastPlayed > 0 ? lastPlayed : Date.now()
    durationDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  }

  return {
    totalMatches,
    totalGoals,
    avgGoalsPerMatch: totalMatches ? totalGoals / totalMatches : 0,
    totalPlayers:    players?.length ?? 0,

    topScorers,        // top 5 (use first 3 for the poster, more for the stats grid)
    bestAttack,        // player with most goals scored
    bestDefence,       // player with fewest goals conceded
    cleanSheets,       // player with most clean sheets
    mostMatches,       // player who played the most matches
    mostWins,          // player with most wins

    highestScoring,    // { fixture, total } biggest combined-goal match
    biggestWin,        // { fixture, margin } biggest goal-margin win

    durationDays,
  }
}
