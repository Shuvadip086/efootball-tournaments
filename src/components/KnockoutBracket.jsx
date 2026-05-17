import React from 'react'
import { getPlayerTheme } from '../utils/playerIcons'

const LINE_COLOR = '#6366f1'
const CARD_W = 176   // px
const CARD_H = 86    // single-leg card height
const CARD_H_2L = 118 // two-leg card height
const GAP = 16
const COL_GAP = 52   // connector column width

function slotH(rIdx, twoLeg) {
  const ch = twoLeg ? CARD_H_2L : CARD_H
  return (ch + GAP) * Math.pow(2, rIdx)
}

function roundLabel(rIdx, total) {
  const fromEnd = total - 1 - rIdx
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-Finals'
  if (fromEnd === 2) return 'Quarter-Finals'
  if (fromEnd === 3) return 'Round of 16'
  return `Round ${rIdx + 1}`
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

// ── Winner extraction helpers ──────────────────────────────────────
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

// ── Single-leg match card ──────────────────────────────────────────
function SingleCard({ fixture: f, playerMap, playerIndex, onEnterScore, big }) {
  const home = playerMap[f.home_player_id]
  const away = playerMap[f.away_player_id]
  const done = f.status === 'completed'
  const homeWon = done && f.home_score > f.away_score
  const awayWon = done && f.away_score > f.home_score
  const hiHome = getPlayerTheme(playerIndex[f.home_player_id] ?? 0)
  const hiAway = getPlayerTheme(playerIndex[f.away_player_id] ?? 1)

  return (
    <div className={`rounded-xl border ${big ? 'border-amber-500/60 bg-gradient-to-br from-gray-900 via-amber-950/30 to-gray-900 shadow-2xl shadow-amber-900/30' : 'border-gray-700/80 bg-gray-900/90 shadow-lg'} overflow-hidden relative`}
         style={{ width: big ? CARD_W * 1.5 : CARD_W }}>
      {[
        { player: home, score: f.home_score, won: homeWon, theme: hiHome },
        { player: away, score: f.away_score, won: awayWon, theme: hiAway },
      ].map(({ player, score, won, theme }, i) => (
        <div key={i}
          className={`flex items-center justify-between px-2.5 ${big ? 'py-3' : 'py-2'} ${i === 0 ? 'border-b border-gray-700/60' : ''} ${won ? (big ? 'bg-amber-900/30' : 'bg-indigo-950/50') : ''}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`${big ? 'w-7 h-7 text-xs' : 'w-5 h-5 text-[9px]'} rounded-full ${theme.bg} flex items-center justify-center font-bold text-white shrink-0`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <span className={`${big ? 'text-base' : 'text-xs'} truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
              {player?.name ?? 'TBD'}
            </span>
            {big && won && <span className="text-amber-400 text-base ml-1">👑</span>}
          </div>
          <span className={`${big ? 'text-2xl' : 'text-sm'} font-bold ml-1 tabular-nums shrink-0 ${won ? (big ? 'text-amber-300' : 'text-indigo-400') : 'text-gray-600'}`}>
            {score ?? '—'}
          </span>
        </div>
      ))}
      {!done && onEnterScore && (
        <button onClick={() => onEnterScore(f)}
          className="w-full text-[10px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-600/80 py-1.5 border-t border-gray-700/60 transition-colors">
          + Enter Score
        </button>
      )}
      {done && onEnterScore && (
        <button onClick={() => onEnterScore(f)}
          className="absolute top-1.5 right-1.5 text-[10px] text-gray-500 hover:text-white hover:bg-indigo-600/80 rounded px-1.5 py-0.5 transition-colors"
          title="Edit score">
          ✏️
        </button>
      )}
    </div>
  )
}

// ── Two-leg match card ─────────────────────────────────────────────
function TwoLegCard({ leg1, leg2, playerMap, playerIndex, onEnterScore, big }) {
  const agg = getAggregate(leg1, leg2)
  const aId = leg1.home_player_id
  const bId = leg1.away_player_id
  const playerA = playerMap[aId]
  const playerB = playerMap[bId]
  const themeA = getPlayerTheme(playerIndex[aId] ?? 0)
  const themeB = getPlayerTheme(playerIndex[bId] ?? 1)
  const aWon = agg && agg.aGoals > agg.bGoals
  const bWon = agg && agg.bGoals > agg.aGoals

  return (
    <div className={`rounded-xl border ${big ? 'border-amber-500/60 bg-gradient-to-br from-gray-900 via-amber-950/30 to-gray-900 shadow-2xl shadow-amber-900/30' : 'border-gray-700/80 bg-gray-900/90 shadow-lg'} overflow-hidden relative`}
         style={{ width: big ? CARD_W * 1.6 : CARD_W }}>
      {/* Header row: player names */}
      {[
        { player: playerA, theme: themeA, won: aWon, isA: true },
        { player: playerB, theme: themeB, won: bWon, isA: false },
      ].map(({ player, theme, won, isA }, i) => (
        <div key={i}
          className={`flex items-center justify-between px-2.5 ${big ? 'py-2' : 'py-1.5'} ${i === 0 ? 'border-b border-gray-700/40' : ''} ${won ? (big ? 'bg-amber-900/30' : 'bg-indigo-950/50') : ''}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`${big ? 'w-6 h-6 text-[10px]' : 'w-4 h-4 text-[8px]'} rounded-full ${theme.bg} flex items-center justify-center font-bold text-white shrink-0`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <span className={`${big ? 'text-sm' : 'text-[11px]'} truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
              {player?.name ?? 'TBD'}
            </span>
            {big && won && <span className="text-amber-400 ml-0.5">👑</span>}
          </div>
          {/* Leg scores */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            <span className="text-[10px] text-gray-500">L1</span>
            <span className={`text-xs font-bold tabular-nums w-4 text-center ${isA?(leg1.home_score>leg1.away_score?'text-white':'text-gray-500'):(leg1.away_score>leg1.home_score?'text-white':'text-gray-500')}`}>
              {isA ? (leg1.home_score ?? '—') : (leg1.away_score ?? '—')}
            </span>
            {leg2 && <>
              <span className="text-[10px] text-gray-600">·</span>
              <span className="text-[10px] text-gray-500">L2</span>
              <span className={`text-xs font-bold tabular-nums w-4 text-center ${isA?(leg2.away_score>leg2.home_score?'text-white':'text-gray-500'):(leg2.home_score>leg2.away_score?'text-white':'text-gray-500')}`}>
                {isA ? (leg2.away_score ?? '—') : (leg2.home_score ?? '—')}
              </span>
            </>}
          </div>
        </div>
      ))}
      {/* Aggregate row */}
      {agg && (
        <div className={`flex items-center justify-center gap-3 px-2.5 py-1 ${big ? 'bg-amber-950/40' : 'bg-gray-800/60'} border-t border-gray-700/40`}>
          <span className={`${big ? 'text-base' : 'text-xs'} font-bold tabular-nums ${aWon ? (big ? 'text-amber-300' : 'text-indigo-400') : 'text-gray-400'}`}>{agg.aGoals}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Agg</span>
          <span className={`${big ? 'text-base' : 'text-xs'} font-bold tabular-nums ${bWon ? (big ? 'text-amber-300' : 'text-indigo-400') : 'text-gray-400'}`}>{agg.bGoals}</span>
        </div>
      )}
      {/* Enter / Edit score buttons */}
      {onEnterScore && (
        <div className="flex border-t border-gray-700/60">
          <button onClick={() => onEnterScore(leg1)}
            className={`flex-1 text-[10px] font-semibold py-1.5 transition-colors ${leg1.status === 'completed' ? 'text-gray-500 hover:text-white hover:bg-indigo-600/60' : 'text-indigo-400 hover:text-white hover:bg-indigo-600/80'}`}>
            {leg1.status === 'completed' ? '✏️ Edit L1' : 'Leg 1 Score'}
          </button>
          {leg2 && (
            <button onClick={() => onEnterScore(leg2)}
              className={`flex-1 text-[10px] font-semibold py-1.5 border-l border-gray-700/60 transition-colors ${leg2.status === 'completed' ? 'text-gray-500 hover:text-white hover:bg-indigo-600/60' : 'text-indigo-400 hover:text-white hover:bg-indigo-600/80'}`}>
              {leg2.status === 'completed' ? '✏️ Edit L2' : 'Leg 2 Score'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Render either single or two-leg card consistently
function MatchCard({ matchup: m, ...rest }) {
  if (!m) return null
  return m.type === 'single'
    ? <SingleCard fixture={m.f} {...rest} />
    : <TwoLegCard leg1={m.leg1} leg2={m.leg2} {...rest} />
}

// ── Championship Finale (SF + Final + Trophy) ──────────────────────
function ChampionshipFinale({ sfMatchups, finalMatchup, playerMap, playerIndex, onEnterScore, onCrownChampion, tournament }) {
  const sf1 = sfMatchups[0]
  const sf2 = sfMatchups[1]
  const championId = matchupWinnerId(finalMatchup)
  const runnerUpId = matchupLoserId(finalMatchup)
  const champion = championId ? playerMap[championId] : null
  const runnerUp = runnerUpId ? playerMap[runnerUpId] : null

  return (
    <div className="relative mt-8 mb-4 rounded-3xl overflow-hidden border border-amber-900/40 bg-gradient-to-b from-gray-950 via-indigo-950/30 to-amber-950/20">
      {/* Decorative glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.6)]" />

      <div className="relative px-4 sm:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/70">The Road to Glory</p>
          <h2 className="text-2xl sm:text-3xl font-black mt-1 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent drop-shadow-lg">
            Championship Finale
          </h2>
        </div>

        {/* Semi-finals row */}
        {sfMatchups.length > 0 && (
          <div className="mb-2">
            <p className="text-center text-[11px] font-bold uppercase tracking-wider text-indigo-300 mb-3">Semi-Finals</p>
            <div className="flex items-start justify-center gap-4 sm:gap-12 flex-wrap">
              {sf1 && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500 mb-1">SF 1</span>
                  <MatchCard matchup={sf1} playerMap={playerMap} playerIndex={playerIndex} onEnterScore={onEnterScore} />
                </div>
              )}
              {sf2 && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500 mb-1">SF 2</span>
                  <MatchCard matchup={sf2} playerMap={playerMap} playerIndex={playerIndex} onEnterScore={onEnterScore} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connector arrows down to final */}
        {sfMatchups.length > 0 && (
          <div className="flex justify-center my-3">
            <div className="relative w-[260px] sm:w-[420px] h-10">
              <div className="absolute left-0 top-0 w-1/2 h-full border-r-2 border-b-2 border-amber-700/50 rounded-br-2xl" />
              <div className="absolute right-0 top-0 w-1/2 h-full border-l-2 border-b-2 border-amber-700/50 rounded-bl-2xl" />
              <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1 w-1 h-3 bg-amber-700/50" />
            </div>
          </div>
        )}

        {/* Final */}
        {finalMatchup && (
          <div className="flex flex-col items-center">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300 mb-3">⚔️ Grand Final ⚔️</p>
            <MatchCard matchup={finalMatchup} playerMap={playerMap} playerIndex={playerIndex} onEnterScore={onEnterScore} big />
          </div>
        )}

        {/* Trophy + Champion */}
        <div className="flex flex-col items-center mt-8">
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
                  📸 Upload Photo & Generate Champion Poster
                </button>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-500 italic">Awaiting the final result…</p>
          )}
        </div>

        {tournament?.name && (
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-gray-600 mt-8">
            {tournament.name}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main bracket component ─────────────────────────────────────────
export default function KnockoutBracket({ fixtures, players, onEnterScore, onCrownChampion, tournament }) {
  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))
  const playerIndex = Object.fromEntries((players ?? []).map((p, i) => [p.id, i]))

  const matchups = buildMatchups(fixtures ?? [])
  const rounds = [...new Set(matchups.map(m => m.round))].sort((a, b) => a - b)
  const hasTwoLeg = matchups.some(m => m.type === 'two-leg')

  if (!matchups.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No bracket generated yet.</p>
  }

  // Split off SF + Final for the championship finale layout.
  // The final round must have exactly 1 matchup, and SF round (if any) has up to 2.
  const lastRound = rounds[rounds.length - 1]
  const finalMatchups = matchups.filter(m => m.round === lastRound)
  const showFinale = finalMatchups.length === 1   // confirmed final round

  let finalMatchup = null
  let sfMatchups = []
  let preRounds = rounds

  if (showFinale) {
    finalMatchup = finalMatchups[0]
    preRounds = rounds.slice(0, -1)              // everything before final
    if (preRounds.length >= 1) {
      const sfRound = preRounds[preRounds.length - 1]
      const sf = matchups.filter(m => m.round === sfRound)
      // SF round should have exactly 2 matchups to qualify as a semifinal
      if (sf.length === 2) {
        sfMatchups = sf
        preRounds = preRounds.slice(0, -1)        // exclude SF from horizontal bracket
      }
    }
  }

  const preBracketHasContent = preRounds.length > 0

  return (
    <div>
      {/* Horizontal bracket — QFs and earlier rounds */}
      {preBracketHasContent && (
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex min-w-max pt-2 gap-0">
            {preRounds.map((round, rIdx) => {
              const roundMatchups = matchups
                .filter(m => m.round === round)
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

              const sh = slotH(rIdx, hasTwoLeg)
              const isLast = rIdx === preRounds.length - 1 && !showFinale
              const numPairs = Math.floor(roundMatchups.length / 2)

              return (
                <React.Fragment key={round}>
                  {/* ── Round column ── */}
                  <div style={{ width: CARD_W }}>
                    <p className="text-[11px] font-semibold uppercase text-gray-400 text-center mb-3 tracking-wider">
                      {roundLabel(rIdx, rounds.length)}
                    </p>
                    {roundMatchups.map((m) => (
                      <div key={m.type === 'single' ? m.f.id : m.leg1.id}
                           style={{ height: sh, display: 'flex', alignItems: 'center' }}>
                        <MatchCard matchup={m} playerMap={playerMap} playerIndex={playerIndex} onEnterScore={onEnterScore} />
                      </div>
                    ))}
                  </div>

                  {/* ── Connector column ── */}
                  {!isLast && (
                    <div style={{ width: COL_GAP, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ height: 32 }} />

                      {Array.from({ length: numPairs }).map((_, pIdx) => (
                        <div key={pIdx} style={{ height: sh * 2, width: COL_GAP, position: 'relative' }}>
                          <div style={{ height: sh, width: COL_GAP - 8, display: 'flex', flexDirection: 'column' }}>
                            <div style={{
                              flex: 1,
                              borderRight: `2px solid ${LINE_COLOR}`,
                              borderBottom: `2px solid ${LINE_COLOR}`,
                              borderBottomRightRadius: 6,
                            }} />
                            <div style={{
                              flex: 1,
                              borderRight: `2px solid ${LINE_COLOR}`,
                              borderTop: `2px solid ${LINE_COLOR}`,
                              borderTopRightRadius: 6,
                            }} />
                          </div>
                          <div style={{
                            position: 'absolute',
                            top: sh - 1,
                            left: COL_GAP - 8,
                            right: 0,
                            height: 2,
                            backgroundColor: LINE_COLOR,
                          }} />
                        </div>
                      ))}

                      {roundMatchups.length % 2 === 1 && (
                        <div style={{ height: sh, display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: COL_GAP, borderTop: `2px solid ${LINE_COLOR}` }} />
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* Championship finale layout (SF + F + Trophy) */}
      {showFinale && (
        <ChampionshipFinale
          sfMatchups={sfMatchups}
          finalMatchup={finalMatchup}
          playerMap={playerMap}
          playerIndex={playerIndex}
          onEnterScore={onEnterScore}
          onCrownChampion={onCrownChampion}
          tournament={tournament}
        />
      )}
    </div>
  )
}
