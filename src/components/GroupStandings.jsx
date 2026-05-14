import PlayerAvatar from './PlayerAvatar'

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function GroupTable({ groupLetter, players, standings, teamsAdvancing = 2 }) {
  // Merge: use real standings row if it exists, otherwise zero-stats placeholder
  const rows = players.map(p => {
    const s = standings.find(s => s.player_id === p.id)
    return s ?? {
      id: `zero-${p.id}`,
      player_id: p.id,
      played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
    }
  })

  // Sort: points → GD → GF; if all zero keep original order
  const sorted = [...rows].sort((a, b) =>
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for
  )

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  // Global player index for avatar colour (passed via player object's _idx if set)
  const getIdx = (playerId) => players.findIndex(p => p.id === playerId)

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
              const advancing = i < teamsAdvancing
              const pIdx = getIdx(s.player_id)
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
                      <PlayerAvatar player={player} index={pIdx} size="xs" />
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

export default function GroupStandings({ standings = [], players, numGroups, teamsAdvancing = 2 }) {
  // Show as long as players are assigned to groups
  const hasGroups = players.some(p => p.group_number)

  if (!hasGroups) {
    return <p className="text-gray-400 text-sm py-4 text-center">No group assignments yet.</p>
  }

  const groups = []
  for (let g = 1; g <= numGroups; g++) {
    const groupPlayers = players.filter(p => p.group_number === g)
    const groupStandings = standings.filter(s =>
      groupPlayers.some(p => p.id === s.player_id)
    )
    if (groupPlayers.length > 0) {
      groups.push({ g, players: groupPlayers, standings: groupStandings, teamsAdvancing })
    }
  }

  return (
    <div>
      <p className="text-xs text-indigo-400 bg-indigo-950/30 border border-indigo-800 rounded-lg px-3 py-2 mb-5">
        🏆 Top {teamsAdvancing} player{teamsAdvancing !== 1 ? 's' : ''} from each group (highlighted in blue) advance to the knockout stage.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map(({ g, players: gPlayers, standings: gStandings, teamsAdvancing: ta }) => (
          <GroupTable
            key={g}
            groupLetter={GROUP_LETTERS[g - 1]}
            players={gPlayers}
            standings={gStandings}
            teamsAdvancing={ta}
          />
        ))}
      </div>
    </div>
  )
}
