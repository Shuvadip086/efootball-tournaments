import PlayerAvatar from './PlayerAvatar'
import { calculateTopScorers } from '../utils/topScorers'

export default function TopScorers({ fixtures, players, limit = 10 }) {
  const all     = calculateTopScorers(fixtures, players)
  const scorers = all.slice(0, limit)

  if (!scorers.length) {
    return (
      <div className="text-center py-8 rounded-2xl border border-gray-800 bg-gray-900/40">
        <span className="text-3xl block mb-1">🥅</span>
        <p className="text-gray-400 text-sm">No goals scored yet.</p>
      </div>
    )
  }

  const top3 = scorers.slice(0, 3)
  const rest = scorers.slice(3)
  const MEDALS = ['🥇', '🥈', '🥉']
  const PODIUM_HEIGHTS  = ['h-24', 'h-16', 'h-12']
  const PODIUM_COLORS   = [
    'from-yellow-400 to-amber-500',
    'from-gray-300 to-gray-500',
    'from-orange-400 to-amber-700',
  ]
  // Order for podium row: 2nd, 1st, 3rd (so 1st is centred)
  const podiumOrder = [
    top3[1] ? { ...top3[1], rank: 2 } : null,
    top3[0] ? { ...top3[0], rank: 1 } : null,
    top3[2] ? { ...top3[2], rank: 3 } : null,
  ].filter(Boolean)

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gradient-to-br from-emerald-950/40 via-gray-950 to-indigo-950/40 stadium-bg">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-gray-800/80 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg trophy-shine">🏆</span>
          <h3 className="font-black text-white uppercase tracking-wider text-sm">Golden Boot Race</h3>
        </div>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Top Scorers</span>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="relative px-4 pt-6 pb-4 goal-net">
          <div className="flex items-end justify-center gap-3 sm:gap-6">
            {podiumOrder.map((s, i) => {
              const idx = players.findIndex(p => p.id === s.player.id)
              const heightCls = PODIUM_HEIGHTS[s.rank - 1]
              const gradient  = PODIUM_COLORS[s.rank - 1]
              return (
                <div key={s.player.id} className="flex flex-col items-center flex-1 max-w-[110px]">
                  {/* Avatar + medal */}
                  <div className="relative mb-2">
                    {s.rank === 1 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl trophy-shine">👑</span>}
                    <PlayerAvatar player={s.player} index={idx} size={s.rank === 1 ? 'lg' : 'md'} badge />
                    <span className="absolute -bottom-1 -right-1 text-base">{MEDALS[s.rank - 1]}</span>
                  </div>
                  {/* Name */}
                  <p className="text-xs font-bold text-white truncate w-full text-center mb-1">{s.player.name}</p>
                  {/* Goals */}
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`scoreboard-digit ${s.rank === 1 ? 'text-2xl' : 'text-xl'} text-white`}>{s.goals}</span>
                    <span className="text-[9px] text-gray-500 uppercase">goals</span>
                  </div>
                  {/* Podium block */}
                  <div className={`w-full ${heightCls} rounded-t-lg bg-gradient-to-t ${gradient} relative overflow-hidden flex items-start justify-center pt-1.5`}>
                    <span className="jersey-num text-white text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">{s.rank}</span>
                    {/* shine overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div className="border-t border-gray-800/60">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-gray-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 w-8 text-left">#</th>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-center">MP</th>
                <th className="px-3 py-2 text-center">⚽</th>
                <th className="px-3 py-2 text-center text-gray-400">Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {rest.map((s, i) => {
                const idx = players.findIndex(p => p.id === s.player.id)
                return (
                  <tr key={s.player.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold text-gray-600">{i + 4}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar player={s.player} index={idx} size="xs" />
                        <span className="text-white font-medium truncate">{s.player.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-400 tabular-nums">{s.matches}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="scoreboard-digit text-base text-white">{s.goals}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-500 text-xs tabular-nums">{s.avg}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer caption */}
      <div className="px-4 py-2 bg-black/30 border-t border-gray-800/60">
        <p className="text-[10px] text-gray-600 text-center">
          ⚽ Goals counted from completed matches · {all.length} player{all.length !== 1 ? 's' : ''} on the scoresheet
        </p>
      </div>
    </div>
  )
}
