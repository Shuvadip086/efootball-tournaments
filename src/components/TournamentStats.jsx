/**
 * Season-end Tournament Statistics — modeled after the UEFA
 * Champions League "season in numbers" panel (big headline numbers
 * up top, leader-board style stat cards below). Pure read-only.
 *
 *   ┌─ THE SEASON IN NUMBERS ─────────────────────┐
 *   │  72 GOALS   ·   24 MATCHES   ·   3.00 / MATCH│
 *   └──────────────────────────────────────────────┘
 *   ┌────────┬────────┬────────┐
 *   │ ⚽ Top │ 🛡 Best │ 🧤 Clean │
 *   │  Scorer│ Defence│  Sheets │
 *   ├────────┼────────┼────────┤
 *   │ 💥 Big │ 🔥 High│ 📅 Days  │
 *   │  Win   │ Match  │ Played  │
 *   └────────┴────────┴────────┘
 */
import { getPlayerTheme } from '../utils/playerIcons'

export default function TournamentStats({ tournament, fixtures, players, stats }) {
  if (!stats || stats.totalMatches === 0) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 text-center text-gray-500 text-sm">
        Not enough match data to build season statistics yet.
      </div>
    )
  }
  const playerName = (id) => players?.find(p => p.id === id)?.name ?? '—'
  const playerIdxs = Object.fromEntries((players ?? []).map((p, i) => [p.id, i]))

  return (
    <section className="rounded-3xl overflow-hidden border border-indigo-900/30 shadow-2xl shadow-indigo-950/40"
             style={{
               background: 'linear-gradient(180deg, #0a0c18 0%, #050816 100%)',
             }}>
      {/* Header */}
      <div className="relative px-5 sm:px-8 py-6 border-b border-indigo-900/30 overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[600px] h-32 bg-indigo-500/15 blur-3xl pointer-events-none" />
        <p className="relative text-center text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">
          The Season in Numbers
        </p>
        <h2 className="relative text-center text-2xl sm:text-3xl font-black mt-2 match-day-text">
          {tournament?.name ?? 'Tournament'} · Statistics
        </h2>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-indigo-900/20">
        <Headline label="Total Goals"        value={stats.totalGoals} accent="emerald" icon="⚽" />
        <Headline label="Matches Played"     value={stats.totalMatches} accent="indigo" icon="📊" />
        <Headline label="Goals per Match"    value={stats.avgGoalsPerMatch.toFixed(2)} accent="amber" icon="🎯" />
        <Headline label="Players"            value={stats.totalPlayers} accent="sky" icon="👥" />
      </div>

      {/* Leader cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 sm:p-6 bg-gray-950/60">
        {stats.topScorers?.[0] && (
          <LeaderCard
            title="Top Scorer"
            icon="⚽"
            accent="amber"
            player={stats.topScorers[0]}
            playerIdxs={playerIdxs}
            primary={`${stats.topScorers[0].gf} goals`}
            secondary={`${stats.topScorers[0].matches} matches · ${stats.topScorers[0].avgGF.toFixed(2)} per game`}
          />
        )}
        {stats.bestAttack && (
          <LeaderCard
            title="Best Attack"
            icon="🔥"
            accent="rose"
            player={stats.bestAttack}
            playerIdxs={playerIdxs}
            primary={`${stats.bestAttack.gf} scored`}
            secondary={`${stats.bestAttack.avgGF.toFixed(2)} goals per game`}
          />
        )}
        {stats.bestDefence && (
          <LeaderCard
            title="Best Defence"
            icon="🛡"
            accent="emerald"
            player={stats.bestDefence}
            playerIdxs={playerIdxs}
            primary={`${stats.bestDefence.ga} conceded`}
            secondary={`${stats.bestDefence.avgGA.toFixed(2)} per game · ${stats.bestDefence.cleanSheets} clean sheets`}
          />
        )}
        {stats.cleanSheets && stats.cleanSheets.cleanSheets > 0 && (
          <LeaderCard
            title="Most Clean Sheets"
            icon="🧤"
            accent="sky"
            player={stats.cleanSheets}
            playerIdxs={playerIdxs}
            primary={`${stats.cleanSheets.cleanSheets} clean sheet${stats.cleanSheets.cleanSheets === 1 ? '' : 's'}`}
            secondary={`${stats.cleanSheets.matches} matches played`}
          />
        )}
        {stats.mostWins && (
          <LeaderCard
            title="Most Wins"
            icon="🏆"
            accent="amber"
            player={stats.mostWins}
            playerIdxs={playerIdxs}
            primary={`${stats.mostWins.won} wins`}
            secondary={`${stats.mostWins.points} pts · ${stats.mostWins.matches} matches`}
          />
        )}
        {stats.mostMatches && (
          <LeaderCard
            title="Most Active"
            icon="🏃"
            accent="indigo"
            player={stats.mostMatches}
            playerIdxs={playerIdxs}
            primary={`${stats.mostMatches.matches} matches`}
            secondary={`${stats.mostMatches.gf} goals · ${stats.mostMatches.points} pts`}
          />
        )}
      </div>

      {/* Match highlights */}
      {(stats.highestScoring || stats.biggestWin) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-indigo-900/20">
          {stats.highestScoring && (
            <MatchHighlight
              title="Highest-Scoring Match"
              icon="🎆"
              accent="amber"
              fixture={stats.highestScoring.fixture}
              tagline={`${stats.highestScoring.total} goal${stats.highestScoring.total === 1 ? '' : 's'} combined`}
              playerName={playerName}
            />
          )}
          {stats.biggestWin && (
            <MatchHighlight
              title="Biggest Win"
              icon="💥"
              accent="rose"
              fixture={stats.biggestWin.fixture}
              tagline={`Winning by ${stats.biggestWin.margin} goal${stats.biggestWin.margin === 1 ? '' : 's'}`}
              playerName={playerName}
            />
          )}
        </div>
      )}

      {/* Footer ribbon */}
      <div className="bg-black/60 border-t border-indigo-900/40 px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-indigo-400/80">Final Standings</p>
        <p className="text-[11px] text-gray-400">
          {stats.durationDays ? `${stats.durationDays} day${stats.durationDays === 1 ? '' : 's'} of competition` : 'eFootball Tournaments'}
          {tournament?.format && (
            <span className="ml-2 text-gray-500">
              · Format: <span className="text-gray-300">{
                tournament.format === 'group_knockout' ? 'Group + Knockout' :
                tournament.format === 'knockout'      ? 'Knockout'         :
                                                        'League'
              }</span>
            </span>
          )}
        </p>
      </div>
    </section>
  )
}

