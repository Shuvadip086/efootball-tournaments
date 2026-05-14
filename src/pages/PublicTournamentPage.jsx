import { useParams, Link } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { useRealtimeStandings } from '../hooks/useRealtimeStandings'
import LeagueTable from '../components/LeagueTable'
import KnockoutBracket from '../components/KnockoutBracket'
import GroupStandings from '../components/GroupStandings'
import PlayerAvatar from '../components/PlayerAvatar'

const FORMAT_ICON  = { league: '📊', knockout: '🥊', group_knockout: '🏆' }
const FORMAT_LABEL = { league: 'Round Robin', knockout: 'Single Elimination', group_knockout: 'Group + Knockout' }

export default function PublicTournamentPage() {
  const { slug } = useParams()
  const { tournament, players, fixtures, loading, error } = useTournament(slug, { bySlug: true })
  const realtimeStandings = useRealtimeStandings(tournament?.id)
  const standings = realtimeStandings.length ? realtimeStandings : []

  const completedFixtures  = fixtures.filter(f => f.status === 'completed')
  const groupFixtures      = fixtures.filter(f => f.phase === 'group')
  const knockoutFixtures   = fixtures.filter(f => f.phase === 'knockout')
  const regularFixtures    = fixtures.filter(f => f.phase === 'regular' || !f.phase)
  const playerMap          = Object.fromEntries(players.map(p => [p.id, p]))

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

  const icon  = FORMAT_ICON[tournament.format]  ?? '⚽'
  const label = FORMAT_LABEL[tournament.format] ?? tournament.format

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden">
        {/* Pitch-grid background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-gray-950 to-emerald-950 opacity-90" />
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 59px,#fff 59px,#fff 60px),repeating-linear-gradient(90deg,transparent,transparent 59px,#fff 59px,#fff 60px)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950" />

        <div className="relative max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 mb-5 text-3xl shadow-2xl shadow-indigo-950/60">
            {icon}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2 leading-tight">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-gray-300 text-sm mb-4 max-w-md mx-auto">{tournament.description}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="bg-gray-800/80 text-gray-300 px-3 py-1 rounded-full text-xs font-medium">{label}</span>
            <span className="bg-gray-800/80 text-gray-300 px-3 py-1 rounded-full text-xs font-medium">
              {players.length} players
            </span>
            {tournament.home_away && (
              <span className="bg-indigo-900/60 text-indigo-300 border border-indigo-700/40 px-3 py-1 rounded-full text-xs font-medium">
                🔄 Home &amp; Away
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              tournament.status === 'active'    ? 'bg-green-500/20 text-green-400 border border-green-700/40' :
              tournament.status === 'completed' ? 'bg-amber-500/20 text-amber-400 border border-amber-700/40' :
                                                  'bg-gray-700/60 text-gray-400'
            }`}>
              {tournament.status === 'active' ? '🟢 Live' : tournament.status === 'completed' ? '🏆 Completed' : '⏳ Draft'}
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* ── Standings / Bracket ── */}
        {tournament.format === 'league' && standings.length > 0 && (
          <section>
            <SectionHeader icon="📊" title="Standings" />
            <LeagueTable standings={standings} players={players} />
          </section>
        )}

        {tournament.format === 'knockout' && fixtures.length > 0 && (
          <section>
            <SectionHeader icon="🥊" title="Bracket" />
            {/* Full-width bracket with horizontal scroll */}
            <div className="-mx-4 px-4 overflow-x-auto">
              <div className="min-w-[500px]">
                <KnockoutBracket fixtures={regularFixtures.length ? regularFixtures : fixtures} players={players} />
              </div>
            </div>
          </section>
        )}

        {tournament.format === 'group_knockout' && (
          <>
            {/* Group standings */}
            {standings.length > 0 && (
              <section>
                <SectionHeader icon="📊" title="Group Standings" />
                <GroupStandings
                  standings={standings}
                  players={players}
                  numGroups={tournament.num_groups ?? 4}
                  teamsAdvancing={tournament.teams_advancing ?? 2}
                />
              </section>
            )}

            {/* Knockout bracket */}
            {knockoutFixtures.length > 0 && (
              <section>
                <SectionHeader icon="🥊" title="Knockout Bracket" />
                <div className="-mx-4 px-4 overflow-x-auto">
                  <div className="min-w-[400px]">
                    <KnockoutBracket fixtures={knockoutFixtures} players={players} />
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Recent results ── */}
        {completedFixtures.length > 0 && (
          <section>
            <SectionHeader icon="🎮" title="Recent Results" />
            <div className="space-y-2">
              {[...completedFixtures].reverse().slice(0, 10).map(f => {
                const home = playerMap[f.home_player_id]
                const away = playerMap[f.away_player_id]
                const hIdx = players.findIndex(p => p.id === f.home_player_id)
                const aIdx = players.findIndex(p => p.id === f.away_player_id)
                const homeWon = f.home_score > f.away_score
                const awayWon = f.away_score > f.home_score
                return (
                  <div key={f.id} className="bg-gray-900/80 border border-gray-800/60 rounded-xl px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 flex-1 justify-end min-w-0`}>
                        <span className={`text-sm truncate ${homeWon ? 'font-bold text-white' : 'text-gray-400'}`}>{home?.name}</span>
                        <PlayerAvatar player={home} index={hIdx} size="sm" />
                      </div>
                      <div className="text-center shrink-0 min-w-[56px]">
                        <span className="text-base font-black text-white tabular-nums">
                          {f.home_score} – {f.away_score}
                        </span>
                        {f.leg > 1 && (
                          <p className="text-[9px] text-gray-600 font-medium">Leg {f.leg}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                        <PlayerAvatar player={away} index={aIdx} size="sm" />
                        <span className={`text-sm truncate ${awayWon ? 'font-bold text-white' : 'text-gray-400'}`}>{away?.name}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Players ── */}
        <section>
          <SectionHeader icon="👥" title={`Players (${players.length})`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-900/80 border border-gray-800/60 rounded-xl px-3 py-2.5 backdrop-blur-sm">
                <PlayerAvatar player={p} index={i} size="sm" badge />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-white">{p.name}</p>
                  {p.group_number && (
                    <p className="text-[10px] text-gray-500">Group {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[p.group_number - 1]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-gray-700 pb-4">
          ⚽ Powered by <span className="text-indigo-500 font-medium">eFootball Tournaments</span>
        </p>
      </main>
    </div>
  )
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="flex-1 h-px bg-gray-800 ml-2" />
    </div>
  )
}
