import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export function useTournament(idOrSlug, { bySlug = false } = {}) {
  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!idOrSlug) return
    setLoading(true)
    try {
      const query = supabase.from('tournaments').select('*')
      const { data: t, error: tErr } = bySlug
        ? await query.eq('slug', idOrSlug).single()
        : await query.eq('id', idOrSlug).single()
      if (tErr) throw tErr
      setTournament(t)

      const [{ data: p }, { data: f }, { data: s }] = await Promise.all([
        supabase.from('players').select('*').eq('tournament_id', t.id).order('created_at'),
        supabase.from('fixtures').select('*').eq('tournament_id', t.id).order('round').order('created_at'),
        supabase.from('standings').select('*').eq('tournament_id', t.id).order('points', { ascending: false }).order('goal_difference', { ascending: false }),
      ])
      setPlayers(p ?? [])
      setFixtures(f ?? [])
      setStandings(s ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [idOrSlug, bySlug])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { tournament, players, fixtures, standings, loading, error, refetch: fetchAll }
}
