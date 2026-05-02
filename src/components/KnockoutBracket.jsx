import React from 'react'

const LINE = '#4f46e5'
const CARD_H = 90
const MIN_GAP = 20

function slotH(rIdx) {
  return (CARD_H + MIN_GAP) * Math.pow(2, rIdx)
}

function roundLabel(rIdx, total) {
  const fromEnd = total - 1 - rIdx
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-Finals'
  if (fromEnd === 2) return 'Quarter-Finals'
  return `Round ${rIdx + 1}`
}

function MatchCard({ fixture, playerMap, onEnterScore }) {
  const home = playerMap[fixture.home_player_id]
  const away = playerMap[fixture.away_player_id]
  const done = fixture.status === 'completed'
  const homeWon = done && fixture.home_score > fixture.away_score
  const awayWon = done && fixture.away_score > fixture.home_score

  return (
    <div className="w-44 rounded-xl border border-gray-700 bg-gray-900 overflow-hidden shadow-lg shrink-0">
      {[
        { player: home, score: fixture.home_score, won: homeWon },
        { player: away, score: fixture.away_score, won: awayWon },
      ].map(({ player, score, won }, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-3 py-2.5 ${i === 0 ? 'border-b border-gray-700' : ''} ${won ? 'bg-indigo-900/30' : ''}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${won ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
              {(player?.name ?? '?')[0].toUpperCase()}
            </div>
            <span className={`text-xs truncate ${won ? 'font-bold text-white' : 'text-gray-300'}`}>
              {player?.name ?? 'TBD'}
            </span>
          </div>
          <span className={`text-sm font-bold ml-1 shrink-0 tabular-nums ${won ? 'text-indigo-400' : 'text-gray-600'}`}>
            {score ?? '—'}
          </span>
        </div>
      ))}
      {!done && onEnterScore && (
        <button
          onClick={() => onEnterScore(fixture)}
          className="w-full text-[11px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-600 py-1.5 border-t border-gray-700 transition-colors"
        >
          + Enter Score
        </button>
      )}
    </div>
  )
}

export default function KnockoutBracket({ fixtures, players, onEnterScore }) {
  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))
  const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b)

  if (!fixtures.length) {
    return <p className="text-gray-400 text-sm py-4 text-center">No bracket generated yet.</p>
  }

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex min-w-max pt-2">
        {rounds.map((round, rIdx) => {
          const roundFixtures = fixtures
            .filter(f => f.round === round)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          const sh = slotH(rIdx)
          const isLast = rIdx === rounds.length - 1
          const numPairs = Math.floor(roundFixtures.length / 2)

          return (
            <React.Fragment key={round}>
              {/* ── Round column ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase text-gray-400 text-center mb-3 tracking-wider w-44">
                  {roundLabel(rIdx, rounds.length)}
                </p>
                {roundFixtures.map((f) => (
                  <div
                    key={f.id}
                    style={{ height: sh, display: 'flex', alignItems: 'center' }}
                  >
                    <MatchCard
                      fixture={f}
                      playerMap={playerMap}
                      onEnterScore={onEnterScore}
                    />
                  </div>
                ))}
              </div>

              {/* ── Connector column ── */}
              {!isLast && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* spacer to match round label */}
                  <div style={{ height: 32 }} />

                  {/* One connector group per pair of matches */}
                  {Array.from({ length: numPairs }).map((_, pIdx) => (
                    <div
                      key={pIdx}
                      style={{
                        height: sh * 2,
                        width: 56,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      {/* ']' bracket shape centered in the 2×slot space */}
                      <div style={{ height: sh, width: 24, display: 'flex', flexDirection: 'column' }}>
                        {/* top arm */}
                        <div style={{
                          flex: 1,
                          borderRight: `2px solid ${LINE}`,
                          borderBottom: `2px solid ${LINE}`,
                          borderBottomRightRadius: 5,
                        }} />
                        {/* bottom arm */}
                        <div style={{
                          flex: 1,
                          borderRight: `2px solid ${LINE}`,
                          borderTop: `2px solid ${LINE}`,
                          borderTopRightRadius: 5,
                        }} />
                      </div>

                      {/* Horizontal line from midpoint of ']' to next round */}
                      <div style={{
                        position: 'absolute',
                        top: sh - 1,     // midpoint of the 2-slot space = vertical center of ']'
                        left: 24,
                        right: 0,
                        height: 2,
                        backgroundColor: LINE,
                      }} />
                    </div>
                  ))}

                  {/* Lone match with no pair (bye) — just a straight line */}
                  {roundFixtures.length % 2 === 1 && (
                    <div style={{ height: sh, display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: 56, borderTop: `2px solid ${LINE}` }} />
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
