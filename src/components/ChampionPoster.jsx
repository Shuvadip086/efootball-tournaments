import { useState, useEffect, useRef } from 'react'
import { getPlayerPhoto, savePlayerPhoto, removePlayerPhoto, readFileAsResizedDataUrl } from '../utils/posterPhotos'

/**
 * Champion Poster — portrait-style trophy card for the tournament
 * winner. Works in two modes:
 *
 *   mode="modal"  – wraps the poster in a full-screen dim backdrop
 *                   with a close button (default for legacy manage page).
 *   mode="inline" – renders just the poster card as a section block
 *                   for the public live page.
 *
 * Photo is stored per-(tournament, player) so the same headshot
 * appears wherever this player shows up (e.g. champion AND top scorer).
 */
export default function ChampionPoster({
  tournament,
  champion,
  runnerUp,
  finalScore,
  championStats,
  runnerUpStats,
  onClose,
  mode = 'modal',
  allowUpload = true,
}) {
  const inline = mode === 'inline'
  const inner = (
    <ChampionPosterCard
      tournament={tournament}
      champion={champion}
      runnerUp={runnerUp}
      finalScore={finalScore}
      championStats={championStats}
      runnerUpStats={runnerUpStats}
      allowUpload={allowUpload}
    />
  )

  if (inline) return inner

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div className="relative w-full max-w-[420px] my-auto" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 text-white text-lg shadow-xl"
          aria-label="Close"
        >×</button>
        {inner}
        <p className="text-center text-[11px] text-gray-400 mt-3">💡 Screenshot the poster to share it!</p>
      </div>
    </div>
  )
}

// The actual poster card — extracted so it can be reused inline
export function ChampionPosterCard({
  tournament, champion, runnerUp, finalScore,
  championStats, runnerUpStats, allowUpload = true,
}) {
  // Photo lives on the champion player row (synced via Supabase).
  // The local `photo` state is just an optimistic preview so the new
  // image appears instantly without waiting for a refetch.
  const [photo, setPhoto]   = useState(getPlayerPhoto(champion))
  const [saving, setSaving] = useState(false)
  const fileRef             = useRef(null)
  useEffect(() => { setPhoto(getPlayerPhoto(champion)) }, [champion?.id, champion?.photo_data_url])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !champion?.id) return
    setSaving(true)
    try {
      const dataUrl = await readFileAsResizedDataUrl(file)
      await savePlayerPhoto(champion, dataUrl)
      setPhoto(dataUrl)
    } catch (err) { alert('❌ ' + err.message) }
    finally { setSaving(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const clearPhoto = async () => {
    if (!champion?.id) return
    if (!confirm('Remove the champion photo?')) return
    setSaving(true)
    try {
      await removePlayerPhoto(champion)
      setPhoto(null)
    } catch (err) { alert('❌ ' + err.message) }
    finally { setSaving(false) }
  }

  const dateLabel = tournament?.created_at
    ? new Date(tournament.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' })

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl shadow-amber-900/40 border border-amber-600/40"
        style={{
          backgroundColor: '#0c0a18',
          backgroundImage: `
            radial-gradient(ellipse 80% 40% at 50% 0%, rgba(251,191,36,0.30) 0%, transparent 60%),
            radial-gradient(ellipse 100% 60% at 50% 100%, rgba(99,102,241,0.35) 0%, transparent 60%),
            linear-gradient(180deg, #0c0a18 0%, #02010a 100%)
          `,
        }}
      >
        <div className="h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.7)]" />

        <div className="text-center pt-7 pb-3 px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-400/80">eFootball Tournaments</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-gray-400">{tournament?.name ?? 'Tournament Champion'}</p>
        </div>

        <div className="text-center text-7xl drop-shadow-[0_0_25px_rgba(251,191,36,0.7)] my-1">🏆</div>

        <div className="text-center px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-amber-300/80">— Champion —</p>
        </div>

        <div className="px-8 pt-4 pb-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-amber-900/30 via-gray-900 to-indigo-950 border-2 border-amber-500/40 shadow-2xl shadow-amber-900/40">
            {photo ? (
              <img src={photo} alt={champion?.name ?? 'Champion'} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-5xl mb-2 opacity-50">👤</span>
                <p className="text-xs text-gray-400 font-semibold">No photo yet</p>
                {allowUpload && <p className="text-[10px] text-gray-500 mt-1">Tap "Upload Photo" below</p>}
              </div>
            )}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400" />
          </div>
        </div>

        <div className="text-center px-6 pb-2">
          <p
            className="text-3xl sm:text-4xl font-black leading-tight"
            style={{
              background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #fde68a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 4px 24px rgba(251,191,36,0.4)',
            }}
          >
            {champion?.name ?? 'TBD'}
          </p>
        </div>

        <div className="px-6 pb-6 mt-2 space-y-2">
          {finalScore && (
            <div className="bg-black/30 border border-amber-700/30 rounded-xl px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/70">Final Score</p>
              <p className="text-lg font-black text-white tabular-nums mt-0.5">
                {finalScore}
                {championStats && (
                  <span className={`ml-2 text-xs font-bold tabular-nums ${championStats.gd > 0 ? 'text-emerald-400' : championStats.gd < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    ({championStats.gd >= 0 ? '+' : ''}{championStats.gd} GD)
                  </span>
                )}
              </p>
            </div>
          )}
          {championStats && championStats.matches > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Matches" value={championStats.matches} tint="amber" />
              <Stat label="Goals"   value={championStats.gf} tint="emerald" />
              <Stat label="Conceded" value={championStats.ga} tint="red" />
            </div>
          )}
          {runnerUp && (
            <div className="bg-gray-900/50 border border-gray-700/40 rounded-xl px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Runner-Up</p>
              <p className="text-sm font-bold text-gray-200 mt-0.5">
                {runnerUp.name}
                {runnerUpStats && runnerUpStats.matches > 0 && (
                  <span className="ml-2 text-[10px] text-gray-400 font-medium">
                    · {runnerUpStats.matches} MP · {runnerUpStats.gf} G · {runnerUpStats.ga} GA
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-amber-900/30 px-6 py-3 text-center bg-black/40">
          <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400/70">Crowned · {dateLabel}</p>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.7)]" />
      </div>

      {/* Upload controls */}
      {allowUpload && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm shadow-lg shadow-amber-900/40 transition-colors"
          >
            📸 {saving ? 'Saving…' : (photo ? 'Change Photo' : 'Upload Photo')}
          </button>
          {photo && (
            <button onClick={clearPhoto} disabled={saving} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tint = 'amber' }) {
  const text =
    tint === 'emerald' ? 'text-emerald-300' :
    tint === 'red'     ? 'text-red-300' :
                         'text-white'
  return (
    <div className="bg-black/30 border border-amber-700/30 rounded-xl px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/70">{label}</p>
      <p className={`text-base font-black tabular-nums mt-0.5 ${text}`}>{value}</p>
    </div>
  )
}
