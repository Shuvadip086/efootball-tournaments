import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'

const STEPS = ['Details', 'Format', 'Players']

function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
    + '-' + Math.random().toString(36).slice(2, 6)
}

export default function CreateTournamentPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    format: 'league',
    max_players: 8,
    players: ['', ''],
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const addPlayer = () => set('players', [...form.players, ''])
  const removePlayer = (i) => set('players', form.players.filter((_, idx) => idx !== i))
  const setPlayer = (i, val) => {
    const updated = [...form.players]
    updated[i] = val
    set('players', updated)
  }

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0
    if (step === 1) return true
    return form.players.filter(p => p.trim()).length >= 2
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const slug = slugify(form.name)
      const { data: t, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          owner_id: user.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          format: form.format,
          max_players: form.max_players,
          slug,
        })
        .select()
        .single()
      if (tErr) throw tErr

      const validPlayers = form.players.filter(p => p.trim())
      if (validPlayers.length) {
        const { error: pErr } = await supabase
          .from('players')
          .insert(validPlayers.map(name => ({ tournament_id: t.id, name: name.trim() })))
        if (pErr) throw pErr
      }

      navigate(`/tournament/manage/${t.id}`)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">← Back</Link>
          <span className="text-gray-600">|</span>
          <span className="font-semibold">New Tournament</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? 'bg-indigo-600 text-white' : i === step ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-950' : 'bg-gray-800 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'text-white font-medium' : 'text-gray-500'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-700 ml-1" />}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* Step 0 – Details */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Tournament Details</h2>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Tournament Name *</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Premier League Season 1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="A short description…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 1 – Format */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Format & Settings</h2>
              <div className="grid grid-cols-2 gap-3">
                {['league', 'knockout'].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set('format', f)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${form.format === f ? 'border-indigo-500 bg-indigo-950/40' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                  >
                    <div className="text-2xl mb-2">{f === 'league' ? '📊' : '🥊'}</div>
                    <div className="font-semibold capitalize">{f}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {f === 'league' ? 'Everyone plays everyone. Points based ranking.' : 'Single elimination. Winner advances.'}
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Max Players</label>
                <select
                  value={form.max_players}
                  onChange={e => set('max_players', parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {[4, 6, 8, 10, 12, 16, 20, 32].map(n => (
                    <option key={n} value={n}>{n} players</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2 – Players */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-1">Add Players</h2>
              <p className="text-sm text-gray-400 mb-4">Add at least 2 players. You can add more later.</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {form.players.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={p}
                      onChange={e => setPlayer(i, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    {form.players.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePlayer(i)}
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-red-400 hover:border-red-700 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.players.length < form.max_players && (
                <button
                  type="button"
                  onClick={addPlayer}
                  className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition-colors text-sm"
                >
                  + Add Player
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/dashboard')}
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {step === 0 ? 'Cancel' : '← Back'}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canNext() || loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {loading ? 'Creating…' : 'Create Tournament'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
