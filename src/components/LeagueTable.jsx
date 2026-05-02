export default function LeagueTable({ standings, players }) {
  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))

  if (!standings?.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No standings yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
          <tr>
            <th className="px-3 py-3 w-8">#</th>
            <th className="px-3 py-3">Player</th>
            <th className="px-3 py-3 text-center">P</th>
            <th className="px-3 py-3 text-center">W</th>
            <th className="px-3 py-3 text-center">D</th>
            <th className="px-3 py-3 text-center">L</th>
            <th className="px-3 py-3 text-center">GF</th>
            <th className="px-3 py-3 text-center">GA</th>
            <th className="px-3 py-3 text-center">GD</th>
            <th className="px-3 py-3 text-center font-bold text-white">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {standings.map((s, i) => {
            const player = playerMap[s.player_id] ?? s.players
            return (
              <tr key={s.id} className={`${i === 0 ? 'bg-indigo-950/40' : 'bg-gray-950'} hover:bg-gray-900 transition-colors`}>
                <td className="px-3 py-3 text-gray-500">{i + 1}</td>
                <td className="px-3 py-3 font-medium text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {(player?.name ?? '?')[0].toUpperCase()}
                    </div>
                    {player?.name ?? '—'}
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-gray-300">{s.played}</td>
                <td className="px-3 py-3 text-center text-green-400">{s.won}</td>
                <td className="px-3 py-3 text-center text-gray-400">{s.drawn}</td>
                <td className="px-3 py-3 text-center text-red-400">{s.lost}</td>
                <td className="px-3 py-3 text-center text-gray-300">{s.goals_for}</td>
                <td className="px-3 py-3 text-center text-gray-300">{s.goals_against}</td>
                <td className="px-3 py-3 text-center text-gray-300">
                  {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                </td>
                <td className="px-3 py-3 text-center font-bold text-white">{s.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
