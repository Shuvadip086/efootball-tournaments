import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useTournament } from '../hooks/useTournament'
import LeagueTable from '../components/LeagueTable'
import KnockoutBracket from '../components/KnockoutBracket'
import GroupStandings from '../components/GroupStandings'

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const TABS = ['Players', 'Fixtures', 'Results', 'Stats']

export default function ManageTournamentPage() {
  const { id } = useParams()
  const { tournament, players, fixtures, standings, loading, error, refetch } = useTournament(id)
  const [tab, setTab] = useState('Players')
  const [newPlayer, setNewPlayer] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [scoreModal, setScoreModal] = useState(null)
  const [scores, setScores] = useState({ home: '', away: '' })

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

  const generateFixtures = async () => {
    const label = tournament.format === 'league'
      ? 'league'
      : tournament.format === 'group_knockout'
      ? 'group stage'
      : 'knockout'
    if (!confirm(`Generate ${label} fixtures? This will clear any existing fixtures.`)) return
    setActionLoading(true)
    setActionError('')
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
      p_teams_advancing: 2,
    })
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  const advanceKnockoutRound = async () => {
    setActionLoading(true)
    setActionError('')
    const { error: err } = await supabase.rpc('advance_knockout_round', { p_tournament_id: id })
    if (err) setActionError(err.message)
    setActionLoading(false)
    refetch()
  }

  const openScoreModal = (fixture) => {
    setScoreModal(fixture)
    setScores({ home: fixture.home_score ?? '', away: fixture.away_score ?? '' })
  }

  const submitScore = async () => {
    if (scores.home === '' || scores.away === '') return
    setActionLoading(true)
    setActionError('')
    const { error: err } = await supabase.rpc('process_match_result', {
      p_fixture_id: scoreModal.id,
      p_home_score: parseInt(scores.home),
      p_away_score: parseInt(scores.away),
    })
    if (err) setActionError(err.message)
    setScoreModal(null)
    setActionLoading(false)
    refetch()
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <span className="font-semibold hidden sm:inline truncate max-w-xs">{tournament?.name}</span>
          </div>
          <div className="flex items-center gap-2">
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
          <h1 className="text-xl font-bold">{tournament?.name}</h1>
          <p className="text-gray-400 text-sm">
            {formatLabel} · {players.length}/{tournament?.max_players} players
            {tournament?.format === 'group_knockout' && tournament?.num_groups && (
              <span className="ml-1">· {tournament.num_groups} groups</span>
            )}
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

        {/* Knockout phase banner */}
        {tournament?.format === 'group_knockout' && inKnockoutPhase && (
          <div className="mt-4 px-4 py-2.5 bg-indigo-950/30 border border-indigo-800/50 rounded-xl flex items-center gap-2">
            <span className="text-indigo-400 text-sm">⚡</span>
            <span className="text-indigo-300 text-sm font-medium">Knockout stage in progress</span>
          </div>
        )}

        {/* Advance knockout round */}
        {(tournament?.format === 'knockout' || inKnockoutPhase) &&
          tournament?.status === 'active' && knockoutRoundComplete && (
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
              <div className="flex gap-2 mb-4">
                <input
                  value={newPlayer}
                  onChange={e => setNewPlayer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlayer()}
                  placeholder="Player name…"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={addPlayer}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  Add
                </button>
              </div>

              {players.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No players yet. Add some above!</p>
              ) : tournament?.format === 'group_knockout' && players.some(p => p.group_number) ? (
                /* Group view — show players organised by group */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: tournament.num_groups ?? 4 }, (_, i) => i + 1).map(g => {
                    const gPlayers = players.filter(p => p.group_number === g)
                    if (!gPlayers.length) return null
                    return (
                      <div key={g} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2 bg-gray-900/80">
                          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-xs font-bold">
                            {GROUP_LETTERS[g - 1]}
                          </div>
                          <span className="text-sm font-semibold text-gray-200">Group {GROUP_LETTERS[g - 1]}</span>
                        </div>
                        {gPlayers.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 bg-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                                {p.name[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-sm">{p.name}</span>
                            </div>
                            <button
                              onClick={() => removePlayer(p.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Default flat list */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-700 rounded-full flex items-center justify-center text-sm font-bold">
                          {p.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                      >
                        Remove
                      </button>
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
                              {gFixtures.map(f => <MatchRow key={f.id} fixture={f} playerMap={playerMap} onEnterScore={openScoreModal} />)}
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
                      <KnockoutBracket fixtures={knockoutFixtures} players={players} onEnterScore={openScoreModal} />
                    </div>
                  )}
                </>

              ) : tournament?.format === 'knockout' ? (
                <KnockoutBracket fixtures={fixtures} players={players} onEnterScore={openScoreModal} />

              ) : (
                /* League — round-by-round */
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
                <KnockoutBracket fixtures={fixtures} players={players} onEnterScore={openScoreModal} />
              )}
              {tournament?.format === 'group_knockout' && (
                <div>
                  {/* Group standings always visible */}
                  <GroupStandings
                    standings={standings}
                    players={players}
                    numGroups={tournament.num_groups ?? 4}
                  />

                  {/* Knockout bracket if we've advanced */}
                  {knockoutFixtures.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 border border-amber-800/50 px-3 py-1 rounded-full">
                          Knockout Bracket
                        </span>
                      </div>
                      <KnockoutBracket fixtures={knockoutFixtures} players={players} onEnterScore={openScoreModal} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

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
