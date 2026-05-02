import { useParams, Link } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { useRealtimeStandings } from '../hooks/useRealtimeStandings'
import LeagueTable from '../components/LeagueTable'
import KnockoutBracket from '../components/KnockoutBracket'

export default function PublicTournamentPage() {
  const { slug } = useParams()
  const { tournament, players, fixtures, loading, error } = useTournament(slug, { bySlug: true })
  const realtimeStandings = useRealtimeStandings(tournament?.id)

  const standings = realtimeStandings.length ? realtimeStandings : []

  const completedFixtures = fixtures.filter(f => f.status === 'completed')
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error || !tournament) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <span className="text-5xl">🏟️</span>
      <h1 className="text-xl font-bold text-white">Tournament not found</h1>
      <Link to="/" className="text-indigo-400 hover:text-indigo-300 text-sm">← Go home</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-indigo-950 to-gray-950 border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 text-2xl">
            {tournament.format === 'knockout' ? '🥊' : '📊'}
          </div>
          <h1 className="text-3xl font-bold mb-2">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-gray-300 text-sm mb-3 max-w-md mx-auto">{tournament.description}</p>
          )}
          <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
            <span className="capitalize">{tournament.format}</span>
            <span>·</span>
            <span>{players.length} players</span>
            <span>·</span>
            <span className={`font-medium ${tournament.status === 'active' ? 'text-green-400' : tournament.status === 'completed' ? 'text-indigo-400' : 'text-gray-400'}`}>
              {tournament.status === 'active' ? '🟢 Live' : tournament.status === 'completed' ? '🏆 Completed' : '⏳ Draft'}
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Standings / Bracket */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            {tournament.format === 'league' ? '📊 Standings' : '🥊 Bracket'}
          </h2>
          {tournament.format === 'league' ? (
            <LeagueTable standings={standings} players={players} />
          ) : (
            <KnockoutBracket fixtures={fixtures} players={players} />
          )}
        </section>

        {/* Recent results */}
        {completedFixtures.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">🎮 Recent Results</h2>
            <div className="space-y-2">
              {[...completedFixtures].reverse().slice(0, 10).map(f => {
                const homeWon = f.home_score > f.away_score
                const awayWon = f.away_score > f.home_score
                return (
                  <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm flex-1 text-right truncate ${homeWon ? 'font-semibold text-white' : 'text-gray-400'}`}>
                        {playerMap[f.home_player_id]?.name}
                      </span>
                      <span className="text-base font-bold text-white shrink-0 tabular-nums">
                        {f.home_score} – {f.away_score}
                      </span>
                      <span className={`text-sm flex-1 text-left truncate ${awayWon ? 'font-semibold text-white' : 'text-gray-400'}`}>
                        {playerMap[f.away_player_id]?.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Players list */}
        <section>
          <h2 className="text-lg font-semibold mb-4">👥 Players ({players.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                <div className="w-7 h-7 bg-indigo-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                  {p.name[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-gray-600 pt-4">
          Powered by <span className="text-indigo-500">eFootball Tournaments</span>
        </p>
      </main>
    </div>
  )
}
