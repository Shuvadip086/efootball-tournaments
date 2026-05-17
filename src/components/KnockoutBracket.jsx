import React, { useState, useEffect } from 'react'
import { getPlayerTheme } from '../utils/playerIcons'

// ── Round label decided by match count (not position-from-end) ─────
function roundLabel(matchCount) {
  if (matchCount === 1)  return 'Final'
  if (matchCount === 2)  return 'Semi-Finals'
  if (matchCount === 4)  return 'Quarter-Finals'
  if (matchCount === 8)  return 'Round of 16'
  if (matchCount === 16) return 'Round of 32'
  return `Round of ${matchCount * 2}`
}

// ── Group fixtures into single-leg or two-legged matchups ──────────
function buildMatchups(fixtures) {
  const byPair = {}
  const noPair = []

  fixtures.forEach(f => {
    if (f.pair_id) {
      if (!byPair[f.pair_id]) byPair[f.pair_id] = []
      byPair[f.pair_id].push(f)
    } else {
      noPair.push(f)
    }
  })

  const matchups = noPair.map(f => ({ type: 'single', f, round: f.round, createdAt: f.created_at }))
  Object.values(byPair).forEach(legs => {
    const leg1 = legs.find(l => l.leg === 1) ?? legs[0]
    const leg2 = legs.find(l => l.leg === 2)
    matchups.push({ type: 'two-leg', leg1, leg2, round: leg1.round, createdAt: leg1.created_at })
  })

  return matchups.sort((a, b) => a.round - b.round || new Date(a.createdAt) - new Date(b.createdAt))
}

function getAggregate(leg1, leg2) {
  if (!leg2 || leg1.status !== 'completed' || leg2.status !== 'completed') return null
  const aGoals = (leg1.home_score ?? 0) + (leg2.away_score ?? 0)
  const bGoals = (leg1.away_score ?? 0) + (leg2.home_score ?? 0)
  return { aGoals, bGoals, aId: leg1.home_player_id, bId: leg1.away_player_id }
}

function matchupWinnerId(m) {
  if (m.type === 'single') {
    const f = m.f
    if (f.status !== 'completed') return null
    if (f.home_score > f.away_score) return f.home_player_id
    if (f.away_score > f.home_score) return f.away_player_id
    return null
  }
  const agg = getAggregate(m.leg1, m.leg2)
  if (!agg) return null
  if (agg.aGoals > agg.bGoals) return agg.aId
  if (agg.bGoals > agg.aGoals) return agg.bId
  return null
}

function matchupLoserId(m) {
  const winner = matchupWinnerId(m)
  if (!winner) return null
  if (m.type === 'single') {
    return m.f.home_player_id === winner ? m.f.away_player_id : m.f.home_player_id
  }
  return m.leg1.home_player_id === winner ? m.leg1.away_player_id : m.leg1.home_player_id
}

// ═══════════════════════════════════════════════════════════════════
//   PlayoffCard — the new vertical-layout match card.
//
//   ┌──────────────────────────────────────────────┐
//   │ ⭕ Shuvadip                    [3]  L1  [2] │
//   │ ⭕ Sanjoy                      [1]  L2  [0] │
//   ├──────────────────────────────────────────────┤
//   │             5 ─ AGG ─ 1                      │
//   └──────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════
function PlayoffCard({ matchup: m, playerMap, playerIndex, onSubmitScore, onEnterScore, accent = 'indigo' }) {
  if (!m) return null

  const isFinal = accent === 'final'
  const accentBorder = isFinal
    ? 'border-amber-500/60 shadow-amber-900/40'
    : 'border-indigo-700/50 shadow-indigo-950/40'
  const accentBg = isFinal
    ? 'bg-gradient-to-br from-amber-950/30 via-gray-900/95 to-gray-900'
    : 'bg-gradient-to-br from-gray-900/95 via-gray-900 to-indigo-950/30'

  if (m.type === 'single') {
    return (
      <PlayoffSingleCard
        fixture={m.f}
        playerMap={playerMap}
        playerIndex={playerIndex}
        onSubmitScore={onSubmitScore}
        onEnterScore={onEnterScore}
        isFinal={isFinal}
        accentBorder={accentBorder}
        accentBg={accentBg}
      />
    )
  }
  return (
    <PlayoffTwoLegCard
      leg1={m.leg1}
      leg2={m.leg2}
      playerMap={playerMap}
      playerIndex={playerIndex}
      onSubmitScore={onSubmitScore}
      onEnterScore={onEnterScore}
      isFinal={isFinal}
      accentBorder={accentBorder}
      accentBg={accentBg}
    />
  )
}

