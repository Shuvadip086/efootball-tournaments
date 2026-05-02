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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <span className="font-bold text-white">eFootball Tournaments</span>
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
            <h1 className="text-2xl font-bold">My Tournaments</h1>
            <p className="text-gray-400 text-sm mt-1">{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            to="/tournament/create"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            <span>+</span> New Tournament
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
              <Link
                key={t.id}
                to={`/tournament/manage/${t.id}`}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-indigo-600 transition-all hover:shadow-lg hover:shadow-indigo-950/50 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-lg">
                    {t.format === 'knockout' ? '🥊' : '📊'}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[t.status]}`}>
                    {t.status}
                  </span>
                </div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1 truncate">
                  {t.name}
                </h3>
                <p className="text-xs text-gray-400 capitalize mb-3">{t.format} · Up to {t.max_players} players</p>
                <p className="text-xs text-gray-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