function Headline({ label, value, accent = 'indigo', icon }) {
  const accentText =
    accent === 'emerald' ? 'text-emerald-300' :
    accent === 'amber'   ? 'text-amber-300' :
    accent === 'sky'     ? 'text-sky-300' :
                           'text-indigo-300'
  return (
    <div className="bg-gray-950/80 px-4 py-5 text-center">
      <p className="text-2xl opacity-70 mb-1">{icon}</p>
      <p className={`text-3xl sm:text-4xl font-black tabular-nums ${accentText} drop-shadow`}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function LeaderCard({ title, icon, accent, player, primary, secondary, playerIdxs }) {
  const theme = getPlayerTheme(playerIdxs?.[player?.id] ?? 0)
  const borderColor =
    accent === 'amber'   ? 'border-amber-700/40 from-amber-950/30' :
    accent === 'emerald' ? 'border-emerald-700/40 from-emerald-950/30' :
    accent === 'sky'     ? 'border-sky-700/40 from-sky-950/30' :
    accent === 'rose'    ? 'border-rose-700/40 from-rose-950/30' :
                           'border-indigo-700/40 from-indigo-950/30'
  const headlineColor =
    accent === 'amber'   ? 'text-amber-300' :
    accent === 'emerald' ? 'text-emerald-300' :
    accent === 'sky'     ? 'text-sky-300' :
    accent === 'rose'    ? 'text-rose-300' :
                           'text-indigo-300'

  return (
    <div className={`relative rounded-2xl border ${borderColor} bg-gradient-to-br to-gray-900 p-4 overflow-hidden`}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-400">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full ${theme.bg} flex items-center justify-center text-base font-black text-white shadow-inner shrink-0`}>
            {(player?.name ?? '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white truncate">{player?.name}</p>
            <p className={`text-xl font-black tabular-nums ${headlineColor} leading-tight mt-0.5`}>{primary}</p>
            <p className="text-[10px] text-gray-500 truncate">{secondary}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MatchHighlight({ title, icon, accent, fixture, tagline, playerName }) {
  const headlineColor =
    accent === 'amber'   ? 'text-amber-300' :
    accent === 'rose'    ? 'text-rose-300' :
                           'text-indigo-300'
  return (
    <div className="bg-gray-950/80 px-5 sm:px-6 py-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-400">{title}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-white text-sm truncate flex-1 text-right">{playerName(fixture.home_player_id)}</span>
        <span className={`text-2xl font-black tabular-nums ${headlineColor} px-3`}>
          {fixture.home_score} – {fixture.away_score}
        </span>
        <span className="font-bold text-white text-sm truncate flex-1">{playerName(fixture.away_player_id)}</span>
      </div>
      <p className={`text-[11px] text-center mt-2 ${headlineColor}`}>{tagline}</p>
    </div>
  )
}