// ── Single-leg playoff card ────────────────────────────────────────
function PlayoffSingleCard({ fixture: f, playerMap, playerIndex, onSubmitScore, onEnterScore, isFinal, accentBorder, accentBg }) {
  const home = playerMap[f.home_player_id]
  const away = playerMap[f.away_player_id]
  const done = f.status === 'completed'
  const homeWon = done && f.home_score > f.away_score
  const awayWon = done && f.away_score > f.home_score
  const themeH  = getPlayerTheme(playerIndex[f.home_player_id] ?? 0)
  const themeA  = getPlayerTheme(playerIndex[f.away_player_id] ?? 1)

  const [hi, setHi] = useState(f.home_score ?? '')
  const [ai, setAi] = useState(f.away_score ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setHi(f.home_score ?? '')
    setAi(f.away_score ?? '')
  }, [f.id, f.home_score, f.away_score])

  const inline   = !!onSubmitScore
  const filled   = hi !== '' && ai !== '' && !isNaN(parseInt(hi)) && !isNaN(parseInt(ai))
  const changed  = filled && (parseInt(hi) !== f.home_score || parseInt(ai) !== f.away_score)

  const save = async () => {
    if (!changed) return
    setSaving(true)
    try { await onSubmitScore(f, parseInt(hi), parseInt(ai)) }
    finally { setSaving(false) }
  }

  return (
    <div className={`relative rounded-2xl border-2 ${accentBorder} ${accentBg} shadow-xl overflow-hidden`}>
      {isFinal && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      )}
      <div className="p-3 space-y-2">
        {[
          { player: home, theme: themeH, won: homeWon, val: hi, setVal: setHi, isHome: true },
          { player: away, theme: themeA, won: awayWon, val: ai, setVal: setAi, isHome: false },
        ].map(({ player, theme, won, val, setVal, isHome }, i) => (
          <div key={i}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
              won
                ? (isFinal ? 'bg-amber-900/30 ring-1 ring-amber-500/40' : 'bg-indigo-900/30 ring-1 ring-indigo-500/40')
                : 'bg-gray-800/60'
            }`}>
            <div className={`w-9 h-9 rounded-full ${theme.bg} flex items-center justify-center font-black text-white shrink-0 shadow-inner text-sm`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-tight truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
                {player?.name ?? 'TBD'}
              </p>
              {won && (
                <p className={`text-[10px] uppercase tracking-wider font-bold ${isFinal ? 'text-amber-400' : 'text-indigo-400'}`}>
                  {isFinal ? '👑 Champion' : 'advances'}
                </p>
              )}
            </div>
            {inline ? (
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && changed) save() }}
                onClick={e => e.stopPropagation()}
                disabled={saving}
                placeholder="—"
                className={`w-12 h-10 text-lg font-black tabular-nums text-center bg-gray-900/80 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-400 focus:bg-gray-900 placeholder:text-gray-600 shrink-0 disabled:opacity-50`}
              />
            ) : (
              <span className={`text-xl font-black tabular-nums shrink-0 w-10 text-center ${won ? (isFinal ? 'text-amber-300' : 'text-indigo-300') : 'text-gray-500'}`}>
                {val === '' ? '—' : val}
              </span>
            )}
          </div>
        ))}
      </div>
      {inline && changed && (
        <button
          onClick={save}
          disabled={saving}
          className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 ${
            isFinal
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-gray-900'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white'
          }`}>
          {saving ? 'Saving…' : (done ? '✓ Update Score' : '✓ Save Score')}
        </button>
      )}
      {!inline && !done && onEnterScore && (
        <button onClick={() => onEnterScore(f)}
          className="w-full py-2 text-xs font-semibold text-indigo-400 hover:bg-indigo-600/50 hover:text-white transition-colors border-t border-gray-700/60">
          + Enter Score
        </button>
      )}
      {!inline && done && onEnterScore && (
        <button onClick={() => onEnterScore(f)}
          className="absolute top-2 right-2 text-xs text-gray-500 hover:text-white hover:bg-indigo-600/80 rounded px-1.5 py-0.5 transition-colors">
          ✏️
        </button>
      )}
    </div>
  )
}

