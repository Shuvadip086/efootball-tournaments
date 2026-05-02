import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useRealtimeStandings(tournamentId) {
  const [standings, setStandings] = useState([])

  const fetchStandings = async () => {
    const { data } = await supabase
      .from('standings')
      .select('*, players(name, avatar_url)')
      .eq('tournament_id', tournamentId)
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })
    setStandings(data ?? [])
  }

  useEffect(() => {
    if (!tournamentId) return
    fetchStandings()

    const channel = supabase
      .channel(`standings:${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'standings',
        filter: `tournament_id=eq.${tournamentId}`,
      }, fetchStandings)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fixtures',
        filter: `tournament_id=eq.${tournamentId}`,
      }, fetchStandings)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [tournamentId])

  return standings
}
