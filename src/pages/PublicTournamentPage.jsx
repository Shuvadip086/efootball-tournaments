import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { useRealtimeStandings } from '../hooks/useRealtimeStandings'
import LeagueTable from '../components/LeagueTable'
import KnockoutBracket from '../components/KnockoutBracket'
import GroupStandings from '../components/GroupStandings'
import PlayerAvatar from '../components/PlayerAvatar'

const FORMAT_ICON  = { league: '📊', knockout: '🥊', group_knockout: '🏆' }
const FORMAT_LABEL = { league: 'Round Robin', knockout: 'Single Elimination', group_knockout: 'Group + Knockout' }
const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export default function PublicTournamentPage() {
  const { slug } = useParams()
  const { tournament, players, fixtures, loading, error } = useTournament(slug, { bySlug: true })
  const realtimeStandings = useRealtimeStandings(tournament?.id)
  const standings = realtimeStandings.length ? realtimeStandings : []

  const groupFixtures      = fixtures.filter(f => f.phase === 'group')
  const knockoutFixtures   = fixtures.filter(f => f.phase === 'knockout')
  const regularFixtures    = fixtures.filter(f => f.phase === 'regular' || !f.phase)
  const completedFixtures  = fixtures.filter(f => f.status === 'completed')
  const pendingFixtures    = fixtures.filter(f => f.status === 'pending')
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

          {/* Quick stats row */}
          {fixtures.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{completedFixtures.length}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Played</p>
              </div>
              <div className="w-px h-8 bg-gray-700" />
              <div className="text-center">
                <p className="text-2xl font-black text-indigo-400">{pendingFixtures.length}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Remaining</p>
              </div>
              <div className="w-px h-8 bg-gray-700" />
              <div className="text-center">
                <p className="text-2xl font-black text-white">{fixtures.length}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
              </div>
            </div>
          )}
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
            <div className="-mx-4 px-4 overflow-x-auto">
              <div className="min-w-[500px]">
                <KnockoutBracket fixtures={regularFixtures.length ? regularFixtures : fixtures} players={players} />
              </div>
            </div>
          </section>
        )}

        {tournament.format === 'group_knockout' && (
          <>
            {groupFixtures.length > 0 && (
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

        {/* ── Fixtures at a glance ── */}
        {fixtures.length > 0 && (
          <section>
            <SectionHeader icon="📅" title="Fixtures" />
            <FixturesAtAGlance
              tournament={tournament}
              fixtures={fixtures}
              groupFixtures={groupFixtures}
              knockoutFixtures={knockoutFixtures}
              regularFixtures={regularFixtures}
              players={players}
              playerMap={playerMap}
            />
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
                    <p className="text-[10px] text-gray-500">Group {GROUP_LETTERS[p.group_number - 1]}</p>
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

// ── Pair fixtures by pair_id (home & away) ───────────────────────
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

// ── Fixtures at a glance ──────────────────────────────────────────
function FixturesAtAGlance({ tournament, fixtures, groupFixtures, knockoutFixtures, regularFixtures, players, playerMap }) {
  const [filterPlayer, setFilterPlayer] = useState('all')

  const matchesFilter = (f) =>
    filterPlayer === 'all' ||
    f.home_player_id === filterPlayer ||
    f.away_player_id === filterPlayer

  const homeAway = tournament.home_away

  // Render a fixture list (single or paired)
  function renderFixtures(fxList) {
    const filtered = fxList.filter(matchesFilter)
    if (!filtered.length) return <p className="text-xs text-gray-600 py-3 text-center">No matches for this player.</p>
    if (homeAway) {
      // Pair up, then filter pairs that include the selected player
      const allPairs = pairByPairId(fxList)
      const filteredPairs = allPairs.filter(({ leg1, leg2 }) =>
        matchesFilter(leg1 ?? {}) || matchesFilter(leg2 ?? {})
      )
      if (!filteredPairs.length) return <p className="text-xs text-gray-600 py-3 text-center">No matches for this player.</p>
      return (
        <div className="space-y-2">
          {filteredPairs.map(({ leg1, leg2 }) => (
            <PublicTwoLegRow key={leg1?.id ?? leg2?.id} leg1={leg1} leg2={leg2} players={players} playerMap={playerMap} />
          ))}
        </div>
      )
    }
    return (
      <div className="space-y-1.5">
        {filtered.map(f => <PublicFixtureRow key={f.id} fixture={f} players={players} playerMap={playerMap} />)}
      </div>
    )
  }

  // Player filter dropdown
  const Dropdown = (
    <select
      value={filterPlayer}
      onChange={e => setFilterPlayer(e.target.value)}
      className="text-sm bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
    >
      <option value="all">👤 All Players</option>
      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )

  if (tournament.format === 'league') {
    const allFixtures = fixtures
    // group by leg1 round (for home_away) or all rounds
    const rounds = homeAway
      ? [...new Set(allFixtures.filter(f => f.leg === 1 || !f.pair_id).map(f => f.round))].sort((a, b) => a - b)
      : [...new Set(allFixtures.map(f => f.round))].sort((a, b) => a - b)

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-500">{fixtures.length} total matches</span>
          {Dropdown}
        </div>
        {homeAway ? (
          renderFixtures(allFixtures)
        ) : (
          <div className="space-y-4">
            {rounds.map(round => {
              const rFix = allFixtures.filter(f => f.round === round).filter(matchesFilter)
              if (!rFix.length) return null
              const allDone = rFix.every(f => f.status === 'completed')
              const anyDone = rFix.some(f => f.status === 'completed')
              return (
                <div key={round}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Round {round}</span>
                    {allDone ? <span className="text-[10px] text-green-400 font-semibold">✓ Complete</span>
                      : anyDone ? <span className="text-[10px] text-indigo-400 font-semibold">In progress</span> : null}
                  </div>
                  <div className="space-y-1.5">
                    {rFix.map(f => <PublicFixtureRow key={f.id} fixture={f} players={players} playerMap={playerMap} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (tournament.format === 'group_knockout') {
    const numGroups = tournament.num_groups ?? 4
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-500">{fixtures.length} total matches</span>
          {Dropdown}
        </div>
        <div className="space-y-6">
          {groupFixtures.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">Group Stage</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: numGroups }, (_, i) => i + 1).map(g => {
                  const gFix = groupFixtures.filter(f => playerMap[f.home_player_id]?.group_number === g)
                  if (!gFix.length) return null
                  const gFiltered = gFix.filter(matchesFilter)
                  const gPairs = homeAway ? pairByPairId(gFix).filter(({ leg1, leg2 }) => matchesFilter(leg1 ?? {}) || matchesFilter(leg2 ?? {})) : null
                  if (filterPlayer !== 'all' && (homeAway ? !gPairs?.length : !gFiltered.length)) return null
                  return (
                    <div key={g} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900">
                        <div className="w-5 h-5 rounded bg-indigo-700 flex items-center justify-center text-[10px] font-black text-white">{GROUP_LETTERS[g - 1]}</div>
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Group {GROUP_LETTERS[g - 1]}</span>
                        <span className="ml-auto text-[10px] text-gray-600">{gFix.filter(f => f.status === 'completed').length}/{gFix.length} played</span>
                      </div>
                      <div className="divide-y divide-gray-800/60">
                        {homeAway
                          ? gPairs.map(({ leg1, leg2 }) => (
                              <PublicTwoLegRow key={leg1?.id ?? leg2?.id} leg1={leg1} leg2={leg2} players={players} playerMap={playerMap} compact />
                            ))
                          : gFiltered.map(f => <PublicFixtureRow key={f.id} fixture={f} players={players} playerMap={playerMap} compact />)
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {knockoutFixtures.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">Knockout Stage</p>
              {(() => {
                const rounds = [...new Set(knockoutFixtures.map(f => f.round))].sort((a, b) => a - b)
                const totalRounds = rounds.length
                const roundNames = ['Final', 'Semi-Final', 'Quarter-Final', 'Round of 16', 'Round of 32']
                return (
                  <div className="space-y-3">
                    {rounds.map((round, idx) => {
                      const rFix = knockoutFixtures.filter(f => f.round === round).filter(matchesFilter)
                      if (!rFix.length && filterPlayer !== 'all') return null
                      const name = roundNames[totalRounds - 1 - idx] ?? `Round ${round}`
                      return (
                        <div key={round}>
                          <p className="text-xs text-gray-500 font-semibold mb-2">{name}</p>
                          <div className="space-y-1.5">
                            {(filterPlayer !== 'all' ? rFix : knockoutFixtures.filter(f => f.round === round))
                              .map(f => <PublicFixtureRow key={f.id} fixture={f} players={players} playerMap={playerMap} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Knockout format
  const allFixtures = regularFixtures.length ? regularFixtures : fixtures
  const rounds = [...new Set(allFixtures.map(f => f.round))].sort((a, b) => a - b)
  const totalRounds = rounds.length
  const roundNames = ['Final', 'Semi-Final', 'Quarter-Final', 'Round of 16', 'Round of 32']
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500">{fixtures.length} total matches</span>
        {Dropdown}
      </div>
      <div className="space-y-4">
        {rounds.map((round, idx) => {
          const rFix = allFixtures.filter(f => f.round === round).filter(matchesFilter)
          if (!rFix.length && filterPlayer !== 'all') return null
          const name = roundNames[totalRounds - 1 - idx] ?? `Round ${round}`
          return (
            <div key={round}>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">{name}</p>
              <div className="space-y-1.5">
                {(filterPlayer !== 'all' ? rFix : allFixtures.filter(f => f.round === round))
                  .map(f => <PublicFixtureRow key={f.id} fixture={f} players={players} playerMap={playerMap} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Two-leg row (home & away) for public page ─────────────────────
function PublicTwoLegRow({ leg1, leg2, players, playerMap, compact }) {
  const ref = leg1 ?? leg2
  if (!ref) return null
  const homeP = playerMap[ref.home_player_id]
  const awayP = playerMap[ref.away_player_id]
  const hIdx  = players.findIndex(p => p.id === ref.home_player_id)
  const aIdx  = players.findIndex(p => p.id === ref.away_player_id)
  const l1Done = leg1?.status === 'completed'
  const l2Done = leg2?.status === 'completed'
  const bothDone = l1Done && l2Done
  const aggHome = (l1Done ? leg1.home_score : 0) + (l2Done ? leg2.away_score : 0)
  const aggAway = (l1Done ? leg1.away_score : 0) + (l2Done ? leg2.home_score : 0)

  return (
    <div className={`rounded-xl border border-gray-800 overflow-hidden ${compact ? '' : 'bg-gray-900/80'}`}>
      {/* Players header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
        <PlayerAvatar player={homeP} index={hIdx} size="xs" />
        <span className="text-xs font-bold text-white truncate flex-1">{homeP?.name}</span>
        <span className="text-[10px] text-gray-600 font-bold shrink-0">vs</span>
        <span className="text-xs font-bold text-white truncate flex-1 text-right">{awayP?.name}</span>
        <PlayerAvatar player={awayP} index={aIdx} size="xs" />
      </div>
      {/* Leg 1 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
        <span className="text-[10px] font-bold text-indigo-400 w-10 shrink-0">Leg 1</span>
        <span className="text-[10px] text-gray-500 flex-1 truncate">🏠 {homeP?.name}</span>
        {l1Done
          ? <span className="text-sm font-black text-indigo-300 tabular-nums">{leg1.home_score} – {leg1.away_score}</span>
          : <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">Pending</span>
        }
      </div>
      {/* Leg 2 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
        <span className="text-[10px] font-bold text-amber-400 w-10 shrink-0">Leg 2</span>
        <span className="text-[10px] text-gray-500 flex-1 truncate">🏠 {awayP?.name}</span>
        {l2Done
          ? <span className="text-sm font-black text-amber-300 tabular-nums">{leg2.home_score} – {leg2.away_score}</span>
          : <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">Pending</span>
        }
      </div>
      {/* Aggregate */}
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-800/30">
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">Agg</span>
        <span className={`text-xs font-black tabular-nums ${bothDone && aggHome > aggAway ? 'text-white' : 'text-gray-500'}`}>
          {l1Done ? leg1.home_score : '?'}{l2Done ? `+${leg2.away_score}` : '+?'}
        </span>
        <span className="text-gray-700 text-[10px]">–</span>
        <span className={`text-xs font-black tabular-nums ${bothDone && aggAway > aggHome ? 'text-white' : 'text-gray-500'}`}>
          {l1Done ? leg1.away_score : '?'}{l2Done ? `+${leg2.home_score}` : '+?'}
        </span>
        {bothDone && (
          <span className="text-[10px] text-green-400 font-semibold ml-1">
            → {aggHome > aggAway ? homeP?.name : aggAway > aggHome ? awayP?.name : 'Draw'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Single public fixture row ─────────────────────────────────────
function PublicFixtureRow({ fixture: f, players, playerMap, compact }) {
  const home = playerMap[f.home_player_id]
  const away = playerMap[f.away_player_id]
  const hIdx = players.findIndex(p => p.id === f.home_player_id)
  const aIdx = players.findIndex(p => p.id === f.away_player_id)
  const done = f.status === 'completed'
  const homeWon = done && f.home_score > f.away_score
  const awayWon = done && f.away_score > f.home_score

  return (
    <div className={`flex items-center gap-2 ${compact ? 'px-3 py-2.5' : 'bg-gray-900/80 border border-gray-800/60 rounded-xl px-3 py-2.5'}`}>
      {/* Home player */}
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className={`text-xs truncate ${homeWon ? 'font-bold text-white' : done ? 'text-gray-400' : 'text-gray-200'}`}>
          {home?.name ?? '—'}
        </span>
        <PlayerAvatar player={home} index={hIdx} size="xs" />
      </div>

      {/* Score / vs */}
      <div className="shrink-0 min-w-[52px] text-center">
        {done ? (
          <span className={`text-sm font-black tabular-nums ${homeWon || awayWon ? 'text-white' : 'text-gray-400'}`}>
            {f.home_score} – {f.away_score}
          </span>
        ) : (
          <span className="text-xs font-bold text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">vs</span>
        )}
        {f.leg > 1 && <p className="text-[9px] text-gray-700">Leg {f.leg}</p>}
      </div>

      {/* Away player */}
      <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
        <PlayerAvatar player={away} index={aIdx} size="xs" />
        <span className={`text-xs truncate ${awayWon ? 'font-bold text-white' : done ? 'text-gray-400' : 'text-gray-200'}`}>
          {away?.name ?? '—'}
        </span>
      </div>

      {/* Status dot */}
      <div className="shrink-0">
        {done
          ? <span className="w-1.5 h-1.5 rounded-full bg-green-500 block" title="Completed" />
          : <span className="w-1.5 h-1.5 rounded-full bg-gray-700 block" title="Pending" />
        }
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="flex-1 h-px bg-gray-800 ml-2" />
    </div>
  )
}