// ── Two-leg playoff card ───────────────────────────────────────────
function PlayoffTwoLegCard({ leg1, leg2, playerMap, playerIndex, onSubmitScore, onEnterScore, isFinal, accentBorder, accentBg }) {
  const agg = getAggregate(leg1, leg2)
  const aId = leg1.home_player_id
  const bId = leg1.away_player_id
  const playerA = playerMap[aId]
  const playerB = playerMap[bId]
  const themeA  = getPlayerTheme(playerIndex[aId] ?? 0)
  const themeB  = getPlayerTheme(playerIndex[bId] ?? 1)
  const aWon = agg && agg.aGoals > agg.bGoals
  const bWon = agg && agg.bGoals > agg.aGoals
  const inline = !!onSubmitScore

  const [aL1, setAL1] = useState(leg1.home_score ?? '')
  const [bL1, setBL1] = useState(leg1.away_score ?? '')
  const [aL2, setAL2] = useState(leg2?.away_score ?? '')
  const [bL2, setBL2] = useState(leg2?.home_score ?? '')
  const [savingLeg, setSavingLeg] = useState(null)
  useEffect(() => {
    setAL1(leg1.home_score ?? ''); setBL1(leg1.away_score ?? '')
    setAL2(leg2?.away_score ?? ''); setBL2(leg2?.home_score ?? '')
  }, [leg1.id, leg1.home_score, leg1.away_score, leg2?.id, leg2?.home_score, leg2?.away_score])

  const l1Changed = aL1 !== '' && bL1 !== '' && (parseInt(aL1) !== leg1.home_score || parseInt(bL1) !== leg1.away_score)
  const l2Changed = leg2 && aL2 !== '' && bL2 !== '' && (parseInt(bL2) !== leg2.home_score || parseInt(aL2) !== leg2.away_score)

  const saveLeg = async (legNum) => {
    setSavingLeg(legNum)
    try {
      if (legNum === 1) await onSubmitScore(leg1, parseInt(aL1), parseInt(bL1))
      else if (leg2) await onSubmitScore(leg2, parseInt(bL2), parseInt(aL2))
    } finally { setSavingLeg(null) }
  }

  const ScoreInput = ({ val, setVal, leg }) => inline ? (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') saveLeg(leg) }}
      onClick={e => e.stopPropagation()}
      disabled={savingLeg !== null}
      placeholder="—"
      className="w-10 h-8 text-sm font-bold tabular-nums text-center bg-gray-900/80 border border-gray-700 rounded-md text-white focus:outline-none focus:border-indigo-400 placeholder:text-gray-600 disabled:opacity-50"
    />
  ) : (
    <span className="w-7 inline-block text-center text-sm font-bold tabular-nums text-gray-300">
      {val === '' ? '—' : val}
    </span>
  )

  return (
    <div className={`relative rounded-2xl border-2 ${accentBorder} ${accentBg} shadow-xl overflow-hidden`}>
      {isFinal && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      )}
      <div className="p-3 space-y-2">
        {[
          { player: playerA, theme: themeA, won: aWon, l1V: aL1, l1Set: setAL1, l2V: aL2, l2Set: setAL2 },
          { player: playerB, theme: themeB, won: bWon, l1V: bL1, l1Set: setBL1, l2V: bL2, l2Set: setBL2 },
        ].map(({ player, theme, won, l1V, l1Set, l2V, l2Set }, i) => (
          <div key={i}
            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${
              won
                ? (isFinal ? 'bg-amber-900/30 ring-1 ring-amber-500/40' : 'bg-indigo-900/30 ring-1 ring-indigo-500/40')
                : 'bg-gray-800/60'
            }`}>
            <div className={`w-9 h-9 rounded-full ${theme.bg} flex items-center justify-center font-black text-white shrink-0 shadow-inner text-sm`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-tight truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
                {player?.name ?? 'TBD'}
              </p>
              {won && (
                <p className={`text-[10px] uppercase tracking-wider font-bold ${isFinal ? 'text-amber-400' : 'text-indigo-400'}`}>
                  {isFinal ? '👑 Champion' : 'advances'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">L1</span>
              <ScoreInput val={l1V} setVal={l1Set} leg={1} />
              {leg2 && <>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider ml-1">L2</span>
                <ScoreInput val={l2V} setVal={l2Set} leg={2} />
              </>}
            </div>
          </div>
        ))}
      </div>
      {/* Aggregate */}
      {agg && (
        <div className={`flex items-center justify-center gap-3 py-2 border-t border-gray-700/40 ${isFinal ? 'bg-amber-950/40' : 'bg-indigo-950/30'}`}>
          <span className={`text-base font-black tabular-nums ${aWon ? (isFinal ? 'text-amber-300' : 'text-indigo-300') : 'text-gray-400'}`}>{agg.aGoals}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Aggregate</span>
          <span className={`text-base font-black tabular-nums ${bWon ? (isFinal ? 'text-amber-300' : 'text-indigo-300') : 'text-gray-400'}`}>{agg.bGoals}</span>
        </div>
      )}
      {/* Save buttons */}
      {inline && (l1Changed || l2Changed) && (
        <div className="flex border-t border-gray-700/60">
          {l1Changed && (
            <button
              onClick={() => saveLeg(1)}
              disabled={savingLeg !== null}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 ${
                isFinal ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-gray-900 hover:from-amber-400'
                        : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500'
              }`}>
              {savingLeg === 1 ? 'Saving…' : '✓ Save L1'}
            </button>
          )}
          {l2Changed && (
            <button
              onClick={() => saveLeg(2)}
              disabled={savingLeg !== null}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 ${l1Changed ? 'border-l border-gray-700/60' : ''} ${
                isFinal ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-gray-900 hover:from-amber-400'
                        : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500'
              }`}>
              {savingLeg === 2 ? 'Saving…' : '✓ Save L2'}
            </button>
          )}
        </div>
      )}
      {/* Legacy modal trigger */}
      {!inline && onEnterScore && (
        <div className="flex border-t border-gray-700/60">
          <button onClick={() => onEnterScore(leg1)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${leg1.status === 'completed' ? 'text-gray-500 hover:bg-indigo-600/60 hover:text-white' : 'text-indigo-400 hover:bg-indigo-600/80 hover:text-white'}`}>
            {leg1.status === 'completed' ? '✏️ Edit L1' : 'Leg 1 Score'}
          </button>
          {leg2 && (
            <button onClick={() => onEnterScore(leg2)}
              className={`flex-1 py-2 text-xs font-semibold border-l border-gray-700/60 transition-colors ${leg2.status === 'completed' ? 'text-gray-500 hover:bg-indigo-600/60 hover:text-white' : 'text-indigo-400 hover:bg-indigo-600/80 hover:text-white'}`}>
              {leg2.status === 'completed' ? '✏️ Edit L2' : 'Leg 2 Score'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//   Main bracket — vertical "playoff path" layout.
//
//   ━━━ QUARTER-FINALS ━━━
//   [M1] [M2] [M3] [M4]
//          ↓
//   ━━━ SEMI-FINALS ━━━
//      [M1]  [M2]
//          ↓
//   ━━━ FINAL ━━━
//          [M1]
//          ↓
//          🏆
//      CHAMPION
// ═══════════════════════════════════════════════════════════════════
export default function KnockoutBracket({ fixtures, players, onEnterScore, onSubmitScore, onCrownChampion, tournament }) {
  const playerMap   = Object.fromEntries((players ?? []).map(p => [p.id, p]))
  const playerIndex = Object.fromEntries((players ?? []).map((p, i) => [p.id, i]))

  const matchups = buildMatchups(fixtures ?? [])
  const rounds   = [...new Set(matchups.map(m => m.round))].sort((a, b) => a - b)

  if (!matchups.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No bracket generated yet.</p>
  }

  // The Final is the last round only if it contains exactly 1 match.
  const lastRound       = rounds[rounds.length - 1]
  const lastRoundFx     = matchups.filter(m => m.round === lastRound)
  const hasFinal        = lastRoundFx.length === 1
  const finalMatchup    = hasFinal ? lastRoundFx[0] : null
  const championId      = finalMatchup ? matchupWinnerId(finalMatchup) : null
  const runnerUpId      = finalMatchup ? matchupLoserId(finalMatchup) : null
  const champion        = championId ? playerMap[championId] : null
  const runnerUp        = runnerUpId ? playerMap[runnerUpId] : null

  return (
    <div className="space-y-6">
      {rounds.map((round, rIdx) => {
        const roundMatchups = matchups
          .filter(m => m.round === round)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        const isFinalRound = roundMatchups.length === 1 && rIdx === rounds.length - 1
        const isLastRendered = rIdx === rounds.length - 1
        const label = roundLabel(roundMatchups.length)

        // Grid columns adapt to match count
        const gridCols =
          roundMatchups.length === 1 ? 'grid-cols-1 max-w-md mx-auto'
          : roundMatchups.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
          : roundMatchups.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8'

        return (
          <div key={round}>
            {/* Round divider with title */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex-1 h-px bg-gradient-to-r from-transparent ${isFinalRound ? 'via-amber-500/40 to-amber-500/60' : 'via-indigo-500/30 to-indigo-500/60'}`} />
              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border ${
                isFinalRound
                  ? 'text-amber-300 bg-amber-950/60 border-amber-700/60 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                  : 'text-indigo-300 bg-indigo-950/60 border-indigo-700/50'
              }`}>
                {isFinalRound && '⚔️ '}{label}{isFinalRound && ' ⚔️'}
              </span>
              <div className={`flex-1 h-px bg-gradient-to-l from-transparent ${isFinalRound ? 'via-amber-500/40 to-amber-500/60' : 'via-indigo-500/30 to-indigo-500/60'}`} />
            </div>

            {/* Match cards grid */}
            <div className={`grid gap-3 ${gridCols}`}>
              {roundMatchups.map(m => (
                <PlayoffCard
                  key={m.type === 'single' ? m.f.id : m.leg1.id}
                  matchup={m}
                  playerMap={playerMap}
                  playerIndex={playerIndex}
                  onSubmitScore={onSubmitScore}
                  onEnterScore={onEnterScore}
                  accent={isFinalRound ? 'final' : 'indigo'}
                />
              ))}
            </div>

            {/* Arrow down to next round */}
            {!isLastRendered && (
              <div className="flex justify-center my-4">
                <div className="relative flex flex-col items-center">
                  <div className="w-px h-6 bg-gradient-to-b from-indigo-500/60 to-transparent" />
                  <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
                  <div className="w-px h-6 bg-gradient-to-t from-indigo-500/60 to-transparent" />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Trophy + Champion footer (only when there's a Final round) */}
      {hasFinal && (
        <div className="mt-8 pt-6 relative">
          {/* Glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col items-center">
            <div className="text-7xl trophy-shine drop-shadow-[0_0_25px_rgba(251,191,36,0.6)]">🏆</div>
            {champion ? (
              <>
                <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-amber-400/80">Champion</p>
                <p className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">
                  {champion.name}
                </p>
                {runnerUp && (
                  <p className="mt-1 text-xs text-gray-400">Runner-up: <span className="text-gray-200">{runnerUp.name}</span></p>
                )}
                {onCrownChampion && (
                  <button
                    onClick={() => onCrownChampion(champion, runnerUp)}
                    className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-900 font-black px-6 py-3 rounded-xl text-sm shadow-2xl shadow-amber-900/50 transition-all hover:-translate-y-0.5"
                  >
                    📸 Upload Photo &amp; Generate Champion Poster
                  </button>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-500 italic">Awaiting the final result…</p>
            )}
            {tournament?.name && (
              <p className="text-center text-[10px] uppercase tracking-[0.3em] text-gray-600 mt-8">
                {tournament.name}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
