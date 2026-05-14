import { getPlayerTheme } from '../utils/playerIcons'

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function FixtureRow({ fixture, playerMap, playerIndex, isKnockout }) {
  const home = playerMap[fixture.home_player_id]
  const away = playerMap[fixture.away_player_id]
  const done = fixture.status === 'completed'
  const homeWon = done && fixture.home_score > fixture.away_score
  const awayWon = done && fixture.away_score > fixture.home_score
  const themeH = getPlayerTheme(playerIndex[fixture.home_player_id] ?? 0)
  const themeA = getPlayerTheme(playerIndex[fixture.away_player_id] ?? 1)

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-white/5 last:border-0 ${done ? 'bg-white/5' : ''}`}>
      {/* Leg badge */}
      {fixture.leg > 1 && (
        <span className="text-[9px] bg-gray-700 text-gray-400 rounded px-1 py-0.5 shrink-0 font-semibold">L{fixture.leg}</span>
      )}
      {isKnockout && (
        <span className="text-[9px] bg-amber-900/60 text-amber-400 rounded px-1 py-0.5 shrink-0 font-semibold">KO</span>
      )}

      {/* Home player */}
      <div className={`flex items-center gap-1.5 flex-1 justify-end min-w-0`}>
        <span className={`text-sm truncate ${homeWon ? 'font-bold text-white' : 'text-gray-300'}`}>
          {home?.name ?? 'TBD'}
        </span>
        <div className={`w-5 h-5 rounded-full ${themeH.bg} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
          {(home?.name ?? '?')[0].toUpperCase()}
        </div>
      </div>

      {/* Score */}
      <div className="w-16 shrink-0 text-center">
        {done ? (
          <span className="text-sm font-bold text-white tabular-nums">
            {fixture.home_score} – {fixture.away_score}
          </span>
        ) : (
          <span className="text-xs text-gray-600 font-medium">VS</span>
        )}
      </div>

      {/* Away player */}
      <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
        <div className={`w-5 h-5 rounded-full ${themeA.bg} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
          {(away?.name ?? '?')[0].toUpperCase()}
        </div>
        <span className={`text-sm truncate ${awayWon ? 'font-bold text-white' : 'text-gray-300'}`}>
          {away?.name ?? 'TBD'}
        </span>
      </div>
    </div>
  )
}

export default function ShareableFixtureCard({ tournament, fixtures, players, onClose }) {
  const playerMap   = Object.fromEntries(players.map(p => [p.id, p]))
  const playerIndex = Object.fromEntries(players.map((p, i) => [p.id, i]))

  const groupFixtures    = fixtures.filter(f => f.phase === 'group')
  const knockoutFixtures = fixtures.filter(f => f.phase === 'knockout')
  const regularFixtures  = fixtures.filter(f => f.phase === 'regular' || !f.phase)

  const formatLabel = {
    league: 'Round Robin',
    knockout: 'Knockout',
    group_knockout: 'Group + Knockout',
  }[tournament?.format] ?? tournament?.format

  const formatIcon = {
    league: '📊',
    knockout: '🥊',
    group_knockout: '🏆',
  }[tournament?.format] ?? '⚽'

  // Group-phase: group by group number
  const numGroups = tournament?.num_groups ?? 4

  const renderRound = (roundFixtures, roundNum, label) => (
    <div key={roundNum} className="mb-1">
      <div className="px-4 py-1.5 bg-white/5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      {roundFixtures.map(f => (
        <FixtureRow
          key={f.id}
          fixture={f}
          playerMap={playerMap}
          playerIndex={playerIndex}
          isKnockout={f.phase === 'knockout'}
        />
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        {/* Card */}
        <div className="bg-[#0d1117] border border-gray-700/60 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/60">

          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-gray-900 to-emerald-950 opacity-80" />
            {/* Pitch lines decoration */}
            <div className="absolute inset-0 opacity-10"
                 style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,#fff 39px,#fff 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#fff 39px,#fff 40px)' }} />
            <div className="relative px-5 py-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-2xl shadow-lg">
                {formatIcon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-white text-lg leading-tight truncate">{tournament?.name}</h2>
                <p className="text-gray-400 text-xs mt-0.5">
                  {formatLabel} · {players.length} players
                  {tournament?.home_away && ' · H&A'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                  tournament?.status === 'active'    ? 'bg-green-500/20 text-green-400' :
                  tournament?.status === 'completed' ? 'bg-amber-500/20 text-amber-400' :
                                                       'bg-gray-700 text-gray-400'
                }`}>
                  {tournament?.status === 'active' ? '🟢 LIVE' :
                   tournament?.status === 'completed' ? '🏆 DONE' : '⏳ DRAFT'}
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Fixtures */}
          <div className="overflow-y-auto flex-1">
            {fixtures.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No fixtures generated yet.</p>
            ) : (
              <>
                {/* Group stage */}
                {groupFixtures.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">⚽ Group Stage</span>
                    </div>
                    {Array.from({ length: numGroups }, (_, i) => i + 1).map(g => {
                      const gFix = groupFixtures.filter(f => playerMap[f.home_player_id]?.group_number === g)
                      if (!gFix.length) return null
                      const rounds = [...new Set(gFix.map(f => f.round))].sort((a, b) => a - b)
                      return (
                        <div key={g} className="mb-1">
                          <div className="px-4 py-1 bg-indigo-950/30 flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-indigo-700 flex items-center justify-center text-[9px] font-bold text-white">
                              {GROUP_LETTERS[g - 1]}
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide">Group {GROUP_LETTERS[g - 1]}</span>
                          </div>
                          {rounds.map(r =>
                            renderRound(gFix.filter(f => f.round === r), `g${g}r${r}`, `Matchday ${r}`)
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Knockout stage */}
                {knockoutFixtures.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">🥊 Knockout Stage</span>
                    </div>
                    {[...new Set(knockoutFixtures.map(f => f.round))].sort((a, b) => a - b).map(r => {
                      const total = [...new Set(knockoutFixtures.map(f => f.round))].length
                      const fromEnd = total - ([...new Set(knockoutFixtures.map(f => f.round))].sort((a, b) => a - b).indexOf(r))
                      const lbl = fromEnd === 1 ? 'Final' : fromEnd === 2 ? 'Semi-Finals' : fromEnd === 3 ? 'Quarter-Finals' : `Round ${r}`
                      return renderRound(knockoutFixtures.filter(f => f.round === r), `ko${r}`, lbl)
                    })}
                  </div>
                )}

                {/* Regular fixtures */}
                {regularFixtures.length > 0 && (
                  <div className="mb-2">
                    {[...new Set(regularFixtures.map(f => f.round))].sort((a, b) => a - b).map(r =>
                      renderRound(regularFixtures.filter(f => f.round === r), r, `Round ${r}`)
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-800/60 flex items-center justify-between bg-black/30">
            <span className="text-[10px] text-gray-600">⚽ eFootball Tournaments</span>
            <button onClick={onClose}
              className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
