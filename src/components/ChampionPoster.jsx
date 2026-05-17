import { useState, useEffect, useRef } from 'react'

/**
 * Champion Poster — shows a screenshot-friendly card after the final
 * has been completed.
 *
 * The uploaded photo is stored as a data-URL in localStorage keyed by
 * `champion-photo:<tournament_id>` to avoid any DB / Storage setup.
 * Tell the user to screenshot the modal to share the poster (this is
 * the same pattern as ShareableFixtureCard already in the project).
 */
export default function ChampionPoster({
  tournament,
  champion,
  runnerUp,
  finalScore,    // optional: "3 – 1" for single-leg, or "5 – 3 agg." for two-leg
  onClose,
}) {
  const storageKey = `champion-photo:${tournament?.id}`
  const [photo, setPhoto] = useState(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(storageKey) } catch { return null }
  })
  const fileInputRef = useRef(null)
  const posterRef = useRef(null)

  useEffect(() => {
    // Re-read in case tournament changed
    try { setPhoto(localStorage.getItem(storageKey)) } catch { /* ignore */ }
  }, [storageKey])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (jpg / png).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image is larger than 5MB — please choose a smaller one.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      try {
        localStorage.setItem(storageKey, dataUrl)
        setPhoto(dataUrl)
      } catch (err) {
        alert('Could not save photo locally — it may be too large. Try a smaller image.\n' + err.message)
      }
    }
    reader.readAsDataURL(file)
  }

  const clearPhoto = () => {
    if (!confirm('Remove the champion photo?')) return
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    setPhoto(null)
  }

  const tournamentDate = tournament?.created_at
    ? new Date(tournament.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' })

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 text-white text-lg shadow-xl"
          aria-label="Close"
        >×</button>

        {/* Poster card */}
        <div
          ref={posterRef}
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
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.7)]" />

          {/* Header */}
          <div className="text-center pt-7 pb-3 px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-400/80">
              eFootball Tournaments
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-gray-400">
              {tournament?.name ?? 'Tournament Champion'}
            </p>
          </div>

          {/* Trophy */}
          <div className="text-center text-7xl drop-shadow-[0_0_25px_rgba(251,191,36,0.7)] my-1">
            🏆
          </div>

          {/* Champion title */}
          <div className="text-center px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-amber-300/80">— Champion —</p>
          </div>

          {/* Photo */}
          <div className="px-8 pt-4 pb-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-amber-900/30 via-gray-900 to-indigo-950 border-2 border-amber-500/40 shadow-2xl shadow-amber-900/40">
              {photo ? (
                <img
                  src={photo}
                  alt={champion?.name ?? 'Champion'}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span className="text-5xl mb-2 opacity-50">👤</span>
                  <p className="text-xs text-gray-400 font-semibold">No photo uploaded yet</p>
                  <p className="text-[10px] text-gray-500 mt-1">Click "Upload Photo" below</p>
                </div>
              )}
              {/* Corner accents */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400" />
            </div>
          </div>

          {/* Champion name */}
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

          {/* Score + runner-up */}
          <div className="px-6 pb-6 mt-2 space-y-2">
            {finalScore && (
              <div className="bg-black/30 border border-amber-700/30 rounded-xl px-4 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/70">Final Score</p>
                <p className="text-lg font-black text-white tabular-nums mt-0.5">{finalScore}</p>
              </div>
            )}
            {runnerUp && (
              <div className="bg-gray-900/50 border border-gray-700/40 rounded-xl px-4 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Runner-Up</p>
                <p className="text-sm font-bold text-gray-200 mt-0.5">{runnerUp.name}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-amber-900/30 px-6 py-3 text-center bg-black/40">
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400/70">
              Crowned · {tournamentDate}
            </p>
          </div>

          {/* Bottom accent */}
          <div className="h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.7)]" />
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm shadow-lg shadow-amber-900/40 transition-colors"
          >
            📸 {photo ? 'Change Photo' : 'Upload Photo'}
          </button>
          {photo && (
            <button
              onClick={clearPhoto}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-3">
          💡 Take a screenshot of the poster to share it!
        </p>
      </div>
    </div>
  )
}
