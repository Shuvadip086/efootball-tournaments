/**
 * Export tournament data as a multi-sheet Excel-compatible file.
 * Uses HTML <table> with .xls extension — opens cleanly in Excel,
 * Google Sheets, Numbers, and LibreOffice. No external dependency.
 *
 * Sheets included:
 *   1. Summary       — tournament meta
 *   2. Players       — id, name, group
 *   3. Standings     — derived (correct) per-player record
 *   4. Top Scorers   — goal totals
 *   5. Fixtures      — every match with scores + status
 */
import { computeStandings } from './computeStandings'
import { calculateTopScorers } from './topScorers'

const esc = (v) => {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function tableHtml(name, headers, rows) {
  const head = headers.map(h => `<th>${esc(h)}</th>`).join('')
  const body = rows
    .map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')
  return `
    <table border="1">
      <caption><b>${esc(name)}</b></caption>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <br/><br/>
  `
}

export function exportTournamentToExcel(tournament, players, fixtures) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  // ─ Summary ─
  const summary = tableHtml('Summary',
    ['Field', 'Value'],
    [
      ['Tournament',  tournament.name],
      ['Description', tournament.description ?? ''],
      ['Format',      tournament.format],
      ['Home & Away', tournament.home_away ? 'Yes' : 'No'],
      ['Status',      tournament.status],
      ['Players',     players.length],
      ['Matches',     fixtures.length],
      ['Completed',   fixtures.filter(f => f.status === 'completed').length],
      ['Exported',    new Date().toLocaleString()],
    ]
  )

  // ─ Players ─
  const playersTable = tableHtml('Players',
    ['#', 'Name', 'Group'],
    players.map((p, i) => [
      i + 1,
      p.name,
      p.group_number ? `Group ${GROUP_LETTERS[p.group_number - 1]}` : '—',
    ])
  )

  // ─ Standings (derived) ─
  const phase = tournament.format === 'group_knockout' ? 'group' : undefined
  const standings = computeStandings(fixtures, players, { phase })
    .sort((a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for
    )
  const standingsTable = tableHtml('Standings',
    ['#', 'Player', 'Group', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'],
    standings.map((s, i) => {
      const p = playerMap[s.player_id]
      return [
        i + 1,
        p?.name ?? '—',
        p?.group_number ? GROUP_LETTERS[p.group_number - 1] : '—',
        s.played, s.won, s.drawn, s.lost,
        s.goals_for, s.goals_against,
        s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference,
        s.points,
      ]
    })
  )

  // ─ Top Scorers ─
  const scorers = calculateTopScorers(fixtures, players)
  const scorersTable = tableHtml('Top Scorers',
    ['#', 'Player', 'Matches', 'Goals', 'Conceded', 'Wins', 'Avg / Match'],
    scorers.map((s, i) => [
      i + 1,
      s.player.name,
      s.matches, s.goals, s.conceded, s.wins, s.avg,
    ])
  )

  // ─ Fixtures ─
  const fxRows = fixtures
    .slice()
    .sort((a, b) =>
      (a.phase ?? '').localeCompare(b.phase ?? '') ||
      (a.round ?? 0) - (b.round ?? 0) ||
      (a.leg ?? 0) - (b.leg ?? 0)
    )
    .map(f => {
      const h = playerMap[f.home_player_id]?.name ?? '—'
      const a = playerMap[f.away_player_id]?.name ?? '—'
      const score = f.status === 'completed'
        ? `${f.home_score} – ${f.away_score}`
        : 'Pending'
      return [
        f.phase ?? 'regular',
        f.round ?? '',
        f.leg ?? '',
        h, a, score, f.status,
        f.played_at ? new Date(f.played_at).toLocaleString() : '',
      ]
    })
  const fxTable = tableHtml('Fixtures',
    ['Phase', 'Round', 'Leg', 'Home', 'Away', 'Score', 'Status', 'Played At'],
    fxRows
  )

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th, td { padding: 6px 10px; border: 1px solid #999; }
          th { background: #4338ca; color: #fff; }
          caption { text-align: left; font-size: 16px; padding: 8px 0; }
        </style>
      </head>
      <body>
        <h1>${esc(tournament.name)} — Tournament Export</h1>
        ${summary}
        ${playersTable}
        ${standingsTable}
        ${scorersTable}
        ${fxTable}
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safeName = (tournament.name || 'tournament').replace(/[^\w\d-]+/g, '_')
  const stamp    = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `${safeName}_${stamp}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
