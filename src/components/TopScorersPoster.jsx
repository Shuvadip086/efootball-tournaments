import { useState, useEffect, useRef } from 'react'
import { getPlayerPhoto, setPlayerPhoto, clearPlayerPhoto, readFileAsDataUrl } from '../utils/posterPhotos'

/**
 * Top-Scorers Poster — Golden Boot trio (1st, 2nd, 3rd).
 * Shows each scorer with their photo, matches played, total goals,
 * and goals-per-match average. Photos use the same shared
 * per-player storage as the champion / runner-up posters.
 */
export default function TopScorersPoster({ tournament, topScorers, allowUpload = true }) {
  if (!topScorers || topScorers.length === 0) return null
  const trio = topScorers.slice(0, 3)
  const podium = [trio[1], trio[0], trio[2]].filter(Boolean) // 2nd-1st-3rd visual order

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl shadow-amber-900/40 border border-amber-600/30"
        style={{
          backgroundColor: '#0c0a18',
          backgroundImage: `
            radial-gradient(ellipse 80% 40% at 50% 0%, rgba(251,191,36,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 100% 60% at 50% 100%, rgba(16,185,129,0.25) 0%, transparent 60%),
            linear-gradient(180deg, #0c0a18 0%, #02010a 100%)
          `,
        }}
      >
        <div className="h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.7)]" />

        <div className="text-center pt-7 pb-3 px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-400/80">eFootball Tournaments</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black"
             style={{
               background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #fde68a 100%)',
               WebkitBackgroundClip: 'text',
               WebkitTextFillColor: 'transparent',
             }}>
            ⚽ Golden Boot Race
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mt-1">{tournament?.name ?? 'Tournament Top Scorers'}</p>
        </div>

        {/* Podium */}
        <div className="px-4 sm:px-6 pt-2 pb-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end">
            {podium.map((p, i) => {
              // Map back to actual rank (1, 2, 3) — podium order is [2nd, 1st, 3rd]
              const realRank = p === trio[0] ? 1 : p === trio[1] ? 2 : 3
              return (
                <ScorerSlot
                  key={p.id}
                  player={p}
                  rank={realRank}
                  tournamentId={tournament?.id}
                  allowUpload={allowUpload}
                />
              )
            })}
          </div>
        </div>

        {/* Table — covers everyone in case more than 3 */}
        {topScorers.length > 3 && (
          <div className="border-t border-amber-900/30 px-4 sm:px-6 py-4 bg-black/30">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/70 mb-2">Also in the Race</p>
            <div className="space-y-1">
              {topScorers.slice(3, 8).map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 bg-gray-900/40 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-bold text-gray-500 w-5">{idx + 4}</span>
                  <span className="text-sm text-white flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{p.matches} MP</span>
                  <span className="text-sm font-black text-amber-300 tabular-nums w-8 text-right">{p.gf}</span>
                  <span className="text-[10px] text-gray-500 tabular-nums w-10 text-right">{p.avgGF.toFixed(2)}/m</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-amber-900/30 px-6 py-3 text-center bg-black/40">
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400/70">Top Scorers</p>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.7)]" />
      </div>
    </div>
  )
}

// One podium slot — photo + name + 3 stats
function ScorerSlot({ player, rank, tournamentId, allowUpload }) {
  const [photo, setPhoto] = useState(() => getPlayerPhoto(tournamentId, player.id))
  const fileRef = useRef(null)
  useEffect(() => { setPhoto(getPlayerPhoto(tournamentId, player.id)) }, [tournamentId, player.id])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPlayerPhoto(tournamentId, player.id, dataUrl)
      setPhoto(dataUrl)
    } catch (err) { alert(err.message) }
  }
  const clearPhoto = () => {
    if (!confirm(`Remove ${player.name}'s photo?`)) return
    clearPlayerPhoto(tournamentId, player.id); setPhoto(null)
  }

  // Style by rank
  const isFirst = rank === 1
  const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
  const podiumH = rank === 1 ? 'pt-0' : 'pt-6'
  const ring    = rank === 1 ? 'border-amber-400 shadow-amber-700/60'
                : rank === 2 ? 'border-slate-300 shadow-slate-700/60'
                :              'border-amber-700 shadow-amber-900/60'
  const nameGradient = rank === 1
    ? 'linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #fde68a 100%)'
    : rank === 2
    ? 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 45%, #f1f5f9 100%)'
    : 'linear-gradient(135deg, #fde2bb 0%, #c2410c 45%, #fde2bb 100%)'

  return (
    <div className={`flex flex-col items-center ${podiumH}`}>
      <span className="text-2xl mb-1">{medal}</span>
      <div className={`relative ${isFirst ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24'} rounded-2xl overflow-hidden bg-gray-900 border-2 ${ring} shadow-xl`}>
        {photo ? (
          <img src={photo} alt={player.name} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-40">👤</span>
          </div>
        )}
        <div className="absolute top-0 right-0 bg-gray-900/80 text-[10px] font-black text-white px-1.5 py-0.5 rounded-bl-md jersey-num">{rank}</div>
      </div>

      <p
        className={`mt-2 ${isFirst ? 'text-base sm:text-lg' : 'text-sm'} font-black leading-tight text-center truncate w-full px-1`}
        style={{
          background: nameGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
        title={player.name}
      >
        {player.name}
      </p>

      <div className="mt-2 w-full grid grid-cols-3 gap-1">
        <PodiumStat label="MP" value={player.matches} />
        <PodiumStat label="G"  value={player.gf} highlight />
        <PodiumStat label="A"  value={player.avgGF.toFixed(1)} />
      </div>

      {allowUpload && (
        <div className="mt-2 flex gap-1">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[10px] bg-amber-500/90 hover:bg-amber-400 text-gray-900 font-bold px-2 py-0.5 rounded transition-colors"
          >
            📸 {photo ? 'Change' : 'Upload'}
          </button>
          {photo && (
            <button
              onClick={clearPhoto}
              className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-2 py-0.5 rounded transition-colors"
              title="Remove photo"
            >✕</button>
          )}
        </div>
      )}
    </div>
  )
}

function PodiumStat({ label, value, highlight }) {
  return (
    <div className="bg-black/40 border border-amber-700/30 rounded px-1 py-1 text-center">
      <p className="text-[8px] uppercase tracking-wider text-amber-400/70 leading-tight">{label}</p>
      <p className={`text-xs font-black tabular-nums ${highlight ? 'text-amber-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}
