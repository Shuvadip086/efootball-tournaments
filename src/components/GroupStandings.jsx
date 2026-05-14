const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function GroupTable({ groupLetter, players, standings }) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  // sort by points → GD → GF
  const sorted = [...standings].sort((a, b) =>
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for
  )

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {groupLetter}
        </div>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Group {groupLetter}
        </h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-900 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 w-6">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">W</th>
              <th className="px-3 py-2 text-center">D</th>
              <th className="px-3 py-2 text-center">L</th>
              <th className="px-3 py-2 text-center">GD</th>
              <th className="px-3 py-2 text-center font-bold text-white">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((s, i) => {
              const player = playerMap[s.player_id]
              const advancing = i < 2  // top 2 advance
              return (
                <tr
                  key={s.id}
                  className={`transition-colors ${
                    advancing ? 'bg-indigo-950/30 hover:bg-indigo-950/50' : 'bg-gray-950 hover:bg-gray-900'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-bold ${advancing ? 'text-indigo-400' : 'text-gray-600'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-white">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${advancing ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                        {(player?.name ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="truncate">{player?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-400">{s.played}</td>
                  <td className="px-3 py-2.5 text-center text-green-400">{s.won}</td>
                  <td className="px-3 py-2.5 text-center text-gray-500">{s.drawn}</td>
                  <td className="px-3 py-2.5 text-center text-red-400">{s.lost}</td>
                  <td className="px-3 py-2.5 text-center text-gray-300">
                    {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-white">{s.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function GroupStandings({ standings, players, numGroups }) {
  if (!standings?.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No standings yet.</p>
  }

  const groups = []
  for (let g = 1; g <= numGroups; g++) {
    const groupPlayers = players.filter(p => p.group_number === g)
    const groupStandings = standings.filter(s =>
      groupPlayers.some(p => p.id === s.player_id)
    )
    if (groupPlayers.length > 0) {
      groups.push({ g, players: groupPlayers, standings: groupStandings })
    }
  }

  return (
    <div>
      <p className="text-xs text-indigo-400 bg-indigo-950/30 border border-indigo-800 rounded-lg px-3 py-2 mb-5">
        🏆 Top 2 players from each group (highlighted in blue) advance to the knockout stage.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map(({ g, players: gPlayers, standings: gStandings }) => (
          <GroupTable
            key={g}
            groupLetter={GROUP_LETTERS[g - 1]}
            players={gPlayers}
            standings={gStandings}
          />
        ))}
      </div>
    </div>
  )
}
