import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h13.2c-.6 3-2.3 5.6-5 7.3v6h8c4.7-4.3 7.3-10.7 7.3-17.5z" fill="#4285F4"/>
      <path d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.1 0-11.2-4.1-13.1-9.6H2.6v6.2C6.5 42.6 14.7 48 24 48z" fill="#34A853"/>
      <path d="M10.9 28.9c-.5-1.4-.7-2.9-.7-4.9s.3-3.4.7-4.9v-6.2H2.6C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.1l8.3-5.2z" fill="#FBBC05"/>
      <path d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.6-6.6C35.9 2.5 30.5 0 24 0 14.7 0 6.5 5.4 2.6 13.9l8.3 5.2C12.8 13.6 17.9 9.5 24 9.5z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (tab === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/dashboard')
      } else {
        if (!username.trim()) throw new Error('Username is required')
        const { error } = await signUp(email, password, username)
        if (error) throw error
        setMessage('Account created! Check your email to confirm, then sign in.')
        setTab('signin')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold text-white">eFootball Tournaments</h1>
          <p className="text-gray-400 text-sm mt-1">Organize & track your tournaments</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {['signin', 'signup'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setMessage('') }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${tab === t ? 'text-white border-b-2 border-indigo-500 bg-gray-900' : 'text-gray-400 hover:text-gray-200 bg-gray-900/50'}`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {message && (
              <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-lg px-4 py-3">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-semibold py-2.5 rounded-lg transition-colors"
            >
              <GoogleIcon />
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Email / Password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'signup' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="your_username"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {loading ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
