import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useTournament } from '../hooks/useTournament'
import LeagueTable from '../components/LeagueTable'
import KnockoutBracket from '../components/KnockoutBracket'

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
    if (!confirm(`Generate ${tournament.format} fixtures? This will clear existing fixtures.`)) return
    setActionLoading(true)
    setActionError('')
    const fn = tournament.format === 'league' ? 'generate_league_fixtures' : 'generate_knockout_fixtures'
    const { error } = await supabase.rpc(fn, { p_tournament_id: id })
    if (error) setActionError(error.message)
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
    const { error } = await supabase.rpc('process_match_result', {
      p_fixture_id: scoreModal.id,
      p_home_score: parseInt(scores.home),
      p_away_score: parseInt(scores.away),
    })
    if (error) setActionError(error.message)
    setScoreModal(null)
    setActionLoading(false)
    refetch()
  }

  const advanceRound = async () => {
    setActionLoading(true)
    setActionError('')
    const { error } = await supabase.rpc('advance_knockout_round', { p_tournament_id: id })
    if (error) setActionError(error.message)
    setActionLoading(false)
    refetch()
  }

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const pendingFixtures = fixtures.filter(f => f.status === 'pending')
  const completedFixtures = fixtures.filter(f => f.status === 'completed')
  const currentRoundComplete = pendingFixtures.length === 0 && fixtures.length > 0

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">{error}</div>
  )

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
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${tournament?.status === 'active' ? 'bg-green-800 text-green-300' : tournament?.status === 'completed' ? 'bg-indigo-800 text-indigo-300' : 'bg-gray-700 text-gray-300'}`}>
              {tournament?.status}
            </span>
            {tournament && (
              <a
                href={`/t/${tournament.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <span className="hidden sm:inline">Public page</span>
                <span className="sm:hidden">↗</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-1">
          <h1 className="text-xl font-bold">{tournament?.name}</h1>
          <p className="text-gray-400 text-sm capitalize">{tournament?.format} · {players.length}/{tournament?.max_players} players</p>
        </div>

        {actionError && (
          <div className="mt-3 bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
            {actionError}
          </div>
        )}

        {/* Action bar */}
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
              {actionLoading ? 'Generating…' : 'Generate Fixtures'}
            </button>
          </div>
        )}

        {tournament?.format === 'knockout' && tournament?.status === 'active' && currentRoundComplete && (
          <div className="mt-4 p-4 bg-green-950/40 border border-green-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm font-medium text-green-200">All matches complete — advance to next round?</p>
            <button
              onClick={advanceRound}
              disabled={actionLoading}
              className="shrink-0 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {actionLoading ? 'Advancing…' : 'Next Round →'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mt-6 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {t}
              {t === 'Fixtures' && pendingFixtures.length > 0 && (
                <span className="ml-1.5 bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5">{pendingFixtures.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {/* PLAYERS TAB */}
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
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {players.map((p, i) => (
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

          {/* FIXTURES TAB */}
          {tab === 'Fixtures' && (
            <div>
              {fixtures.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No fixtures yet. Generate them from the action bar above.</p>
              ) : tournament.format === 'knockout' ? (
                /* Knockout — visual bracket with inline Enter Score buttons */
                <KnockoutBracket fixtures={fixtures} players={players} onEnterScore={openScoreModal} />
              ) : (
                /* League — round-by-round list */
                <div className="space-y-4">
                  {[...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b).map(round => (
                    <div key={round}>
                      <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Round {round}</h3>
                      <div className="space-y-2 mb-4">
                        {fixtures.filter(f => f.round === round).map(f => (
                          <div key={f.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className={`text-sm font-medium truncate ${f.status === 'completed' && f.home_score > f.away_score ? 'text-white' : 'text-gray-300'}`}>
                                {playerMap[f.home_player_id]?.name}
                              </span>
                              <span className="text-gray-500 text-xs shrink-0">vs</span>
                              <span className={`text-sm font-medium truncate ${f.status === 'completed' && f.away_score > f.home_score ? 'text-white' : 'text-gray-300'}`}>
                                {playerMap[f.away_player_id]?.name}
                              </span>
                            </div>
                            {f.status === 'completed' ? (
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <span className="text-sm font-bold text-indigo-400">{f.home_score} – {f.away_score}</span>
                                <button onClick={() => openScoreModal(f)} className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors">Edit</button>
                              </div>
                            ) : (
                              <button onClick={() => openScoreModal(f)} className="ml-2 shrink-0 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                                Enter Score
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RESULTS TAB */}
          {tab === 'Results' && (
            <div>
              {completedFixtures.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No completed matches yet.</p>
              ) : (
                <div className="space-y-2">
                  {completedFixtures.map(f => {
                    const homeWon = f.home_score > f.away_score
                    const awayWon = f.away_score > f.home_score
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
                        <div className="text-center mt-1">
                          <span className="text-xs text-gray-500">Round {f.round} · {new Date(f.played_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STATS TAB */}
          {tab === 'Stats' && (
            <div>
              {tournament?.format === 'league' ? (
                <LeagueTable standings={standings} players={players} />
              ) : (
                <KnockoutBracket fixtures={fixtures} players={players} onEnterScore={openScoreModal} />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Score Modal */}
      {scoreModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setScoreModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Enter Score</h3>
            <p className="text-sm text-gray-400 mb-4">
              {playerMap[scoreModal.home_player_id]?.name} vs {playerMap[scoreModal.away_player_id]?.name}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">{playerMap[scoreModal.home_player_id]?.name}</label>
                <input
                  type="number"
                  min={0}
                  value={scores.home}
                  onChange={e => setScores(s => ({ ...s, home: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-gray-500 font-bold pt-5">–</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">{playerMap[scoreModal.away_player_id]?.name}</label>
                <input
                  type="number"
                  min={0}
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
