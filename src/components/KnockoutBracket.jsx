export default function KnockoutBracket({ fixtures, players }) {
  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))

  const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b)

  const roundName = (round, totalRounds) => {
    const remaining = totalRounds - round
    if (remaining === 0) return 'Final'
    if (remaining === 1) return 'Semi-Finals'
    if (remaining === 2) return 'Quarter-Finals'
    return `Round ${round}`
  }

  if (!fixtures.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No bracket generated yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max py-4">
        {rounds.map(round => (
          <div key={round} className="flex flex-col gap-4 min-w-[200px]">
            <h3 className="text-xs font-semibold uppercase text-gray-400 text-center mb-2">
              {roundName(round, rounds.length)}
            </h3>
            {fixtures.filter(f => f.round === round).map(f => {
              const home = playerMap[f.home_player_id]
              const away = playerMap[f.away_player_id]
              const homeWon = f.status === 'completed' && f.home_score > f.away_score
              const awayWon = f.status === 'completed' && f.away_score > f.home_score
              return (
                <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {[{ player: home, score: f.home_score, won: homeWon },
                    { player: away, score: f.away_score, won: awayWon }].map(({ player, score, won }, idx) => (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2 ${idx === 0 ? 'border-b border-gray-800' : ''} ${won ? 'bg-indigo-950/50' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {(player?.name ?? '?')[0].toUpperCase()}
                        </div>
                        <span className={`text-sm truncate ${won ? 'text-white font-semibold' : 'text-gray-300'}`}>
                          {player?.name ?? 'TBD'}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ml-2 ${won ? 'text-indigo-400' : 'text-gray-400'}`}>
                        {score ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
