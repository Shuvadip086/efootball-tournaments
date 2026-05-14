import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'

const STATUS_COLORS = {
  draft: 'bg-gray-700 text-gray-300',
  active: 'bg-green-800 text-green-300',
  completed: 'bg-indigo-800 text-indigo-300',
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('tournaments')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTournaments(data ?? [])
        setLoading(false)
      })
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleDelete = async (e, tournamentId, tournamentName) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${tournamentName}"? This will permanently remove all players, fixtures, and standings.`)) return
    await supabase.from('tournaments').delete().eq('id', tournamentId)
    setTournaments(prev => prev.filter(t => t.id !== tournamentId))
  }

  return (
    <div className="min-h-screen stadium-bg text-white">
      {/* Top glow accent */}
      <div className="field-accent-top" />
      {/* Navbar */}
      <nav className="border-b border-indigo-900/40 bg-gray-900/70 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl trophy-shine">⚽</span>
            <span className="font-black text-white tracking-tight">eFootball <span className="text-indigo-400">Tournaments</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black match-day-text">My Tournaments</h1>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} on the books
            </p>
          </div>
          <Link
            to="/tournament/create"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/40 hover:shadow-indigo-700/60 hover:-translate-y-0.5"
          >
            <span className="text-base">⚽</span> Kick Off New Tournament
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
            <span className="text-5xl mb-4 block">🏆</span>
            <h2 className="text-lg font-semibold text-white mb-2">No tournaments yet</h2>
            <p className="text-gray-400 text-sm mb-6">Create your first tournament and start playing!</p>
            <Link
              to="/tournament/create"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              + New Tournament
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map(t => (
              <div
                key={t.id}
                onClick={() => navigate(`/tournament/manage/${t.id}`)}
                className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950/40 border border-indigo-900/30 rounded-2xl p-5 group cursor-pointer card-hover-glow overflow-hidden"
              >
                {/* Decorative pitch corner */}
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full border-2 border-indigo-500/10 pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full border-2 border-emerald-500/5 pointer-events-none" />

                {/* Delete button */}
                <button
                  onClick={e => handleDelete(e, t.id, t.name)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 hover:bg-red-900/30 w-7 h-7 rounded-lg flex items-center justify-center text-sm z-10"
                  title="Delete tournament"
                >
                  🗑
                </button>

                <div className="relative flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-950/50">
                    {t.format === 'knockout' ? '🥊' : t.format === 'group_knockout' ? '🏆' : '📊'}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full mr-8 ${STATUS_COLORS[t.status]}`}>
                    {t.status}
                  </span>
                </div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1 truncate">
                  {t.name}
                </h3>
                <p className="text-xs text-gray-400 capitalize mb-3">
                  {t.format === 'group_knockout' ? 'Group + Knockout' : t.format} · Up to {t.max_players} players
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
