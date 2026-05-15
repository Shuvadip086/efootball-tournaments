/**
 * Adds fixtures ONLY for player pairings that don't already have one.
 * Existing fixtures (and their scores) are never touched — safe to run
 * mid-tournament after adding new players.
 *
 * Rules per format:
 *   - league          → every player pair must have a fixture
 *   - group_knockout  → every pair within the same group must have a
 *                       fixture (phase = 'group'). Knockout fixtures
 *                       are ignored.
 *   - knockout        → not supported (single-elim bracket — would
 *                       break the seeding)
 *
 * With home_away = true each new pair gets two fixtures sharing a
 * pair_id (leg 1 home/away + leg 2 reversed), matching the
 * round-robin schedule the SQL function would produce.
 *
 * Returns { added, skipped } counts for UI feedback.
 */
import { supabase } from '../supabaseClient'

function pairKey(a, b) {
  return [a, b].sort().join('|')
}

export async function addMissingFixtures({ tournament, players, fixtures }) {
  if (tournament.format === 'knockout') {
    throw new Error('Knockout format is not supported — the bracket would need re-seeding.')
  }

  const homeAway = !!tournament.home_away
  const phase    = tournament.format === 'group_knockout' ? 'group' : 'regular'

  // For group_knockout we only care about group-phase fixtures.
  const relevantFx = fixtures.filter(f => (f.phase ?? 'regular') === phase)

  // Build set of existing pairs.
  const existingPairs = new Set()
  relevantFx.forEach(f => {
    existingPairs.add(pairKey(f.home_player_id, f.away_player_id))
  })

  // Highest round seen so far — new fixtures append after it.
  const maxRound = relevantFx.reduce((m, f) => Math.max(m, f.round ?? 1), 0)
  const newLeg1Round = maxRound + 1
  const newLeg2Round = maxRound + 2

  // Determine the pairs that *should* exist.
  const want = []
  if (tournament.format === 'league') {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        want.push([players[i], players[j]])
      }
    }
  } else {
    // group_knockout — only pairs within the same group
    const byGroup = {}
    players.forEach(p => {
      if (!p.group_number) return
      ;(byGroup[p.group_number] ??= []).push(p)
    })
    Object.values(byGroup).forEach(group => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          want.push([group[i], group[j]])
        }
      }
    })
  }

  // Filter to pairs that are missing.
  const missing = want.filter(([a, b]) => !existingPairs.has(pairKey(a.id, b.id)))

  if (missing.length === 0) {
    return { added: 0, skipped: want.length }
  }

  // Build rows to insert.
  const rows = []
  missing.forEach(([a, b]) => {
    if (homeAway) {
      // Generate a pair_id (browser crypto, fallback to a Math.random UUID)
      const pid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
      rows.push({
        tournament_id:  tournament.id,
        home_player_id: a.id,
        away_player_id: b.id,
        round:          newLeg1Round,
        phase,
        leg:            1,
        pair_id:        pid,
        status:         'pending',
      })
      rows.push({
        tournament_id:  tournament.id,
        home_player_id: b.id,
        away_player_id: a.id,
        round:          newLeg2Round,
        phase,
        leg:            2,
        pair_id:        pid,
        status:         'pending',
      })
    } else {
      rows.push({
        tournament_id:  tournament.id,
        home_player_id: a.id,
        away_player_id: b.id,
        round:          newLeg1Round,
        phase,
        leg:            1,
        pair_id:        null,
        status:         'pending',
      })
    }
  })

  const { error } = await supabase.from('fixtures').insert(rows)
  if (error) throw error

  return { added: missing.length, skipped: want.length - missing.length }
}
