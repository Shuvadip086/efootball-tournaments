import { useState, useEffect, useRef } from 'react'
import { getPlayerPhoto, setPlayerPhoto, clearPlayerPhoto, readFileAsDataUrl } from '../utils/posterPhotos'

/**
 * Runner-Up Poster — silver/slate theme, identical shape to the
 * champion poster but tuned for second place. Inline-only.
 */
export default function RunnerUpPoster({ tournament, runnerUp, runnerUpStats, allowUpload = true }) {
  const tid      = tournament?.id
  const playerId = runnerUp?.id
  const [photo, setPhoto] = useState(() => getPlayerPhoto(tid, playerId))
  const fileRef = useRef(null)
  useEffect(() => { setPhoto(getPlayerPhoto(tid, playerId)) }, [tid, playerId])

  if (!runnerUp) return null

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPlayerPhoto(tid, playerId, dataUrl)
      setPhoto(dataUrl)
    } catch (err) { alert(err.message) }
  }
  const clearPhoto = () => {
    if (!confirm('Remove the runner-up photo?')) return
    clearPlayerPhoto(tid, playerId); setPhoto(null)
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/60 border border-slate-400/40"
        style={{
          backgroundColor: '#0a0c14',
          backgroundImage: `
            radial-gradient(ellipse 80% 40% at 50% 0%, rgba(203,213,225,0.20) 0%, transparent 60%),
            radial-gradient(ellipse 100% 60% at 50% 100%, rgba(99,102,241,0.25) 0%, transparent 60%),
            linear-gradient(180deg, #0a0c14 0%, #02030a 100%)
          `,
        }}
      >
        <div className="h-1.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent shadow-[0_0_20px_rgba(203,213,225,0.6)]" />
        <div className="text-center pt-7 pb-3 px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-300/80">eFootball Tournaments</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-gray-400">{tournament?.name ?? 'Tournament'}</p>
        </div>

        <div className="text-center text-6xl drop-shadow-[0_0_20px_rgba(203,213,225,0.5)] my-1">🥈</div>

        <div className="text-center px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-slate-300/80">— Runner-Up —</p>
        </div>

        <div className="px-8 pt-4 pb-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700/30 via-gray-900 to-indigo-950 border-2 border-slate-400/40 shadow-2xl shadow-slate-900/40">
            {photo ? (
              <img src={photo} alt={runnerUp.name} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-5xl mb-2 opacity-50">👤</span>
                <p className="text-xs text-gray-400 font-semibold">No photo yet</p>
                {allowUpload && <p className="text-[10px] text-gray-500 mt-1">Tap "Upload Photo" below</p>}
              </div>
            )}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-slate-300" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-slate-300" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-slate-300" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-slate-300" />
          </div>
        </div>

        <div className="text-center px-6 pb-2">
          <p
            className="text-3xl sm:text-4xl font-black leading-tight"
            style={{
              background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 45%, #f1f5f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 4px 24px rgba(203,213,225,0.3)',
            }}
          >
            {runnerUp.name}
          </p>
        </div>

        {runnerUpStats && runnerUpStats.matches > 0 && (
          <div className="px-6 pb-6 mt-2 grid grid-cols-3 gap-2">
            <SilverStat label="Matches" value={runnerUpStats.matches} />
            <SilverStat label="Goals"   value={runnerUpStats.gf} />
            <SilverStat label="Conceded" value={runnerUpStats.ga} />
          </div>
        )}

        <div className="border-t border-slate-700/40 px-6 py-3 text-center bg-black/40">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-300/70">Final · Second Place</p>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent shadow-[0_0_20px_rgba(203,213,225,0.5)]" />
      </div>

      {allowUpload && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="bg-slate-300 hover:bg-slate-200 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm shadow-lg shadow-slate-900/40 transition-colors">
            📸 {photo ? 'Change Photo' : 'Upload Photo'}
          </button>
          {photo && (
            <button onClick={clearPhoto} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SilverStat({ label, value }) {
  return (
    <div className="bg-black/30 border border-slate-700/30 rounded-xl px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-300/70">{label}</p>
      <p className="text-base font-black text-white tabular-nums mt-0.5">{value}</p>
    </div>
  )
}
