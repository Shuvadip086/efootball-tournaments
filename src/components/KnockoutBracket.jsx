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

// ── Single-leg match card ──────────────────────────────────────────
function SingleCard({ fixture: f, playerMap, playerIndex, onEnterScore }) {
  const home = playerMap[f.home_player_id]
  const away = playerMap[f.away_player_id]
  const done = f.status === 'completed'
  const homeWon = done && f.home_score > f.away_score
  const awayWon = done && f.away_score > f.home_score
  const hiHome = getPlayerTheme(playerIndex[f.home_player_id] ?? 0)
  const hiAway = getPlayerTheme(playerIndex[f.away_player_id] ?? 1)

  return (
    <div className="rounded-xl border border-gray-700/80 bg-gray-900/90 overflow-hidden shadow-lg"
         style={{ width: CARD_W }}>
      {[
        { player: home, score: f.home_score, won: homeWon, theme: hiHome },
        { player: away, score: f.away_score, won: awayWon, theme: hiAway },
      ].map(({ player, score, won, theme }, i) => (
        <div key={i}
          className={`flex items-center justify-between px-2.5 py-2 ${i === 0 ? 'border-b border-gray-700/60' : ''} ${won ? 'bg-indigo-950/50' : ''}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-5 h-5 rounded-full ${theme.bg} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <span className={`text-xs truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
              {player?.name ?? 'TBD'}
            </span>
          </div>
          <span className={`text-sm font-bold ml-1 tabular-nums shrink-0 ${won ? 'text-indigo-400' : 'text-gray-600'}`}>
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
    </div>
  )
}

// ── Two-leg match card ─────────────────────────────────────────────
function TwoLegCard({ leg1, leg2, playerMap, playerIndex, onEnterScore }) {
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
    <div className="rounded-xl border border-gray-700/80 bg-gray-900/90 overflow-hidden shadow-lg"
         style={{ width: CARD_W }}>
      {/* Header row: player names */}
      {[
        { player: playerA, theme: themeA, won: aWon },
        { player: playerB, theme: themeB, won: bWon },
      ].map(({ player, theme, won }, i) => (
        <div key={i}
          className={`flex items-center justify-between px-2.5 py-1.5 ${i === 0 ? 'border-b border-gray-700/40' : ''} ${won ? 'bg-indigo-950/50' : ''}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-4 h-4 rounded-full ${theme.bg} flex items-center justify-center text-[8px] font-bold text-white shrink-0`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <span className={`text-[11px] truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
              {player?.name ?? 'TBD'}
            </span>
          </div>
          {/* Leg scores */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            <span className="text-[10px] text-gray-500">L1</span>
            <span className={`text-xs font-bold tabular-nums w-4 text-center ${i===0?(leg1.home_score>leg1.away_score?'text-white':'text-gray-500'):(leg1.away_score>leg1.home_score?'text-white':'text-gray-500')}`}>
              {i===0 ? (leg1.home_score ?? '—') : (leg1.away_score ?? '—')}
            </span>
            {leg2 && <>
              <span className="text-[10px] text-gray-600">·</span>
              <span className="text-[10px] text-gray-500">L2</span>
              <span className={`text-xs font-bold tabular-nums w-4 text-center ${i===0?(leg2.away_score>leg2.home_score?'text-white':'text-gray-500'):(leg2.home_score>leg2.away_score?'text-white':'text-gray-500')}`}>
                {i===0 ? (leg2.away_score ?? '—') : (leg2.home_score ?? '—')}
              </span>
            </>}
          </div>
        </div>
      ))}
      {/* Aggregate row */}
      {agg && (
        <div className="flex items-center justify-center gap-3 px-2.5 py-1 bg-gray-800/60 border-t border-gray-700/40">
          <span className={`text-xs font-bold tabular-nums ${aWon ? 'text-indigo-400' : 'text-gray-400'}`}>{agg.aGoals}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Agg</span>
          <span className={`text-xs font-bold tabular-nums ${bWon ? 'text-indigo-400' : 'text-gray-400'}`}>{agg.bGoals}</span>
        </div>
      )}
      {/* Enter score buttons */}
      {onEnterScore && (
        <div className={`flex border-t border-gray-700/60 ${!agg && !leg2 ? '' : ''}`}>
          {leg1.status !== 'completed' && (
            <button onClick={() => onEnterScore(leg1)}
              className="flex-1 text-[10px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-600/80 py-1.5 transition-colors">
              Leg 1 Score
            </button>
          )}
          {leg2 && leg2.status !== 'completed' && (
            <button onClick={() => onEnterScore(leg2)}
              className="flex-1 text-[10px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-600/80 py-1.5 border-l border-gray-700/60 transition-colors">
              Leg 2 Score
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main bracket component ─────────────────────────────────────────
export default function KnockoutBracket({ fixtures, players, onEnterScore }) {
  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))
  const playerIndex = Object.fromEntries((players ?? []).map((p, i) => [p.id, i]))

  const matchups = buildMatchups(fixtures ?? [])
  const rounds = [...new Set(matchups.map(m => m.round))].sort((a, b) => a - b)
  const hasTwoLeg = matchups.some(m => m.type === 'two-leg')

  if (!matchups.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No bracket generated yet.</p>
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-2 px-2">
      <div className="flex min-w-max pt-2 gap-0">
        {rounds.map((round, rIdx) => {
          const roundMatchups = matchups
            .filter(m => m.round === round)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

          const sh = slotH(rIdx, hasTwoLeg)
          const cardH = hasTwoLeg ? CARD_H_2L : CARD_H
          const isLast = rIdx === rounds.length - 1
          const numPairs = Math.floor(roundMatchups.length / 2)

          return (
            <React.Fragment key={round}>
              {/* ── Round column ── */}
              <div style={{ width: CARD_W }}>
                {/* Round label */}
                <p className="text-[11px] font-semibold uppercase text-gray-400 text-center mb-3 tracking-wider">
                  {roundLabel(rIdx, rounds.length)}
                </p>
                {roundMatchups.map((m) => (
                  <div key={m.type === 'single' ? m.f.id : m.leg1.id}
                       style={{ height: sh, display: 'flex', alignItems: 'center' }}>
                    {m.type === 'single' ? (
                      <SingleCard
                        fixture={m.f}
                        playerMap={playerMap}
                        playerIndex={playerIndex}
                        onEnterScore={onEnterScore}
                      />
                    ) : (
                      <TwoLegCard
                        leg1={m.leg1}
                        leg2={m.leg2}
                        playerMap={playerMap}
                        playerIndex={playerIndex}
                        onEnterScore={onEnterScore}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* ── Connector column ── */}
              {!isLast && (
                <div style={{ width: COL_GAP, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 32 }} /> {/* align with round label */}

                  {Array.from({ length: numPairs }).map((_, pIdx) => (
                    <div key={pIdx} style={{ height: sh * 2, width: COL_GAP, position: 'relative' }}>
                      {/* ']' bracket — top arm + bottom arm */}
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
                      {/* Horizontal lead to next card */}
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

                  {/* Bye — straight line */}
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
  )
}
