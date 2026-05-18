import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useTournament } from '../hooks/useTournament'
import LeagueTable from '../components/LeagueTable'
import KnockoutBracket from '../components/KnockoutBracket'
import ChampionPoster, { ChampionPosterCard } from '../components/ChampionPoster'
import RunnerUpPoster from '../components/RunnerUpPoster'
import TopScorersPoster from '../components/TopScorersPoster'
import { computeTournamentStats } from '../utils/tournamentStats'
import { getPlayerPhoto, setPlayerPhoto, clearPlayerPhoto, readFileAsDataUrl } from '../utils/posterPhotos'
import GroupStandings from '../components/GroupStandings'
import PlayerAvatar from '../components/PlayerAvatar'
import ShareableFixtureCard from '../components/ShareableFixtureCard'
import { computeStandings } from '../utils/computeStandings'
import { exportTournamentToExcel } from '../utils/exportTournament'
import { addMissingFixtures } from '../utils/addMissingFixtures'

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const TABS = ['Players', 'Fixtures', 'Results', 'Stats', 'Posters', 'Settings']

export default function ManageTournamentPage() {
  const { id } = useParams()
  const { tournament, players, fixtures, standings: _dbStandings, loading, error, refetch } = useTournament(id)

  // Always derive standings from fixtures (correct source of truth).
  // The DB-trigger-based standings can over-count if a score was edited.
  const standings = useMemo(() => {
    if (!tournament) return []
    const phase = tournament.format === 'group_knockout' ? 'group' : undefined
    return computeStandings(fixtures, players, { phase })
  }, [tournament, fixtures, players])
  const [tab, setTab] = useState('Players')
  const [newPlayer, setNewPlayer] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [scoreModal, setScoreModal] = useState(null)
  const [scores, setScores] = useState({ home: '', away: '' })
  const [showFixtureCard, setShowFixtureCard] = useState(false)
  const [championPosterData, setChampionPosterData] = useState(null) // { champion, runnerUp, finalScore }
  const [draggingId, setDraggingId]     = useState(null)
  const [dragOverGroup, setDragOverGroup] = useState(null)
  const [manualMode, setManualMode]     = useState(false)

  // ── Derived fixture sets ──────────────────────────────────────
  const groupFixtures    = fixtures.filter(f => f.phase === 'group')
  const knockoutFixtures = fixtures.filter(f => f.phase === 'knockout')
  const regularFixtures  = fixtures.filter(f => f.phase === 'regular' || !f.phase)

  // For regular league/knockout tournaments
  const pendingFixtures    = fixtures.filter(f => f.status === 'pending')
  const completedFixtures  = fixtures.filter(f => f.status === 'completed')

  // Group+Knockout phase detection
  const inGroupPhase      = tournament?.format === 'group_knockout' && groupFixtures.length > 0 && knockoutFixtures.length === 0
  const groupPhaseComplete = groupFixtures.length > 0 && groupFixtures.every(f => f.status === 'completed')
  const inKnockoutPhase   = tournament?.format === 'group_knockout' && knockoutFixtures.length > 0
  const pendingKnockout   = knockoutFixtures.filter(f => f.status === 'pending')
  const knockoutRoundComplete = pendingKnockout.length === 0 && knockoutFixtures.length > 0

  // ── Final detection: the Final is the highest knockout round with exactly 1 match
  const allKnockoutRounds = knockoutFixtures.length
    ? [...new Set(knockoutFixtures.map(f => f.round))].sort((a, b) => a - b)
    : []
  const finalRound      = allKnockoutRounds[allKnockoutRounds.length - 1]
  const finalRoundFx    = finalRound != null ? knockoutFixtures.filter(f => f.round === finalRound) : []
  const isFinalRound    = finalRoundFx.length > 0 && finalRoundFx.length <= 2 &&
                          (finalRoundFx.length === 1 || (finalRoundFx[0].pair_id && finalRoundFx.every(f => f.pair_id === finalRoundFx[0].pair_id)))
  const finalCompleted  = isFinalRound && finalRoundFx.every(f => f.status === 'completed')

  // Current-round pending count for badge
  const badgeCount = tournament?.format === 'group_knockout'
    ? (inKnockoutPhase ? pendingKnockout.length : groupFixtures.filter(f => f.status === 'pending').length)
    : pendingFixtures.length

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  // ── Actions ────────────────────────────────────────────────────
  const addPlayer = async () => {
    if (!newPlayer.trim()) return
    setActionError('')
    const { error } = await supabase.from('players').insert({ tournament_id: id, name: newPlayer.trim() })
    if (error) return setActionError(error.message)
    setNewPlayer('')
    refetch()
  }

  const removePlayer = async (playerId) => {
    if (!confirm('Remove this player?')) return
    await supabase.from('players').delete().eq('id', playerId)
    refetch()
  }

  const renamePlayer = async (player) => {
    const next = window.prompt(`Rename player "${player.name}":`, player.name)?.trim()
    if (!next || next === player.name) return
    const { error } = await supabase.from('players').update({ name: next }).eq('id', player.id)
    if (error) return setActionError(error.message)
    refetch()
  }

  // Build the final score string for the champion poster from the final fixture(s)
  const buildFinalScore = () => {
    const knockoutFx = fixtures.filter(f => (f.phase ?? 'regular') === 'knockout' || tournament?.format === 'knockout')
    if (!knockoutFx.length) return null
    const maxRound = knockoutFx.reduce((m, f) => Math.max(m, f.round ?? 1), 0)
    const finalFx = knockoutFx.filter(f => f.round === maxRound)
    if (!finalFx.length) return null

    // Two-leg final?
    if (finalFx.length === 2 && finalFx[0].pair_id && finalFx[0].pair_id === finalFx[1].pair_id) {
      const leg1 = finalFx.find(l => l.leg === 1) ?? finalFx[0]
      const leg2 = finalFx.find(l => l.leg === 2) ?? finalFx[1]
      if (leg1.status === 'completed' && leg2.status === 'completed') {
        const aGoals = (leg1.home_score ?? 0) + (leg2.away_score ?? 0)
        const bGoals = (leg1.away_score ?? 0) + (leg2.home_score ?? 0)
        return `${Math.max(aGoals, bGoals)} – ${Math.min(aGoals, bGoals)} (agg.)`
      }
      return null
    }
    // Single-leg final
    const f = finalFx[0]
    if (f.status !== 'completed') return null
    return `${Math.max(f.home_score, f.away_score)} – ${Math.min(f.home_score, f.away_score)}`
  }

  // Compute a player's stats across the entire tournament
  const buildPlayerStats = (playerId) => {
    if (!playerId) return null
    let gf = 0, ga = 0, matches = 0
    fixtures.forEach(f => {
      if (f.status !== 'completed') return
      if (f.home_player_id === playerId) {
        gf += f.home_score ?? 0
        ga += f.away_score ?? 0
        matches += 1
      } else if (f.away_player_id === playerId) {
        gf += f.away_score ?? 0
        ga += f.home_score ?? 0
        matches += 1
      }
    })
    return { gf, ga, gd: gf - ga, matches }
  }

  const handleCrownChampion = (champion, runnerUp) => {
    setChampionPosterData({
      champion,
      runnerUp,
      finalScore: buildFinalScore(),
      championStats: buildPlayerStats(champion?.id),
      runnerUpStats: buildPlayerStats(runnerUp?.id),
    })
  }

  const assignPlayerGroup = async (playerId, groupNum) => {
    await supabase.from('players').update({ group_number: groupNum }).eq('id', playerId)
    refetch()
  }

  // Safe alternative to regenerate — only inserts the missing matchups
  // for newly-added players. Existing fixtures and their scores are never
  // touched. Standings recompute automatically from completed fixtures.
  const addMissing = async () => {
    setActionError('')
    setActionLoading(true)
    try {
      const { added, skipped: _skipped } = await addMissingFixtures({
        tournament, players, fixtures,
      })
      if (added === 0) {
        alert('No missing fixtures found — every pairing already exists.')
      } else {
        alert(`✓ Added ${added} new fixture${added === 1 ? '' : 's'}. Existing matches and scores were not changed.`)
      }
    } catch (e) {
      setActionError(e.message)
    }
    setActionLoading(false)
    refetch()
  }

  const regenGroupFixtures = async () => {
    setActionLoading(true)
    setActionError('')
    // Clear old standings so the live page and stats don't show stale data
    await supabase.from('standings').delete().eq('tournament_id', id)
    const { error: err } = await supabase.rpc('generate_group_stage_fixtures', {
      p_tournament_id: id,
      p_num_groups: tournament.num_groups ?? 4,
    })
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  const handleDragStart = (e, playerId) => {
    setDraggingId(playerId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (e, groupNum) => {
    e.preventDefault()
    if (draggingId) {
      await assignPlayerGroup(draggingId, groupNum)
      setDraggingId(null)
      setDragOverGroup(null)
    }
  }

  const generateFixtures = async () => {
    const label = tournament.format === 'league'
      ? 'league'
      : tournament.format === 'group_knockout'
      ? 'group stage'
      : 'knockout'
    if (!confirm(`Generate ${label} fixtures? This will clear any existing fixtures and standings.`)) return
    setActionLoading(true)
    setActionError('')
    // Clear standings so stats stay in sync with new fixtures
    await supabase.from('standings').delete().eq('tournament_id', id)
    let err
    if (tournament.format === 'league') {
      ;({ error: err } = await supabase.rpc('generate_league_fixtures', { p_tournament_id: id }))
    } else if (tournament.format === 'group_knockout') {
      ;({ error: err } = await supabase.rpc('generate_group_stage_fixtures', {
        p_tournament_id: id,
        p_num_groups: tournament.num_groups ?? 4,
      }))
    } else {
      ;({ error: err } = await supabase.rpc('generate_knockout_fixtures', { p_tournament_id: id }))
    }
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  const advanceGroupToKnockout = async () => {
    if (!confirm('Advance top 2 from each group to the knockout stage?')) return
    setActionLoading(true)
    setActionError('')
    const { error: err } = await supabase.rpc('advance_group_to_knockout', {
      p_tournament_id:   id,
      p_teams_advancing: tournament.teams_advancing ?? 2,
    })
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  // Mark the tournament as completed. After this the public live page
  // shows the Champion / Runner-up / Top Scorers posters + season stats.
  const endTournament = async () => {
    if (!confirm(
      '🏆 End the tournament now?\n\n' +
      'This locks the bracket as completed and reveals the season-end ' +
      'posters and statistics on the live page.\n\n' +
      'You can still edit individual fixture scores afterwards.'
    )) return
    setActionLoading(true)
    setActionError('')
    const { error: err } = await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('id', id)
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  // Re-open a completed tournament (in case the user ended it by mistake)
  const reopenTournament = async () => {
    if (!confirm('Re-open the tournament back to active state?')) return
    setActionLoading(true)
    setActionError('')
    const { error: err } = await supabase
      .from('tournaments')
      .update({ status: 'active' })
      .eq('id', id)
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  const advanceKnockoutRound = async () => {
    setActionLoading(true)
    setActionError('')
    const { error: err } = await supabase.rpc('advance_knockout_round', { p_tournament_id: id })
    if (err) {
      setActionError(err.message)
      setActionLoading(false)
      return
    }

    // After advancing, if the new round IS the Final and the SQL
    // generated a two-leg tie (because home_away is on), strip leg 2
    // so the Final is always a single match.
    try {
      const { data: refreshed } = await supabase
        .from('fixtures')
        .select('*')
        .eq('tournament_id', id)
      const koFx = (refreshed ?? []).filter(f =>
        tournament?.format === 'knockout' || (f.phase ?? 'regular') === 'knockout'
      )
      if (koFx.length) {
        const maxR = Math.max(...koFx.map(f => f.round ?? 1))
        const newFinal = koFx.filter(f => f.round === maxR)
        const isTwoLeg = newFinal.length === 2 && newFinal[0].pair_id && newFinal[0].pair_id === newFinal[1].pair_id
        if (isTwoLeg) {
          const leg1 = newFinal.find(l => l.leg === 1) ?? newFinal[0]
          const leg2 = newFinal.find(l => l.leg === 2) ?? newFinal[1]
          await supabase.from('fixtures').delete().eq('id', leg2.id)
          await supabase.from('fixtures').update({ pair_id: null, leg: 1 }).eq('id', leg1.id)
        }
      }
    } catch (_e) { /* non-fatal */ }

    setActionLoading(false)
    refetch()
  }

  // Manual converter for an existing two-leg Final that was created
  // before the auto-stripping was in place. Safely refuses if both
  // legs have already been played so we never silently lose results.
  const convertFinalToSingleLeg = async () => {
    const koFx = fixtures.filter(isKnockoutFixture)
    if (koFx.length === 0) {
      alert('No knockout fixtures yet.')
      return
    }
    const maxR = Math.max(...koFx.map(f => f.round ?? 1))
    const finalFx = koFx.filter(f => f.round === maxR)
    if (!(finalFx.length === 2 && finalFx[0].pair_id && finalFx[0].pair_id === finalFx[1].pair_id)) {
      alert('The Final is already a single match — nothing to convert.')
      return
    }
    const leg1 = finalFx.find(l => l.leg === 1) ?? finalFx[0]
    const leg2 = finalFx.find(l => l.leg === 2) ?? finalFx[1]
    if (leg1.status === 'completed' && leg2.status === 'completed') {
      alert(
        '⚠️ Both legs of the Final already have a recorded score.\n\n' +
        'Converting now would lose Leg 2 results. Reset one of the legs first.'
      )
      return
    }
    if (!confirm(
      'Convert the Final to a single match?\n\n' +
      'Leg 2 will be deleted. Leg 1 becomes the Final.\n' +
      '(Any score in Leg 1 is kept.)'
    )) return
    setActionLoading(true)
    setActionError('')
    try {
      const { error: e1 } = await supabase.from('fixtures').delete().eq('id', leg2.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('fixtures')
        .update({ pair_id: null, leg: 1 })
        .eq('id', leg1.id)
      if (e2) throw e2
      alert('✓ The Final is now a single match.')
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActionLoading(false)
      refetch()
    }
  }

  const openScoreModal = (fixture) => {
    setScoreModal(fixture)
    setScores({ home: fixture.home_score ?? '', away: fixture.away_score ?? '' })
  }

  // Determines if a fixture is a knockout-phase fixture (for either format)
  const isKnockoutFixture = (f) => {
    if (!f) return false
    if (tournament?.format === 'knockout') return true
    return (f.phase ?? 'regular') === 'knockout'
  }

  // After a knockout score change, find ALL downstream fixtures that referenced
  // the OLD winner (QF → SF, SF → Final, even QF → Final if the player got
  // there) and offer to swap them to the NEW winner.
  const maybePropagateWinnerChange = async (fixture, oldWinnerId, newWinnerId) => {
    if (!oldWinnerId || !newWinnerId || oldWinnerId === newWinnerId) return
    if (!isKnockoutFixture(fixture)) return

    const downstream = fixtures.filter(other =>
      other.id !== fixture.id &&
      isKnockoutFixture(other) &&
      (other.round ?? 1) > (fixture.round ?? 1) &&
      (other.home_player_id === oldWinnerId || other.away_player_id === oldWinnerId)
    )
    if (downstream.length === 0) return

    const oldName = players.find(p => p.id === oldWinnerId)?.name ?? 'previous winner'
    const newName = players.find(p => p.id === newWinnerId)?.name ?? 'new winner'

    // Build a friendly round-by-round summary of what will change
    const knockoutFx = fixtures.filter(isKnockoutFixture)
    const maxRound   = knockoutFx.reduce((m, x) => Math.max(m, x.round ?? 1), 0)
    const roundLabelFor = (r) => {
      const fromEnd = maxRound - r
      if (fromEnd === 0) return 'Final'
      if (fromEnd === 1) return 'Semi-Final'
      if (fromEnd === 2) return 'Quarter-Final'
      if (fromEnd === 3) return 'Round of 16'
      return `Round ${r}`
    }
    // Unique rounds touched, in order
    const roundsTouched = [...new Set(downstream.map(d => d.round ?? 1))].sort((a, b) => a - b)
    const roundsList = roundsTouched.map(roundLabelFor).join(', ')

    const proceed = confirm(
      `🔄 Winner changed: "${oldName}" → "${newName}"\n\n` +
      `This player has already advanced to: ${roundsList}.\n\n` +
      `Update those fixtures so "${newName}" takes the spot?\n\n` +
      `OK     → update opponent name in ${roundsList}\n` +
      `Cancel → keep the bracket as-is`
    )
    if (!proceed) return

    // Swap player IDs on every downstream fixture that referenced the old winner.
    // Includes two-leg pairs (both legs share pair_id so both get patched).
    for (const f of downstream) {
      const patch = f.home_player_id === oldWinnerId
        ? { home_player_id: newWinnerId }
        : { away_player_id: newWinnerId }
      const { error } = await supabase.from('fixtures').update(patch).eq('id', f.id)
      if (error) { setActionError(error.message); return }
    }
  }

  // For a two-leg knockout tie, the actual winner is determined by
  // aggregate goals across both legs — not by who wins one leg.
  // Given the (possibly updated) state of leg1 + leg2, return:
  //   { aId, bId, aGoals, bGoals, winnerId }   (winnerId null if draw/incomplete)
  const aggregateWinner = (leg1, leg2) => {
    if (!leg1 || !leg2) return { winnerId: null }
    if (leg1.status !== 'completed' || leg2.status !== 'completed') return { winnerId: null }
    const aId = leg1.home_player_id   // Player A — home in leg 1
    const bId = leg1.away_player_id   // Player B — away in leg 1
    const aGoals = (leg1.home_score ?? 0) + (leg2.away_score ?? 0) // A: L1 home + L2 away
    const bGoals = (leg1.away_score ?? 0) + (leg2.home_score ?? 0) // B: L1 away + L2 home
    let winnerId = null
    if (aGoals > bGoals) winnerId = aId
    else if (bGoals > aGoals) winnerId = bId
    return { aId, bId, aGoals, bGoals, winnerId }
  }

  // Compute the matchup-level winner (aggregate for two-leg, score for single-leg)
  // BEFORE the edit — using whatever scores are currently stored on the fixture(s).
  const winnerBeforeEdit = (fixture) => {
    if (!isKnockoutFixture(fixture)) return null
    if (fixture.pair_id) {
      const legs = fixtures.filter(f => f.pair_id === fixture.pair_id)
      const leg1 = legs.find(l => l.leg === 1) ?? legs[0]
      const leg2 = legs.find(l => l.leg === 2)
      return aggregateWinner(leg1, leg2).winnerId
    }
    if (fixture.status !== 'completed') return null
    if (fixture.home_score > fixture.away_score) return fixture.home_player_id
    if (fixture.away_score > fixture.home_score) return fixture.away_player_id
    return null
  }

  // Compute the matchup-level winner AFTER the edit — by simulating the
  // edited fixture's new scores against the unchanged sibling leg.
  const winnerAfterEdit = (fixture, homeScore, awayScore) => {
    if (!isKnockoutFixture(fixture)) return null
    if (fixture.pair_id) {
      const legs = fixtures.filter(f => f.pair_id === fixture.pair_id)
      const leg1 = legs.find(l => l.leg === 1) ?? legs[0]
      const leg2 = legs.find(l => l.leg === 2)
      // Substitute the edited leg's new scores
      const sub = (l) => l?.id === fixture.id
        ? { ...l, home_score: homeScore, away_score: awayScore, status: 'completed' }
        : l
      return aggregateWinner(sub(leg1), sub(leg2)).winnerId
    }
    if (homeScore > awayScore) return fixture.home_player_id
    if (awayScore > homeScore) return fixture.away_player_id
    return null
  }

  // Shared scoring flow — used by both modal and inline editors.
  const recordScore = async (fixture, homeScore, awayScore) => {
    // Capture matchup-level winner BEFORE the RPC mutates anything
    const oldWinnerId = winnerBeforeEdit(fixture)

    const { error: err } = await supabase.rpc('process_match_result', {
      p_fixture_id: fixture.id,
      p_home_score: homeScore,
      p_away_score: awayScore,
    })
    if (err) { setActionError(err.message); return }

    // Compute matchup-level winner AFTER the edit — accounts for aggregate
    // when this is a two-leg tie (so editing just leg 2 can correctly
    // detect that the aggregate winner flipped).
    const newWinnerId = winnerAfterEdit(fixture, homeScore, awayScore)
    await maybePropagateWinnerChange(fixture, oldWinnerId, newWinnerId)
  }

  const submitScore = async () => {
    if (scores.home === '' || scores.away === '') return
    setActionLoading(true)
    setActionError('')
    await recordScore(scoreModal, parseInt(scores.home), parseInt(scores.away))
    setScoreModal(null)
    setActionLoading(false)
    refetch()
  }

  // Inline score submitter — called by the new editable knockout cards.
  const submitInlineScore = async (fixture, home, away) => {
    setActionError('')
    await recordScore(fixture, home, away)
    refetch()
  }

  // ── Manual re-seed bracket from current results ──────────────
  // Walks every knockout round, recomputes who SHOULD be in each next
  // round based on actual results, and patches mismatched player IDs.
  // Always reliable — bypasses the auto-propagation prompt.
  const reseedBracket = async () => {
    const knockoutFx = fixtures.filter(isKnockoutFixture)
    if (knockoutFx.length === 0) {
      alert('No knockout fixtures to re-seed.')
      return
    }

    // Group fixtures into matchups (single or two-leg) and sort by round + creation
    const byPair = {}
    const noPair = []
    knockoutFx.forEach(f => {
      if (f.pair_id) (byPair[f.pair_id] ??= []).push(f)
      else noPair.push(f)
    })
    const matchupsList = []
    noPair.forEach(f => matchupsList.push({ type: 'single', f, round: f.round, createdAt: f.created_at }))
    Object.values(byPair).forEach(legs => {
      const leg1 = legs.find(l => l.leg === 1) ?? legs[0]
      const leg2 = legs.find(l => l.leg === 2)
      matchupsList.push({ type: 'two-leg', leg1, leg2, round: leg1.round, createdAt: leg1.created_at })
    })
    matchupsList.sort((a, b) => a.round - b.round || new Date(a.createdAt) - new Date(b.createdAt))

    const rounds = [...new Set(matchupsList.map(m => m.round))].sort((a, b) => a - b)
    if (rounds.length < 2) {
      alert('Only one knockout round exists — nothing to re-seed.')
      return
    }

    // Winner of a matchup (aggregate-aware for two-leg ties)
    const winnerOf = (m) => {
      if (m.type === 'single') {
        const f = m.f
        if (f.status !== 'completed') return null
        if (f.home_score > f.away_score) return f.home_player_id
        if (f.away_score > f.home_score) return f.away_player_id
        return null
      }
      const { leg1, leg2 } = m
      if (!leg2 || leg1.status !== 'completed' || leg2.status !== 'completed') return null
      const aGoals = (leg1.home_score ?? 0) + (leg2.away_score ?? 0)
      const bGoals = (leg1.away_score ?? 0) + (leg2.home_score ?? 0)
      if (aGoals > bGoals) return leg1.home_player_id
      if (bGoals > aGoals) return leg1.away_player_id
      return null
    }

    if (!confirm(
      '🔄 Re-seed the knockout bracket?\n\n' +
      'This walks every round and updates the players in the NEXT round based on who actually won each match. ' +
      'Existing scores are kept — only player names get corrected.\n\n' +
      'Use this after editing earlier-round scores so the bracket reflects reality.'
    )) return

    setActionLoading(true)
    setActionError('')
    let updates = 0
    try {
      for (let rIdx = 0; rIdx < rounds.length - 1; rIdx++) {
        const cur  = matchupsList.filter(m => m.round === rounds[rIdx])
        const nxt  = matchupsList.filter(m => m.round === rounds[rIdx + 1])
        const winners = cur.map(winnerOf)

        for (let i = 0; i < nxt.length; i++) {
          const expHome = winners[i * 2]      // winner of match 2i → home slot of next match i
          const expAway = winners[i * 2 + 1]  // winner of match 2i+1 → away slot
          if (!expHome && !expAway) continue

          const m = nxt[i]
          const legs2patch = m.type === 'two-leg' ? [m.leg1, m.leg2].filter(Boolean) : [m.f]

          for (const f of legs2patch) {
            const patch = {}
            if (m.type === 'two-leg' && f.id === m.leg2?.id) {
              // Leg 2: players are swapped from leg 1
              if (expAway && f.home_player_id !== expAway) patch.home_player_id = expAway
              if (expHome && f.away_player_id !== expHome) patch.away_player_id = expHome
            } else {
              if (expHome && f.home_player_id !== expHome) patch.home_player_id = expHome
              if (expAway && f.away_player_id !== expAway) patch.away_player_id = expAway
            }
            if (Object.keys(patch).length > 0) {
              const { error } = await supabase.from('fixtures').update(patch).eq('id', f.id)
              if (error) throw error
              updates += 1
            }
          }
        }
      }
      alert(updates === 0
        ? '✓ Bracket already up-to-date — no changes needed.'
        : `✓ Re-seeded the bracket — updated ${updates} fixture${updates === 1 ? '' : 's'}.`
      )
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActionLoading(false)
      refetch()
    }
  }

  // ── Loading / Error ────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">{error}</div>
  )

  const formatLabel = {
    league: 'Round Robin',
    knockout: 'Knockout',
    group_knockout: 'Group + Knockout',
  }[tournament?.format] ?? tournament?.format

  return (
    <div className="min-h-screen stadium-bg text-white">
      {/* Top glow accent */}
      <div className="field-accent-top" />
      {/* Navbar */}
      <nav className="border-b border-indigo-900/40 bg-gray-900/70 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <span className="font-semibold hidden sm:inline truncate max-w-xs">{tournament?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {fixtures.length > 0 && (
              <button
                onClick={() => setShowFixtureCard(true)}
                className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
              >
                📋 <span className="hidden sm:inline">Fixture Card</span>
              </button>
            )}
            {fixtures.length > 0 && (
              <button
                onClick={() => exportTournamentToExcel(tournament, players, fixtures)}
                className="text-xs text-emerald-200 hover:text-white bg-emerald-700/70 hover:bg-emerald-600 border border-emerald-500/40 px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                title="Download as Excel"
              >
                📊 <span className="hidden sm:inline">Excel</span>
              </button>
            )}
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              tournament?.status === 'active'    ? 'bg-green-800 text-green-300' :
              tournament?.status === 'completed' ? 'bg-indigo-800 text-indigo-300' :
                                                   'bg-gray-700 text-gray-300'
            }`}>
              {tournament?.status}
            </span>
            {tournament && (
              <a
                href={`/t/${tournament.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <span className="hidden sm:inline">Public page ↗</span>
                <span className="sm:hidden">↗</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-1">
          <h1 className="text-2xl sm:text-3xl font-black match-day-text tracking-tight">{tournament?.name}</h1>
          <p className="text-gray-400 text-sm">
            {formatLabel} · {players.length}/{tournament?.max_players} players
            {tournament?.format === 'group_knockout' && tournament?.num_groups && (
              <span className="ml-1">· {tournament.num_groups} groups · Top {tournament.teams_advancing ?? 2} advance</span>
            )}
            {tournament?.home_away && <span className="ml-1">· Home &amp; Away</span>}
          </p>
        </div>

        {actionError && (
          <div className="mt-3 bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
            {actionError}
          </div>
        )}

        {/* ── Action bar ── */}

        {/* Generate fixtures (draft state) */}
        {tournament?.status === 'draft' && players.length >= 2 && (
          <div className="mt-4 p-4 bg-indigo-950/40 border border-indigo-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-indigo-200">Ready to start!</p>
              <p className="text-xs text-indigo-400">{players.length} players registered</p>
            </div>
            <button
              onClick={generateFixtures}
              disabled={actionLoading}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {actionLoading ? 'Generating…' : `Generate ${tournament.format === 'group_knockout' ? 'Group Stage' : 'Fixtures'}`}
            </button>
          </div>
        )}

        {/* Add missing fixtures (live tournament with new players) */}
        {tournament?.status === 'active' &&
         (tournament.format === 'league' || tournament.format === 'group_knockout') &&
         players.length >= 2 && fixtures.length > 0 && (
          <div className="mt-4 p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-emerald-200">➕ Added new players?</p>
              <p className="text-xs text-emerald-400/80">
                Safely add fixtures for any missing matchups — existing matches and scores stay untouched.
              </p>
            </div>
            <button
              onClick={addMissing}
              disabled={actionLoading}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5"
            >
              {actionLoading ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : '➕'}
              {actionLoading ? 'Adding…' : 'Add Missing Fixtures'}
            </button>
          </div>
        )}

        {/* Advance group → knockout */}
        {tournament?.format === 'group_knockout' && inGroupPhase && groupPhaseComplete && (
          <div className="mt-4 p-4 bg-green-950/40 border border-green-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-green-200">Group stage complete! 🏆</p>
              <p className="text-xs text-green-400">Top 2 from each group advance to the knockout bracket.</p>
            </div>
            <button
              onClick={advanceGroupToKnockout}
              disabled={actionLoading}
              className="shrink-0 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {actionLoading ? 'Advancing…' : 'Start Knockout Stage →'}
            </button>
          </div>
        )}

        {/* Knockout phase banner + re-seed bracket button */}
        {(tournament?.format === 'knockout' || (tournament?.format === 'group_knockout' && inKnockoutPhase)) &&
          tournament?.status === 'active' && (
          <div className="mt-4 px-4 py-2.5 bg-indigo-950/30 border border-indigo-800/50 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 text-sm">⚡</span>
              <span className="text-indigo-300 text-sm font-medium">Knockout stage in progress</span>
            </div>
            <button
              onClick={reseedBracket}
              disabled={actionLoading}
              className="shrink-0 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5"
              title="Walk every round and update next-round player names based on the actual winners"
            >
              🔄 {actionLoading ? 'Re-seeding…' : 'Re-seed Bracket from Results'}
            </button>
          </div>
        )}

        {/* Advance knockout round (hidden when current round IS the final) */}
        {(tournament?.format === 'knockout' || inKnockoutPhase) &&
          tournament?.status === 'active' && knockoutRoundComplete && !isFinalRound && (
          <div className="mt-4 p-4 bg-green-950/40 border border-green-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm font-medium text-green-200">All matches complete — advance to next round?</p>
            <button
              onClick={advanceKnockoutRound}
              disabled={actionLoading}
              className="shrink-0 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {actionLoading ? 'Advancing…' : 'Next Round →'}
            </button>
          </div>
        )}

        {/* End tournament — only after the Final result is in */}
        {tournament?.status === 'active' && finalCompleted && (
          <div className="mt-4 p-5 bg-gradient-to-r from-amber-950/50 via-amber-900/30 to-amber-950/50 border-2 border-amber-700/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/40">
            <div className="flex items-start gap-3">
              <span className="text-3xl trophy-shine">🏆</span>
              <div>
                <p className="text-sm font-bold text-amber-200">The Final is over — ready to crown the champion?</p>
                <p className="text-xs text-amber-400/80 mt-0.5">Ending the tournament reveals the season-end posters and statistics on the live page.</p>
              </div>
            </div>
            <button
              onClick={endTournament}
              disabled={actionLoading}
              className="shrink-0 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-gray-900 font-black px-6 py-3 rounded-xl text-sm shadow-2xl shadow-amber-900/50 transition-all hover:-translate-y-0.5"
            >
              {actionLoading ? 'Ending…' : '🏁 End Tournament'}
            </button>
          </div>
        )}

        {/* Completed banner — explain how to re-open */}
        {tournament?.status === 'completed' && (
          <div className="mt-4 p-4 bg-gradient-to-r from-indigo-950/40 to-emerald-950/40 border border-indigo-800/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-indigo-200">✅ Tournament completed</p>
              <p className="text-xs text-indigo-400/80 mt-0.5">Champion, runner-up, top-scorer posters and full statistics are now on the live page.</p>
            </div>
            <button
              onClick={reopenTournament}
              disabled={actionLoading}
              className="shrink-0 text-xs text-gray-400 hover:text-white font-medium px-3 py-1.5 border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
            >
              {actionLoading ? '…' : '↩︎ Re-open tournament'}
            </button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-800 mt-6 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t}
              {t === 'Fixtures' && badgeCount > 0 && (
                <span className="ml-1.5 bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5">{badgeCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">

          {/* ══ PLAYERS TAB ══ */}
          {tab === 'Players' && (
            <div>
              {/* Add player row */}
              <div className="flex gap-2 mb-5">
                <input
                  value={newPlayer}
                  onChange={e => setNewPlayer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlayer()}
                  placeholder="Player name…"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button onClick={addPlayer}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-colors">
                  Add
                </button>
              </div>

              {players.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No players yet. Add some above!</p>

              ) : tournament?.format === 'group_knockout' ? (
                /* ── Group Assignment (Auto / Manual) ── */
                <div>
                  {/* Toolbar: toggle + regenerate button */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      {/* Toggle switch */}
                      <div
                        onClick={() => setManualMode(m => !m)}
                        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${manualMode ? 'bg-indigo-600' : 'bg-gray-700'}`}
                        style={{ width: '40px', height: '22px' }}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200 ${manualMode ? 'translate-x-[18px]' : 'translate-x-0'}`}
                          style={{ width: '18px', height: '18px' }}
                        />
                      </div>
                      <span className="text-sm text-gray-300 font-medium">Manual group assignment</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={addMissing}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        title="Safely add fixtures for new players without touching existing matches or scores"
                      >
                        {actionLoading ? (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : '➕'}
                        Add Missing Fixtures
                      </button>
                      <button
                        onClick={regenGroupFixtures}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        title="⚠️ Wipes ALL existing fixtures and scores, then rebuilds from scratch"
                      >
                        {actionLoading ? (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : '🔄'}
                        Regenerate (Wipe All)
                      </button>
                    </div>
                  </div>

                  {!manualMode ? (
                    /* ── Auto mode: group table view ── */
                    <div>
                      <p className="text-xs text-gray-500 mb-4">
                        {players.some(p => p.group_number)
                          ? 'Current group assignments. Click Regenerate Fixtures to rebuild with these groups.'
                          : 'Groups will be auto-assigned randomly when you click Regenerate Fixtures.'}
                      </p>

                      {/* Group tables grid */}
                      {players.some(p => p.group_number) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Array.from({ length: tournament.num_groups ?? 4 }, (_, i) => i + 1).map(g => {
                            const gPlayers = players.filter(p => p.group_number === g)
                            if (gPlayers.length === 0) return null
                            return (
                              <div key={g} className="rounded-xl border border-gray-800 overflow-hidden">
                                {/* Group header */}
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-900 border-b border-gray-800">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white">
                                    {GROUP_LETTERS[g - 1]}
                                  </div>
                                  <span className="text-sm font-bold text-gray-200">Group {GROUP_LETTERS[g - 1]}</span>
                                  <span className="ml-auto text-xs text-gray-600">{gPlayers.length} players</span>
                                </div>
                                {/* Player rows */}
                                <div className="divide-y divide-gray-800/60 bg-gray-950">
                                  {gPlayers.map((p, pos) => {
                                    const globalIdx = players.findIndex(x => x.id === p.id)
                                    return (
                                      <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                                        <span className="text-xs text-gray-600 w-4 shrink-0">{pos + 1}</span>
                                        <PlayerAvatar player={p} index={globalIdx} size="sm" />
                                        <span className="text-sm text-white font-medium flex-1 truncate">{p.name}</span>
                                        <button
                                          onClick={() => renamePlayer(p)}
                                          className="text-gray-700 hover:text-indigo-400 transition-colors text-xs shrink-0"
                                          title="Rename"
                                        >✏️</button>
                                        <button
                                          onClick={() => removePlayer(p.id)}
                                          className="text-gray-700 hover:text-red-400 transition-colors text-xs shrink-0"
                                          title="Remove"
                                        >✕</button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        /* No groups assigned yet — flat list */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {players.map((p, i) => (
                            <div key={p.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                              <div className="flex items-center gap-3">
                                <PlayerAvatar player={p} index={i} size="md" badge />
                                <span className="font-medium text-white">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => renamePlayer(p)} className="text-gray-500 hover:text-indigo-400 transition-colors text-sm" title="Rename">✏️</button>
                                <button onClick={() => removePlayer(p.id)} className="text-gray-600 hover:text-red-400 transition-colors text-sm">Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  ) : (
                    /* ── Manual mode: drag & drop ── */
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        Drag players into groups, or use the <span className="text-gray-300">Move→</span> dropdown. Hit <span className="text-indigo-400 font-semibold">Regenerate Fixtures</span> when done.
                      </p>

                      {/* Unassigned pool */}
                      {players.some(p => !p.group_number) && (
                        <div className="mb-4 p-3 bg-gray-900/60 border border-dashed border-gray-700 rounded-xl">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Unassigned — drag to a group below
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {players.filter(p => !p.group_number).map(p => {
                              const globalIdx = players.findIndex(x => x.id === p.id)
                              return (
                                <DraggablePlayer
                                  key={p.id} player={p} index={globalIdx}
                                  draggingId={draggingId}
                                  onDragStart={handleDragStart}
                                  onRemove={() => removePlayer(p.id)}
                                  onRename={() => renamePlayer(p)}
                                  groups={Array.from({ length: tournament.num_groups ?? 4 }, (_, gi) => gi + 1)}
                                  onAssign={assignPlayerGroup}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Group columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        {Array.from({ length: tournament.num_groups ?? 4 }, (_, i) => i + 1).map(g => {
                          const gPlayers = players.filter(p => p.group_number === g)
                          const isOver   = dragOverGroup === g
                          return (
                            <div key={g}
                              onDragOver={e => { e.preventDefault(); setDragOverGroup(g) }}
                              onDragLeave={() => setDragOverGroup(null)}
                              onDrop={e => handleDrop(e, g)}
                              className={`rounded-xl border-2 transition-all ${
                                isOver ? 'border-indigo-400 bg-indigo-950/40 shadow-lg shadow-indigo-950/30' : 'border-gray-700 bg-gray-900/60'
                              }`}
                            >
                              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700/60">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black text-white">
                                  {GROUP_LETTERS[g - 1]}
                                </div>
                                <span className="text-sm font-bold text-gray-200">Group {GROUP_LETTERS[g - 1]}</span>
                                <span className="ml-auto text-xs text-gray-600">{gPlayers.length}</span>
                              </div>
                              <div className="p-2 min-h-[80px]">
                                {gPlayers.length === 0 ? (
                                  <p className="text-xs text-gray-700 text-center py-4">Drop here</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {gPlayers.map(p => {
                                      const globalIdx = players.findIndex(x => x.id === p.id)
                                      return (
                                        <DraggablePlayer
                                          key={p.id} player={p} index={globalIdx}
                                          draggingId={draggingId}
                                          onDragStart={handleDragStart}
                                          onRemove={() => removePlayer(p.id)}
                                  onRename={() => renamePlayer(p)}
                                          groups={Array.from({ length: tournament.num_groups ?? 4 }, (_, gi) => gi + 1).filter(x => x !== g)}
                                          onAssign={assignPlayerGroup}
                                          compact
                                        />
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

              ) : (
                /* Default flat list */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {players.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar player={p} index={i} size="md" badge />
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <p className="text-[10px] text-gray-500">Player {i + 1}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => renamePlayer(p)} className="text-gray-500 hover:text-indigo-400 transition-colors text-sm" title="Rename">✏️</button>
                        <button onClick={() => removePlayer(p.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors text-sm">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ FIXTURES TAB ══ */}
          {tab === 'Fixtures' && (
            <div>
              {fixtures.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  No fixtures yet. Generate them from the action bar above.
                </p>

              ) : tournament?.format === 'group_knockout' ? (
                <>
                  {/* Group phase fixtures */}
                  {groupFixtures.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/40 border border-indigo-800 px-3 py-1 rounded-full">
                          Group Stage
                        </span>
                        {groupPhaseComplete && (
                          <span className="text-xs text-green-400 font-medium">✓ Complete</span>
                        )}
                      </div>
                      {Array.from({ length: tournament.num_groups ?? 4 }, (_, i) => i + 1).map(g => {
                        const gFixtures = groupFixtures.filter(f => {
                          const hp = playerMap[f.home_player_id]
                          return hp?.group_number === g
                        })
                        if (!gFixtures.length) return null
                        return (
                          <div key={g} className="mb-5">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 rounded bg-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                {GROUP_LETTERS[g - 1]}
                              </div>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Group {GROUP_LETTERS[g - 1]}</h4>
                            </div>
                            <div className="space-y-2">
                              {tournament?.home_away && gFixtures.some(f => f.pair_id)
                                ? pairByPairId(gFixtures).map(({ leg1, leg2 }) => (
                                    <TwoLegMatchCard
                                      key={leg1?.id ?? leg2?.id}
                                      leg1={leg1} leg2={leg2}
                                      playerMap={playerMap}
                                      onEnterScore={openScoreModal}
                                    />
                                  ))
                                : gFixtures.map(f => (
                                    <MatchRow key={f.id} fixture={f} playerMap={playerMap} onEnterScore={openScoreModal} />
                                  ))
                              }
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Knockout phase fixtures */}
                  {knockoutFixtures.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 border border-amber-800/50 px-3 py-1 rounded-full">
                          Knockout Stage
                        </span>
                      </div>
                      <KnockoutBracket fixtures={knockoutFixtures} players={players} onEnterScore={openScoreModal} onSubmitScore={submitInlineScore} onCrownChampion={handleCrownChampion} tournament={tournament} />
                    </div>
                  )}
                </>

              ) : tournament?.format === 'knockout' ? (
                <KnockoutBracket fixtures={fixtures} players={players} onEnterScore={openScoreModal} onSubmitScore={submitInlineScore} onCrownChampion={handleCrownChampion} tournament={tournament} />

              ) : (
                /* League */
                tournament?.home_away && fixtures.some(f => f.pair_id)
                  ? /* Home & Away — pair each Leg 1 with its Leg 2 */
                    <>
                      {!fixtures.some(f => f.pair_id) && (
                        <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2 mb-3">
                          ⚠ Run the home/away SQL migration to enable mini bracket view.
                        </p>
                      )}
                      <div className="space-y-3">
                        {pairByPairId(fixtures).map(({ leg1, leg2 }) => (
                          <TwoLegMatchCard
                            key={leg1?.id ?? leg2?.id}
                            leg1={leg1} leg2={leg2}
                            playerMap={playerMap}
                            onEnterScore={openScoreModal}
                          />
                        ))}
                      </div>
                    </>
                  : /* Single-leg round-by-round (also fallback when pair_id missing) */
                    <>
                      {tournament?.home_away && !fixtures.some(f => f.pair_id) && (
                        <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2 mb-3">
                          ⚠ Home &amp; Away is enabled but fixtures lack pair_id. Run <code className="bg-amber-900/60 px-1 rounded">supabase-migration-homeaway.sql</code> and the updated <code className="bg-amber-900/60 px-1 rounded">supabase-functions.sql</code>, then click <b>Regenerate Fixtures</b>.
                        </p>
                      )}
                      <div className="space-y-4">
                        {[...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b).map(round => (
                          <div key={round}>
                            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Round {round}</h3>
                            <div className="space-y-2 mb-4">
                              {fixtures.filter(f => f.round === round).map(f => (
                                <MatchRow key={f.id} fixture={f} playerMap={playerMap} onEnterScore={openScoreModal} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
              )}
            </div>
          )}

          {/* ══ RESULTS TAB ══ */}
          {tab === 'Results' && (
            <div>
              {completedFixtures.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No completed matches yet.</p>
              ) : (
                <div className="space-y-2">
                  {completedFixtures.map(f => {
                    const homeWon = f.home_score > f.away_score
                    const awayWon = f.away_score > f.home_score
                    const phaseLabel = f.phase === 'group' ? 'Group' : f.phase === 'knockout' ? 'KO' : null
                    return (
                      <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className={`text-sm font-medium flex-1 text-right truncate ${homeWon ? 'text-white' : 'text-gray-400'}`}>
                            {playerMap[f.home_player_id]?.name}
                          </span>
                          <span className="text-lg font-bold text-white shrink-0">{f.home_score} – {f.away_score}</span>
                          <span className={`text-sm font-medium flex-1 text-left truncate ${awayWon ? 'text-white' : 'text-gray-400'}`}>
                            {playerMap[f.away_player_id]?.name}
                          </span>
                        </div>
                        <div className="text-center mt-1 flex items-center justify-center gap-2">
                          {phaseLabel && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${f.phase === 'knockout' ? 'bg-amber-900/50 text-amber-400' : 'bg-indigo-900/50 text-indigo-400'}`}>
                              {phaseLabel}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">Round {f.round} · {new Date(f.played_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ STATS TAB ══ */}
          {tab === 'Stats' && (
            <div>
              {tournament?.format === 'league' && (
                <LeagueTable standings={standings} players={players} />
              )}
              {tournament?.format === 'knockout' && (
                <KnockoutBracket fixtures={fixtures} players={players} onEnterScore={openScoreModal} onSubmitScore={submitInlineScore} onCrownChampion={handleCrownChampion} tournament={tournament} />
              )}
              {tournament?.format === 'group_knockout' && (
                <div>
                  {/* Group standings always visible */}
                  <GroupStandings
                    standings={standings}
                    players={players}
                    numGroups={tournament.num_groups ?? 4}
                    teamsAdvancing={tournament.teams_advancing ?? 2}
                  />

                  {/* Knockout bracket if we've advanced */}
                  {knockoutFixtures.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 border border-amber-800/50 px-3 py-1 rounded-full">
                          Knockout Bracket
                        </span>
                      </div>
                      <KnockoutBracket fixtures={knockoutFixtures} players={players} onEnterScore={openScoreModal} onSubmitScore={submitInlineScore} onCrownChampion={handleCrownChampion} tournament={tournament} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ SETTINGS TAB ══ */}
          {tab === 'Posters' && tournament && (
            <PostersPanel
              tournament={tournament}
              fixtures={fixtures}
              players={players}
              isKnockoutFixture={isKnockoutFixture}
            />
          )}

          {tab === 'Settings' && tournament && (
            <SettingsPanel
              tournament={tournament}
              fixtures={fixtures}
              players={players}
              onSaved={refetch}
              onConvertFinal={convertFinalToSingleLeg}
              onReseedBracket={reseedBracket}
              isKnockoutFixture={isKnockoutFixture}
              actionLoading={actionLoading}
            />
          )}

        </div>
      </main>

      {/* ── Shareable Fixture Card Modal ── */}
      {showFixtureCard && (
        <ShareableFixtureCard
          tournament={tournament}
          fixtures={fixtures}
          players={players}
          onClose={() => setShowFixtureCard(false)}
        />
      )}

      {/* ── Champion Poster Modal ── */}
      {championPosterData && (
        <ChampionPoster
          tournament={tournament}
          champion={championPosterData.champion}
          runnerUp={championPosterData.runnerUp}
          finalScore={championPosterData.finalScore}
          championStats={championPosterData.championStats}
          runnerUpStats={championPosterData.runnerUpStats}
          onClose={() => setChampionPosterData(null)}
        />
      )}

      {/* ── Score Modal ── */}
      {scoreModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setScoreModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Enter Score</h3>
            <p className="text-sm text-gray-400 mb-4">
              {playerMap[scoreModal.home_player_id]?.name} vs {playerMap[scoreModal.away_player_id]?.name}
            </p>
            {scoreModal.phase && scoreModal.phase !== 'regular' && (
              <p className="text-xs font-semibold mb-3 px-2 py-1 rounded w-fit
                           bg-indigo-900/40 text-indigo-400 capitalize">
                {scoreModal.phase} stage
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">{playerMap[scoreModal.home_player_id]?.name}</label>
                <input
                  type="number" min={0}
                  value={scores.home}
                  onChange={e => setScores(s => ({ ...s, home: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-gray-500 font-bold pt-5">–</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">{playerMap[scoreModal.away_player_id]?.name}</label>
                <input
                  type="number" min={0}
                  value={scores.away}
                  onChange={e => setScores(s => ({ ...s, away: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setScoreModal(null)} className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={submitScore}
                disabled={actionLoading || scores.home === '' || scores.away === ''}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {actionLoading ? 'Saving…' : 'Save Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Group fixtures by pair_id (home & away) ──────────────────────
function pairByPairId(fxList) {
  const map = {}
  fxList.forEach(f => {
    if (f.pair_id) {
      if (!map[f.pair_id]) map[f.pair_id] = { leg1: null, leg2: null }
      if (f.leg === 1) map[f.pair_id].leg1 = f
      else             map[f.pair_id].leg2 = f
    }
  })
  return Object.values(map).sort((a, b) => (a.leg1?.round ?? 0) - (b.leg1?.round ?? 0))
}

// ── Two-leg mini bracket card ─────────────────────────────────────
function TwoLegMatchCard({ leg1, leg2, playerMap, onEnterScore }) {
  if (!leg1 && !leg2) return null
  const ref = leg1 ?? leg2
  const homeP = playerMap[ref.home_player_id]   // leg1 home
  const awayP = playerMap[ref.away_player_id]   // leg1 away
  const leg1Done = leg1?.status === 'completed'
  const leg2Done = leg2?.status === 'completed'
  const bothDone = leg1Done && leg2Done

  // Aggregate: homeP total = leg1.home + leg2.away
  const aggHome = (leg1Done ? (leg1.home_score ?? 0) : 0) + (leg2Done ? (leg2.away_score ?? 0) : 0)
  const aggAway = (leg1Done ? (leg1.away_score ?? 0) : 0) + (leg2Done ? (leg2.home_score ?? 0) : 0)
  const aggWinner = bothDone ? (aggHome > aggAway ? homeP?.name : aggAway > aggHome ? awayP?.name : 'Draw') : null

  return (
    <div className="rounded-xl border border-gray-700 overflow-hidden bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-800/70 border-b border-gray-700">
        <span className="text-sm font-bold text-white truncate flex-1">{homeP?.name}</span>
        <span className="text-[10px] text-gray-500 font-semibold shrink-0 tracking-widest">VS</span>
        <span className="text-sm font-bold text-white truncate flex-1 text-right">{awayP?.name}</span>
      </div>

      {/* Leg 1 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-10 shrink-0">Leg 1</span>
        <span className="text-xs text-gray-400 flex-1 truncate">🏠 {homeP?.name}</span>
        {leg1Done ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-indigo-300 tabular-nums">{leg1.home_score} – {leg1.away_score}</span>
            <button onClick={() => onEnterScore(leg1)} className="text-xs text-gray-600 hover:text-gray-300 underline">Edit</button>
          </div>
        ) : leg1 ? (
          <button onClick={() => onEnterScore(leg1)} className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg font-medium">
            Score
          </button>
        ) : null}
      </div>

      {/* Leg 2 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider w-10 shrink-0">Leg 2</span>
        <span className="text-xs text-gray-400 flex-1 truncate">🏠 {awayP?.name}</span>
        {leg2Done ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-amber-300 tabular-nums">{leg2.home_score} – {leg2.away_score}</span>
            <button onClick={() => onEnterScore(leg2)} className="text-xs text-gray-600 hover:text-gray-300 underline">Edit</button>
          </div>
        ) : leg2 ? (
          <button onClick={() => onEnterScore(leg2)} className="shrink-0 text-xs bg-amber-700 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg font-medium">
            Score
          </button>
        ) : (
          <span className="text-xs text-gray-700 italic">–</span>
        )}
      </div>

      {/* Aggregate */}
      <div className={`flex items-center justify-center gap-2 px-4 py-2 ${bothDone ? 'bg-gray-800/50' : 'bg-gray-900'}`}>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Agg</span>
        <span className={`text-sm font-black tabular-nums ${bothDone && aggHome > aggAway ? 'text-white' : 'text-gray-500'}`}>
          {leg1Done ? leg1.home_score : '?'}{leg2Done ? `+${leg2.away_score}` : '+?'}
        </span>
        <span className="text-gray-700 text-xs">–</span>
        <span className={`text-sm font-black tabular-nums ${bothDone && aggAway > aggHome ? 'text-white' : 'text-gray-500'}`}>
          {leg1Done ? leg1.away_score : '?'}{leg2Done ? `+${leg2.home_score}` : '+?'}
        </span>
        {bothDone && aggWinner && (
          <span className="text-[10px] text-green-400 font-semibold ml-1">→ {aggWinner}</span>
        )}
      </div>
    </div>
  )
}

// ── Draggable player chip ─────────────────────────────────────────
function DraggablePlayer({ player, index, draggingId, onDragStart, onRemove, onRename, groups, onAssign, compact }) {
  const isDragging = draggingId === player.id
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, player.id)}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none transition-all ${
        isDragging
          ? 'opacity-40 border-indigo-500 bg-indigo-950/60'
          : compact
          ? 'border-gray-700 bg-gray-800 hover:border-indigo-500'
          : 'border-gray-700 bg-gray-800 hover:border-indigo-500'
      }`}
    >
      <PlayerAvatar player={player} index={index} size="xs" />
      <span className="text-sm font-medium text-white truncate flex-1">{player.name}</span>

      {/* Move-to dropdown (touch/mobile fallback) */}
      {groups.length > 0 && (
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) onAssign(player.id, parseInt(e.target.value)); e.target.value = '' }}
          onClick={e => e.stopPropagation()}
          className="text-[10px] bg-gray-700 border-0 rounded px-1 py-0.5 text-gray-300 cursor-pointer hover:bg-gray-600 transition-colors"
          title="Move to group"
        >
          <option value="" disabled>Move→</option>
          {groups.map(g => (
            <option key={g} value={g}>Group {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[g - 1]}</option>
          ))}
        </select>
      )}

      {onRename && (
        <button
          onClick={e => { e.stopPropagation(); onRename() }}
          className="text-gray-600 hover:text-indigo-400 transition-colors text-xs shrink-0"
          title="Rename player"
        >
          ✏️
        </button>
      )}
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0 ml-0.5"
        title="Remove player"
      >
        ✕
      </button>
    </div>
  )
}

// ── Shared match row component ────────────────────────────────────
function MatchRow({ fixture: f, playerMap, onEnterScore }) {
  const homeWon = f.status === 'completed' && f.home_score > f.away_score
  const awayWon = f.status === 'completed' && f.away_score > f.home_score
  return (
    <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`text-sm font-medium truncate ${homeWon ? 'text-white' : 'text-gray-300'}`}>
          {playerMap[f.home_player_id]?.name}
        </span>
        <span className="text-gray-500 text-xs shrink-0">vs</span>
        <span className={`text-sm font-medium truncate ${awayWon ? 'text-white' : 'text-gray-300'}`}>
          {playerMap[f.away_player_id]?.name}
        </span>
      </div>
      {f.status === 'completed' ? (
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className="text-sm font-bold text-indigo-400">{f.home_score} – {f.away_score}</span>
          <button onClick={() => onEnterScore(f)} className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors">Edit</button>
        </div>
      ) : (
        <button onClick={() => onEnterScore(f)} className="ml-2 shrink-0 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
          Enter Score
        </button>
      )}
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────
function SettingsPanel({ tournament, fixtures, players = [], onSaved, onConvertFinal, onReseedBracket, isKnockoutFixture, actionLoading }) {
  const navigate = useNavigate()
  const [name,        setName]        = useState(tournament.name        ?? '')
  const [description, setDescription] = useState(tournament.description ?? '')
  const [maxPlayers,  setMaxPlayers]  = useState(tournament.max_players ?? 8)
  const [homeAway,    setHomeAway]    = useState(!!tournament.home_away)
  const [numGroups,   setNumGroups]   = useState(tournament.num_groups ?? 4)
  const [teamsAdv,    setTeamsAdv]    = useState(tournament.teams_advancing ?? 2)
  const [saving,      setSaving]      = useState(false)
  const [savedAt,     setSavedAt]     = useState(null)
  const [err,         setErr]         = useState('')

  const hasFixtures = fixtures.length > 0
  const isGroupKO   = tournament.format === 'group_knockout'

  const save = async () => {
    setErr('')
    setSaving(true)
    const patch = {
      name: name.trim(),
      description: description.trim() || null,
      max_players: Number(maxPlayers) || 8,
      home_away: homeAway,
    }
    if (isGroupKO) {
      patch.num_groups = Number(numGroups) || 4
      patch.teams_advancing = Number(teamsAdv) || 2
    }
    const { error } = await supabase
      .from('tournaments')
      .update(patch)
      .eq('id', tournament.id)
    setSaving(false)
    if (error) return setErr(error.message)
    setSavedAt(new Date())
    onSaved?.()
  }

  const deleteTournament = async () => {
    const confirmText = window.prompt(
      `⚠️ DELETE "${tournament.name}"?\n\nThis permanently removes all players, fixtures, standings, and results.\n\nType the tournament name to confirm:`
    )
    if (confirmText !== tournament.name) {
      if (confirmText !== null) alert('Name did not match — nothing was deleted.')
      return
    }
    const { error } = await supabase.from('tournaments').delete().eq('id', tournament.id)
    if (error) return setErr(error.message)
    navigate('/dashboard')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Tournament Settings</h2>
        <p className="text-xs text-gray-500">Edit details, configuration, and danger-zone actions.</p>
      </div>

      {err && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">
          {err}
        </div>
      )}

      {/* General */}
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">General</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Tournament name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500"
            placeholder="Optional…"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Max players (cap)</label>
          <input
            type="number"
            min={2}
            max={64}
            value={maxPlayers}
            onChange={e => setMaxPlayers(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[10px] text-gray-500 mt-1">Just a soft cap shown in cards — doesn't change existing fixtures.</p>
        </div>
      </section>

      {/* Format options */}
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Format</h3>

        <div className="flex items-start gap-3 bg-gray-800/40 border border-gray-700 rounded-lg p-3">
          <input
            id="setting-homeaway"
            type="checkbox"
            checked={homeAway}
            onChange={e => setHomeAway(e.target.checked)}
            disabled={hasFixtures}
            className="mt-0.5 w-4 h-4 accent-indigo-500 cursor-pointer disabled:cursor-not-allowed"
          />
          <label htmlFor="setting-homeaway" className={`text-sm ${hasFixtures ? 'text-gray-500' : 'text-white cursor-pointer'}`}>
            <span className="font-semibold">🔄 Home &amp; Away</span>
            <span className="block text-[11px] text-gray-500 mt-0.5">
              Each matchup plays two legs. {hasFixtures && '(locked — regenerate fixtures to change)'}
            </span>
          </label>
        </div>

        {isGroupKO && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Number of groups</label>
              <input
                type="number"
                min={2}
                max={16}
                value={numGroups}
                disabled={hasFixtures}
                onChange={e => setNumGroups(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Teams advancing / group</label>
              <input
                type="number"
                min={1}
                max={8}
                value={teamsAdv}
                onChange={e => setTeamsAdv(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {hasFixtures && (
              <p className="text-[10px] text-amber-400/80 col-span-2">
                ⚠️ Some format changes are locked because fixtures already exist. Regenerate fixtures from the Players tab to apply them.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-900/40"
        >
          {saving ? 'Saving…' : '💾 Save changes'}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-400">
            ✓ Saved at {savedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Knockout bracket editor */}
      <BracketEditor
        tournament={tournament}
        fixtures={fixtures}
        players={players}
        onSaved={onSaved}
        onConvertFinal={onConvertFinal}
        onReseedBracket={onReseedBracket}
        isKnockoutFixture={isKnockoutFixture}
        actionLoading={actionLoading}
      />

      {/* Danger zone */}
      <section className="border-2 border-red-900/60 bg-red-950/20 rounded-2xl p-5 mt-8">
        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">⚠️ Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">
          Permanently delete this tournament and everything in it (players, fixtures, results, standings). This cannot be undone.
        </p>
        <button
          onClick={deleteTournament}
          className="bg-red-700 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-red-950/50"
        >
          🗑 Delete tournament
        </button>
      </section>
    </div>
  )
}

// ── Knockout Bracket Editor ───────────────────────────────────────
// Lets the user manually assign players to any knockout matchup
// (most useful for Semi-Finals and the Final). Saving updates the
// home_player_id / away_player_id on the underlying fixture(s) —
// for two-leg ties both legs are updated with players swapped so
// home/away alternates correctly.
function BracketEditor({ tournament, fixtures, players, onSaved, onConvertFinal, onReseedBracket, isKnockoutFixture, actionLoading }) {
  // Only show knockout-phase fixtures
  const knockoutFx = (fixtures ?? []).filter(f => {
    if (typeof isKnockoutFixture === 'function') return isKnockoutFixture(f)
    if (tournament?.format === 'knockout') return true
    return (f.phase ?? 'regular') === 'knockout'
  })

  // Detect a two-leg final (any knockout final with same pair_id across 2 fixtures)
  let twoLegFinalDetected = false
  if (knockoutFx.length > 0) {
    const maxR = Math.max(...knockoutFx.map(f => f.round ?? 1))
    const finalFx = knockoutFx.filter(f => f.round === maxR)
    twoLegFinalDetected = finalFx.length === 2 &&
      finalFx[0].pair_id && finalFx[0].pair_id === finalFx[1].pair_id
  }

  if (knockoutFx.length === 0) {
    return (
      <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 mt-8">
        <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-1">⚔️ Bracket Editor</h3>
        <p className="text-xs text-gray-500">
          No knockout fixtures yet. Generate them from the Players tab first, then come back here to manually pick the matchups.
        </p>
      </section>
    )
  }

  // Build matchups (single or two-leg by pair_id)
  const byPair = {}, noPair = []
  knockoutFx.forEach(f => {
    if (f.pair_id) (byPair[f.pair_id] ??= []).push(f)
    else noPair.push(f)
  })
  const matchups = []
  noPair.forEach(f => matchups.push({ type: 'single', f, round: f.round, createdAt: f.created_at }))
  Object.values(byPair).forEach(legs => {
    const leg1 = legs.find(l => l.leg === 1) ?? legs[0]
    const leg2 = legs.find(l => l.leg === 2)
    matchups.push({ type: 'two-leg', leg1, leg2, round: leg1.round, createdAt: leg1.created_at })
  })
  matchups.sort((a, b) => a.round - b.round || new Date(a.createdAt) - new Date(b.createdAt))

  // Group by round for nice section headers
  const roundsMap = {}
  matchups.forEach(m => { (roundsMap[m.round] ??= []).push(m) })
  const sortedRounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b)

  const labelFor = (matchCount) => {
    if (matchCount === 1) return 'Final'
    if (matchCount === 2) return 'Semi-Finals'
    if (matchCount === 4) return 'Quarter-Finals'
    if (matchCount === 8) return 'Round of 16'
    return `Round of ${matchCount * 2}`
  }

  return (
    <section className="bg-gray-900/60 border border-indigo-800/40 rounded-2xl p-5 mt-8">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">⚔️ Bracket Editor</h3>
          <p className="text-xs text-gray-500 mt-1">
            Manually assign players to any knockout match. Scores already entered are kept — only the player names change.
          </p>
        </div>
        {onReseedBracket && (
          <button
            onClick={onReseedBracket}
            disabled={actionLoading}
            className="shrink-0 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            title="Walk every round and update next-round player names based on the actual winners"
          >
            🔄 {actionLoading ? 'Re-seeding…' : 'Re-seed from Results'}
          </button>
        )}
      </div>

      {/* Two-leg final detected banner */}
      {twoLegFinalDetected && onConvertFinal && (
        <div className="mb-4 p-3 bg-amber-950/30 border border-amber-700/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-200">⚠️ The Final has two legs</p>
            <p className="text-[11px] text-amber-300/80 mt-0.5">
              Finals should be a single match. Convert it now to drop Leg 2 and keep Leg 1 as the deciding game.
            </p>
          </div>
          <button
            onClick={onConvertFinal}
            className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow-lg shadow-amber-950/40"
          >
            🔄 Convert Final to Single Match
          </button>
        </div>
      )}

      <div className="space-y-5">
        {sortedRounds.map(r => {
          const ms = roundsMap[r]
          return (
            <div key={r}>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">
                {labelFor(ms.length)}
              </p>
              <div className="space-y-2">
                {ms.map((m, idx) => (
                  <MatchupRow
                    key={m.type === 'single' ? m.f.id : m.leg1.id}
                    matchup={m}
                    index={idx}
                    players={players}
                    onSaved={onSaved}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// One editable matchup row inside the bracket editor.
function MatchupRow({ matchup: m, index, players, onSaved }) {
  const [homeId, setHomeId] = useState(
    m.type === 'single' ? m.f.home_player_id : m.leg1.home_player_id
  )
  const [awayId, setAwayId] = useState(
    m.type === 'single' ? m.f.away_player_id : m.leg1.away_player_id
  )
  const [saving, setSaving] = useState(false)
  const [savedFlag, setSavedFlag] = useState(false)
  const [err, setErr] = useState('')

  const originalHome = m.type === 'single' ? m.f.home_player_id : m.leg1.home_player_id
  const originalAway = m.type === 'single' ? m.f.away_player_id : m.leg1.away_player_id
  const changed     = homeId !== originalHome || awayId !== originalAway
  const sameBoth    = homeId && awayId && homeId === awayId

  const save = async () => {
    if (!changed || sameBoth) return
    setSaving(true); setErr('')
    try {
      if (m.type === 'single') {
        const { error } = await supabase
          .from('fixtures')
          .update({ home_player_id: homeId, away_player_id: awayId })
          .eq('id', m.f.id)
        if (error) throw error
      } else {
        // Leg 1: A home vs B away
        const { error: e1 } = await supabase
          .from('fixtures')
          .update({ home_player_id: homeId, away_player_id: awayId })
          .eq('id', m.leg1.id)
        if (e1) throw e1
        // Leg 2: swapped — B home vs A away
        if (m.leg2) {
          const { error: e2 } = await supabase
            .from('fixtures')
            .update({ home_player_id: awayId, away_player_id: homeId })
            .eq('id', m.leg2.id)
          if (e2) throw e2
        }
      }
      setSavedFlag(true)
      setTimeout(() => setSavedFlag(false), 2000)
      onSaved?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setHomeId(originalHome)
    setAwayId(originalAway)
  }

  // Has either fixture got a score recorded? Warn before changing.
  const hasScore = m.type === 'single'
    ? m.f.status === 'completed'
    : (m.leg1.status === 'completed' || m.leg2?.status === 'completed')

  // ── Leg conversions ────────────────────────────────────────────
  const isTwoLeg = m.type === 'two-leg'

  // 2-leg → 1-leg: delete leg 2, clear pair_id on leg 1
  const convertToSingleLeg = async () => {
    if (!isTwoLeg) return
    const leg1 = m.leg1, leg2 = m.leg2
    if (leg1?.status === 'completed' && leg2?.status === 'completed') {
      alert(
        '⚠️ Both legs already have a recorded score.\n\n' +
        'Converting now would lose Leg 2 results — reset one of the legs first.'
      )
      return
    }
    if (!confirm(
      'Convert this match to a single leg?\n\n' +
      'Leg 2 will be deleted. Leg 1 becomes the only game.\n' +
      '(Any score in Leg 1 is kept.)'
    )) return
    setSaving(true); setErr('')
    try {
      if (leg2) {
        const { error: e1 } = await supabase.from('fixtures').delete().eq('id', leg2.id)
        if (e1) throw e1
      }
      const { error: e2 } = await supabase
        .from('fixtures')
        .update({ pair_id: null, leg: 1 })
        .eq('id', leg1.id)
      if (e2) throw e2
      onSaved?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  // 1-leg → 2-leg: create leg 2 with swapped home/away
  const convertToTwoLeg = async () => {
    if (isTwoLeg) return
    const f = m.f
    if (!confirm(
      'Convert this match to home & away (two legs)?\n\n' +
      'A new Leg 2 fixture will be created with the home/away ' +
      'players swapped. Leg 1 keeps any score already entered.'
    )) return
    setSaving(true); setErr('')
    try {
      const pairId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
      // Mark the existing fixture as leg 1 of the new pair
      const { error: e1 } = await supabase
        .from('fixtures')
        .update({ pair_id: pairId, leg: 1 })
        .eq('id', f.id)
      if (e1) throw e1
      // Insert leg 2 with swapped players
      const { error: e2 } = await supabase.from('fixtures').insert({
        tournament_id:  f.tournament_id,
        home_player_id: f.away_player_id, // swapped
        away_player_id: f.home_player_id,
        round:          f.round,
        phase:          f.phase ?? null,
        leg:            2,
        pair_id:        pairId,
        status:         'pending',
      })
      if (e2) throw e2
      onSaved?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold shrink-0">
          M{index + 1}
        </span>

        <select
          value={homeId ?? ''}
          onChange={e => setHomeId(e.target.value || null)}
          disabled={saving}
          className="flex-1 min-w-[120px] bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">— pick —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <span className="text-xs text-gray-500 font-bold">vs</span>

        <select
          value={awayId ?? ''}
          onChange={e => setAwayId(e.target.value || null)}
          disabled={saving}
          className="flex-1 min-w-[120px] bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">— pick —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Leg format toggle — click 1-Leg / 2-Leg to convert this matchup */}
        <div className="flex rounded-md border border-gray-700 overflow-hidden shrink-0 text-[10px] uppercase tracking-wider font-bold">
          <button
            onClick={convertToSingleLeg}
            disabled={saving || !isTwoLeg}
            title={!isTwoLeg ? 'Already a single-leg match' : 'Convert to single-leg (delete Leg 2)'}
            className={`px-2 py-1 transition-colors ${
              !isTwoLeg
                ? 'bg-indigo-600 text-white cursor-default'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >1-Leg</button>
          <button
            onClick={convertToTwoLeg}
            disabled={saving || isTwoLeg}
            title={isTwoLeg ? 'Already a two-leg tie' : 'Convert to home & away (add Leg 2)'}
            className={`px-2 py-1 transition-colors border-l border-gray-700 ${
              isTwoLeg
                ? 'bg-amber-600 text-white cursor-default'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >2-Leg</button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {changed && (
            <button
              onClick={reset}
              disabled={saving}
              className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={save}
            disabled={!changed || saving || sameBoth}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saving ? 'Saving…' : savedFlag ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Inline warnings / errors */}
      {sameBoth && (
        <p className="text-[11px] text-amber-400 mt-1.5">⚠️ Both players are the same — pick different ones.</p>
      )}
      {hasScore && changed && !sameBoth && (
        <p className="text-[11px] text-amber-400 mt-1.5">
          ⚠️ This match has a recorded score — saving will keep the score but change the players.
        </p>
      )}
      {err && (
        <p className="text-[11px] text-red-400 mt-1.5">{err}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//   Posters tab — admin-side photo upload + live preview of the
//   four celebration layers (Champion, Runner-Up, Top Scorers).
//   Photos uploaded here automatically show up on the public live
//   page once the tournament status is "completed".
// ═══════════════════════════════════════════════════════════════════
function PostersPanel({ tournament, fixtures, players, isKnockoutFixture }) {
  const playerMap = useMemo(
    () => Object.fromEntries((players ?? []).map(p => [p.id, p])),
    [players]
  )

  // Detect champion / runner-up / top scorers from current fixtures —
  // works even before "End Tournament" so the admin can pre-load
  // photos for the front-runners.
  const award = useMemo(() => {
    const stats = computeTournamentStats(fixtures, players, tournament)

    let champion = null, runnerUp = null, finalScore = null
    const koFx = (fixtures ?? []).filter(f =>
      typeof isKnockoutFixture === 'function'
        ? isKnockoutFixture(f)
        : (tournament?.format === 'knockout' || (f.phase ?? 'regular') === 'knockout')
    )
    if (koFx.length) {
      const maxR  = Math.max(...koFx.map(f => f.round ?? 1))
      const finalFx = koFx.filter(f => f.round === maxR)
      if (finalFx.length === 2 && finalFx[0].pair_id && finalFx[0].pair_id === finalFx[1].pair_id) {
        const l1 = finalFx.find(l => l.leg === 1) ?? finalFx[0]
        const l2 = finalFx.find(l => l.leg === 2) ?? finalFx[1]
        if (l1.status === 'completed' && l2.status === 'completed') {
          const a = (l1.home_score ?? 0) + (l2.away_score ?? 0)
          const b = (l1.away_score ?? 0) + (l2.home_score ?? 0)
          if (a > b) { champion = playerMap[l1.home_player_id]; runnerUp = playerMap[l1.away_player_id] }
          else if (b > a) { champion = playerMap[l1.away_player_id]; runnerUp = playerMap[l1.home_player_id] }
          finalScore = `${Math.max(a,b)} – ${Math.min(a,b)} (agg.)`
        }
      } else if (finalFx.length === 1 && finalFx[0].status === 'completed') {
        const f = finalFx[0]
        if (f.home_score > f.away_score) { champion = playerMap[f.home_player_id]; runnerUp = playerMap[f.away_player_id] }
        else if (f.away_score > f.home_score) { champion = playerMap[f.away_player_id]; runnerUp = playerMap[f.home_player_id] }
        finalScore = `${Math.max(f.home_score, f.away_score)} – ${Math.min(f.home_score, f.away_score)}`
      }
    }

    const buildStats = (id) => {
      if (!id) return null
      let matches = 0, gf = 0, ga = 0
      ;(fixtures ?? []).forEach(f => {
        if (f.status !== 'completed') return
        if (f.home_player_id === id) { matches++; gf += f.home_score ?? 0; ga += f.away_score ?? 0 }
        else if (f.away_player_id === id) { matches++; gf += f.away_score ?? 0; ga += f.home_score ?? 0 }
      })
      return { id, matches, gf, ga, gd: gf - ga, avgGF: matches ? gf/matches : 0, avgGA: matches ? ga/matches : 0 }
    }

    return {
      champion,
      runnerUp,
      finalScore,
      championStats: champion ? buildStats(champion.id) : null,
      runnerUpStats: runnerUp ? buildStats(runnerUp.id) : null,
      topScorers: stats.topScorers ?? [],
    }
  }, [tournament, fixtures, players, playerMap, isKnockoutFixture])

  const isCompleted = tournament?.status === 'completed'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">📸 Posters &amp; Champion Photos</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xl">
            Upload photos for the trophy lineup. Once <strong>End Tournament</strong> is clicked, these posters appear on the public live page in 4 layers — viewers can see them but only you can edit photos here.
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isCompleted
            ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
            : 'bg-amber-950/60 border-amber-700/50 text-amber-300'
        }`}>
          {isCompleted ? '✓ Live on public page' : '⏳ Preview — end tournament to publish'}
        </div>
      </div>

      {/* Player photo grid — quick upload for ANY player */}
      <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3">All Players</h3>
        <p className="text-xs text-gray-500 mb-4">
          Upload a photo for any player. The same photo automatically appears in every poster that player ends up in (Champion, Runner-Up, Top Scorer).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(players ?? []).map(p => (
            <PlayerPhotoTile key={p.id} tournamentId={tournament.id} player={p} />
          ))}
        </div>
      </section>

      {/* Champion preview */}
      {award.champion ? (
        <section>
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3">🏆 Champion Poster</h3>
          <ChampionPosterCard
            tournament={tournament}
            champion={award.champion}
            runnerUp={award.runnerUp}
            finalScore={award.finalScore}
            championStats={award.championStats}
            runnerUpStats={award.runnerUpStats}
            allowUpload
          />
        </section>
      ) : (
        <PlaceholderPanel
          icon="🏆"
          title="Champion poster"
          message="No champion yet — complete the Final to lock this in."
        />
      )}

      {/* Runner-up preview */}
      {award.runnerUp ? (
        <section>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">🥈 Runner-Up Poster</h3>
          <RunnerUpPoster
            tournament={tournament}
            runnerUp={award.runnerUp}
            runnerUpStats={award.runnerUpStats}
            allowUpload
          />
        </section>
      ) : (
        <PlaceholderPanel
          icon="🥈"
          title="Runner-up poster"
          message="Final result needed before the runner-up is known."
        />
      )}

      {/* Top scorers preview */}
      {award.topScorers.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3">⚽ Golden Boot Poster</h3>
          <TopScorersPoster
            tournament={tournament}
            topScorers={award.topScorers}
            allowUpload
          />
        </section>
      ) : (
        <PlaceholderPanel
          icon="⚽"
          title="Top scorers poster"
          message="Play a few matches first — top scorers appear automatically."
        />
      )}
    </div>
  )
}

function PlaceholderPanel({ icon, title, message }) {
  return (
    <section className="bg-gray-900/30 border border-dashed border-gray-800 rounded-2xl p-8 text-center">
      <p className="text-4xl mb-2 opacity-60">{icon}</p>
      <p className="text-sm font-semibold text-gray-300">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{message}</p>
    </section>
  )
}

// Compact thumbnail + upload control for a single player.
function PlayerPhotoTile({ tournamentId, player }) {
  const [photo, setPhoto] = useState(() => getPlayerPhoto(tournamentId, player.id))
  const fileRef = useRef(null)
  useEffect(() => { setPhoto(getPlayerPhoto(tournamentId, player.id)) }, [tournamentId, player.id])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPlayerPhoto(tournamentId, player.id, dataUrl)
      setPhoto(dataUrl)
    } catch (err) {
      alert(err.message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const remove = () => {
    if (!confirm(`Remove ${player.name}'s photo?`)) return
    clearPlayerPhoto(tournamentId, player.id)
    setPhoto(null)
  }

  return (
    <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5">
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 shrink-0">
        {photo ? (
          <img src={photo} alt={player.name} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xl opacity-50">👤</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-2 py-0.5 rounded transition-colors"
          >
            📸 {photo ? 'Change' : 'Upload'}
          </button>
          {photo && (
            <button
              onClick={remove}
              className="text-[10px] text-gray-400 hover:text-red-400 px-1.5 py-0.5 transition-colors"
              title="Remove photo"
            >✕</button>
          )}
        </div>
      </div>
    </div>
  )
}
