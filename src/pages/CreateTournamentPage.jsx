import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'

function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
    + '-' + Math.random().toString(36).slice(2, 6)
}

// ── Mini SVG previews ──────────────────────────────────────────

function SingleEliminationSVG() {
  const bar = { fill: '#4b5563', rx: 2 }
  const accent = '#6366f1'
  const line = { stroke: accent, strokeWidth: 1.5 }
  return (
    <svg viewBox="0 0 130 80" className="w-full h-14" fill="none">
      {/* R1 top match */}
      <rect x="4" y="9" width="38" height="9" {...bar} />
      <rect x="4" y="21" width="38" height="9" {...bar} />
      <rect x="45" y="9" width="6" height="6" rx="1" fill={accent} opacity="0.8" />
      {/* R1 bottom match */}
      <rect x="4" y="45" width="38" height="9" {...bar} />
      <rect x="4" y="57" width="38" height="9" {...bar} />
      <rect x="45" y="45" width="6" height="6" rx="1" fill={accent} opacity="0.8" />
      {/* Connectors R1→SF */}
      <line x1="42" y1="13" x2="54" y2="13" {...line} />
      <line x1="42" y1="25" x2="48" y2="25" {...line} />
      <line x1="48" y1="13" x2="48" y2="25" {...line} />
      <line x1="48" y1="19" x2="54" y2="19" {...line} />
      <line x1="42" y1="49" x2="54" y2="49" {...line} />
      <line x1="42" y1="61" x2="48" y2="61" {...line} />
      <line x1="48" y1="49" x2="48" y2="61" {...line} />
      <line x1="48" y1="55" x2="54" y2="55" {...line} />
      {/* SF matches */}
      <rect x="54" y="13" width="36" height="9" {...bar} />
      <rect x="54" y="55" width="36" height="9" {...bar} />
      {/* Connectors SF→F */}
      <line x1="90" y1="17" x2="96" y2="17" {...line} />
      <line x1="90" y1="59" x2="96" y2="59" {...line} />
      <line x1="96" y1="17" x2="96" y2="59" {...line} />
      <line x1="96" y1="38" x2="102" y2="38" {...line} />
      {/* Final */}
      <rect x="102" y="32" width="24" height="12" rx="3" fill={accent} opacity="0.9" />
    </svg>
  )
}

function RoundRobinSVG() {
  const accent = '#6366f1'
  const dim = '#374151'
  const letters = ['A', 'B', 'C', 'D']
  const cellW = 16, cellH = 12, startX = 18, startY = 18
  return (
    <svg viewBox="0 0 88 78" className="w-full h-14" fill="none">
      {letters.map((l, i) => (
        <text key={'h' + l} x={startX + i * cellW + cellW / 2} y="12"
          textAnchor="middle" fill="#9ca3af" fontSize="7" fontWeight="bold">{l}</text>
      ))}
      {letters.map((l, i) => (
        <text key={'v' + l} x="11" y={startY + i * cellH + cellH / 2 + 2.5}
          textAnchor="middle" fill="#9ca3af" fontSize="7" fontWeight="bold">{l}</text>
      ))}
      {letters.map((_, ri) =>
        letters.map((_, ci) => {
          if (ri === ci) return null
          return (
            <rect
              key={`${ri}-${ci}`}
              x={startX + ci * cellW + 1} y={startY + ri * cellH + 1}
              width={cellW - 2} height={cellH - 2} rx="2"
              fill={ri > ci ? accent : dim} opacity={ri > ci ? 0.75 : 0.4}
            />
          )
        })
      )}
    </svg>
  )
}

function DoubleEliminationSVG() {
  const bar = { fill: '#374151', rx: 2 }
  const line = { stroke: '#4b5563', strokeWidth: 1.2 }
  return (
    <svg viewBox="0 0 130 80" className="w-full h-14" fill="none">
      <text x="4" y="9" fill="#6b7280" fontSize="6" fontWeight="600">WINNER'S BRACKET</text>
      <rect x="4" y="11" width="30" height="7" {...bar} />
      <rect x="4" y="21" width="30" height="7" {...bar} />
      <line x1="34" y1="14" x2="40" y2="14" {...line} />
      <line x1="34" y1="24" x2="38" y2="24" {...line} />
      <line x1="38" y1="14" x2="38" y2="24" {...line} />
      <line x1="38" y1="19" x2="44" y2="19" {...line} />
      <rect x="44" y="15" width="28" height="7" {...bar} />
      <rect x="4" y="35" width="30" height="7" {...bar} />
      <rect x="4" y="45" width="30" height="7" {...bar} />
      <line x1="34" y1="38" x2="40" y2="38" {...line} />
      <line x1="34" y1="48" x2="38" y2="48" {...line} />
      <line x1="38" y1="38" x2="38" y2="48" {...line} />
      <line x1="38" y1="43" x2="44" y2="43" {...line} />
      <rect x="44" y="39" width="28" height="7" {...bar} />
      <text x="4" y="60" fill="#6b7280" fontSize="6" fontWeight="600">LOSER'S BRACKET</text>
      <rect x="4" y="62" width="30" height="7" {...bar} />
      <rect x="38" y="62" width="30" height="7" {...bar} />
      <rect x="72" y="62" width="30" height="7" {...bar} />
    </svg>
  )
}

function SwissSVG() {
  const bar = { fill: '#374151', rx: 2 }
  const accent = '#6366f1'
  return (
    <svg viewBox="0 0 130 80" className="w-full h-14" fill="none">
      <rect x="4" y="6" width="14" height="8" fill={accent} opacity="0.7" rx="2" />
      <rect x="22" y="12" width="48" height="7" {...bar} />
      <rect x="4" y="26" width="14" height="8" fill={accent} opacity="0.7" rx="2" />
      <rect x="22" y="30" width="30" height="7" {...bar} />
      <rect x="56" y="30" width="30" height="7" {...bar} />
      <rect x="4" y="46" width="14" height="8" fill={accent} opacity="0.7" rx="2" />
      <rect x="22" y="50" width="22" height="7" {...bar} />
      <rect x="48" y="50" width="22" height="7" {...bar} />
      <rect x="74" y="50" width="22" height="7" {...bar} />
    </svg>
  )
}

function GroupKnockoutSVG() {
  const accent = '#6366f1'
  const dim = '#374151'
  return (
    <svg viewBox="0 0 130 80" className="w-full h-14" fill="none">
      {/* Group A mini grid */}
      <text x="9" y="8" textAnchor="middle" fill="#9ca3af" fontSize="6" fontWeight="bold">A</text>
      {[0,1,2].map(i => <rect key={i} x={4+i*9} y={10} width="7" height="5" rx="1" fill={i===0?accent:dim} opacity={i===0?0.8:0.5} />)}
      {/* Group B mini grid */}
      <text x="44" y="8" textAnchor="middle" fill="#9ca3af" fontSize="6" fontWeight="bold">B</text>
      {[0,1,2].map(i => <rect key={i} x={39+i*9} y={10} width="7" height="5" rx="1" fill={i===0?dim:i===1?accent:dim} opacity={i===1?0.8:0.5} />)}
      {/* Group C mini grid */}
      <text x="79" y="8" textAnchor="middle" fill="#9ca3af" fontSize="6" fontWeight="bold">C</text>
      {[0,1,2].map(i => <rect key={i} x={74+i*9} y={10} width="7" height="5" rx="1" fill={i===1?accent:dim} opacity={i===1?0.8:0.5} />)}
      {/* Group D mini grid */}
      <text x="114" y="8" textAnchor="middle" fill="#9ca3af" fontSize="6" fontWeight="bold">D</text>
      {[0,1,2].map(i => <rect key={i} x={109+i*9} y={10} width="7" height="5" rx="1" fill={i===2?accent:dim} opacity={i===2?0.8:0.5} />)}
      {/* Arrow down */}
      <line x1="65" y1="20" x2="65" y2="30" stroke="#4b5563" strokeWidth="1.5"/>
      <polygon points="61,28 65,34 69,28" fill="#4b5563"/>
      {/* Knockout bracket */}
      <rect x="10" y="38" width="28" height="8" rx="2" fill={dim} opacity="0.7"/>
      <rect x="10" y="50" width="28" height="8" rx="2" fill={dim} opacity="0.5"/>
      <line x1="38" y1="42" x2="44" y2="42" stroke={accent} strokeWidth="1.5"/>
      <line x1="38" y1="54" x2="42" y2="54" stroke={accent} strokeWidth="1.5"/>
      <line x1="42" y1="42" x2="42" y2="54" stroke={accent} strokeWidth="1.5"/>
      <line x1="42" y1="48" x2="48" y2="48" stroke={accent} strokeWidth="1.5"/>
      <rect x="92" y="38" width="28" height="8" rx="2" fill={dim} opacity="0.7"/>
      <rect x="92" y="50" width="28" height="8" rx="2" fill={dim} opacity="0.5"/>
      <line x1="88" y1="42" x2="84" y2="42" stroke={accent} strokeWidth="1.5"/>
      <line x1="88" y1="54" x2="84" y2="54" stroke={accent} strokeWidth="1.5"/>
      <line x1="84" y1="42" x2="84" y2="54" stroke={accent} strokeWidth="1.5"/>
      <line x1="84" y1="48" x2="78" y2="48" stroke={accent} strokeWidth="1.5"/>
      {/* Final */}
      <rect x="52" y="42" width="26" height="12" rx="3" fill={accent} opacity="0.9"/>
      <text x="65" y="51" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">FINAL</text>
    </svg>
  )
}

function FreeForAllSVG() {
  const accent = '#6366f1'
  const dim = '#374151'
  const topRow = ['A', 'B', 'C', 'D']
  const botRow = ['E', 'F', 'G', 'H']
  return (
    <svg viewBox="0 0 130 80" className="w-full h-14" fill="none">
      {topRow.map((l, i) => (
        <rect key={l} x={4 + i * 18} y="4" width="14" height="14" rx="3" fill={dim} />
      ))}
      {topRow.map((l, i) => (
        <text key={l} x={11 + i * 18} y="15" textAnchor="middle" fill="#9ca3af" fontSize="8" fontWeight="bold">{l}</text>
      ))}
      {botRow.map((l, i) => (
        <rect key={l} x={4 + i * 18} y="22" width="14" height="14" rx="3" fill={dim} />
      ))}
      {botRow.map((l, i) => (
        <text key={l} x={11 + i * 18} y="33" textAnchor="middle" fill="#9ca3af" fontSize="8" fontWeight="bold">{l}</text>
      ))}
      <line x1="65" y1="36" x2="65" y2="48" stroke="#4b5563" strokeWidth="1.5" />
      {['A', 'E', 'G'].map((l, i) => (
        <rect key={l} x={22 + i * 18} y="52" width="14" height="14" rx="3" fill={accent} opacity="0.75" />
      ))}
      {['A', 'E', 'G'].map((l, i) => (
        <text key={l} x={29 + i * 18} y="63" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{l}</text>
      ))}
    </svg>
  )
}

// ── Format definitions ──────────────────────────────────────────

const FORMATS = [
  {
    id: 'knockout',
    label: 'Single Elimination',
    desc: 'The loser of each match will be immediately eliminated from the tournament.',
    svg: <SingleEliminationSVG />,
    available: true,
  },
  {
    id: 'double_elimination',
    label: 'Double Elimination',
    desc: 'A participant gets eliminated upon having lost two games or matches.',
    svg: <DoubleEliminationSVG />,
    available: false,
  },
  {
    id: 'league',
    label: 'Round Robin',
    desc: 'Each participant meets all other participants in turn.',
    svg: <RoundRobinSVG />,
    available: true,
  },
  {
    id: 'group_knockout',
    label: 'Group + Knockout',
    desc: 'Players compete in round-robin groups; top finishers advance to a knockout bracket.',
    svg: <GroupKnockoutSVG />,
    available: true,
  },
  {
    id: 'swiss',
    label: 'Swiss',
    desc: 'Participants are paired to ensure each competitor plays opponents with a similar running score.',
    svg: <SwissSVG />,
    available: false,
  },
  {
    id: 'free_for_all',
    label: 'Free-for-all',
    desc: 'Several participants are grouped in one match and the winners will advance to the next round.',
    svg: <FreeForAllSVG />,
    available: false,
  },
]

// ── Toggle component ────────────────────────────────────────────

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group w-fit">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-700'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors select-none">{label}</span>
    </label>
  )
}

// ── Main component ──────────────────────────────────────────────

export default function CreateTournamentPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    format: 'knockout',
    num_groups: 4,
    participantsText: '',
    randomizeSeeds: false,
    thirdPlace: false,
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const parsedPlayers = form.participantsText
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean)

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError('Tournament name is required.')
    if (parsedPlayers.length < 2) return setError('Add at least 2 participants.')
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
          max_players: parsedPlayers.length,
          num_groups: form.format === 'group_knockout' ? form.num_groups : 4,
          slug,
        })
        .select()
        .single()
      if (tErr) throw tErr

      let players = [...parsedPlayers]
      if (form.randomizeSeeds) {
        for (let i = players.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[players[i], players[j]] = [players[j], players[i]]
        }
      }

      const { error: pErr } = await supabase
        .from('players')
        .insert(players.map(name => ({ tournament_id: t.id, name })))
      if (pErr) throw pErr

      navigate(`/tournament/manage/${t.id}`)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">← Back</Link>
          <span className="text-gray-600">|</span>
          <span className="font-semibold">⚽ eFootball Tournaments</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-10">Tournament Bracket Generator</h1>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-8">
            {error}
          </div>
        )}

        {/* ── Section: Tournament Format ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-1">Tournament format</h2>
          <p className="text-gray-400 text-sm mb-5">
            Other tournament types will be unlocked in future updates.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FORMATS.map(f => (
              <button
                key={f.id}
                type="button"
                disabled={!f.available}
                onClick={() => f.available && set('format', f.id)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all flex flex-col ${
                  !f.available
                    ? 'border-gray-800 bg-gray-900/20 opacity-40 cursor-not-allowed'
                    : form.format === f.id
                    ? 'border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-950/40'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800/60'
                }`}
              >
                {!f.available && (
                  <span className="absolute top-2 right-2 text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full font-semibold tracking-wide">
                    SOON
                  </span>
                )}
                <div className="mb-3 w-full">{f.svg}</div>
                <div className="font-semibold text-sm text-white">{f.label}</div>
                <div className="text-xs text-gray-400 mt-1 leading-relaxed">{f.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-gray-800 mb-10" />

        {/* ── Section: Format Settings ── */}
        {form.format === 'knockout' && (
          <>
            <section className="mb-10">
              <h2 className="text-xl font-bold mb-5">Single Elimination Settings</h2>
              <Toggle
                checked={form.thirdPlace}
                onChange={v => set('thirdPlace', v)}
                label="Include a match for 3rd place"
              />
            </section>
            <div className="border-t border-gray-800 mb-10" />
          </>
        )}

        {form.format === 'group_knockout' && (
          <>
            <section className="mb-10">
              <h2 className="text-xl font-bold mb-1">Group Stage Settings</h2>
              <p className="text-sm text-gray-400 mb-5">
                Players are split evenly across groups. Top 2 from each group advance to the knockout bracket.
              </p>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Number of Groups</label>
                <div className="flex gap-3 flex-wrap">
                  {[2, 3, 4, 6, 8].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('num_groups', n)}
                      className={`w-14 h-12 rounded-xl border-2 font-bold text-sm transition-all ${
                        form.num_groups === n
                          ? 'border-indigo-500 bg-indigo-950/40 text-white'
                          : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {parsedPlayers.length > 0 && (
                  <p className="text-xs text-gray-500 mt-3">
                    {parsedPlayers.length} players ÷ {form.num_groups} groups
                    = ~{Math.ceil(parsedPlayers.length / form.num_groups)} players per group
                    {parsedPlayers.length < form.num_groups * 2 && (
                      <span className="text-amber-400 ml-2">
                        ⚠ Need at least {form.num_groups * 2} players for {form.num_groups} groups
                      </span>
                    )}
                  </p>
                )}
              </div>
            </section>
            <div className="border-t border-gray-800 mb-10" />
          </>
        )}

        {/* ── Section: Bracket Size / Participants ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-5">Bracket Size</h2>

          <h3 className="text-base font-semibold mb-0.5">Participants</h3>
          <p className="text-sm text-gray-400 mb-3">One per line, ordered by seed from best to worst</p>
          <textarea
            value={form.participantsText}
            onChange={e => set('participantsText', e.target.value)}
            placeholder="Enter participants here"
            rows={8}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed"
          />
          {parsedPlayers.length > 0 && (
            <p className="text-xs text-gray-500 mt-1.5">
              {parsedPlayers.length} participant{parsedPlayers.length !== 1 ? 's' : ''} entered
            </p>
          )}

          <div className="mt-5">
            <Toggle
              checked={form.randomizeSeeds}
              onChange={v => set('randomizeSeeds', v)}
              label="Randomize seeds"
            />
          </div>
        </section>

        <div className="border-t border-gray-800 mb-10" />

        {/* ── Section: Tournament Name ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-5">Tournament Name</h2>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Enter the tournament name"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <div className="mt-4">
            <label className="block text-sm text-gray-400 mb-2">Description <span className="text-gray-600">(optional)</span></label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="A short description…"
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none text-sm"
            />
          </div>
        </section>

        {/* ── Submit ── */}
        <div className="pb-10">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !form.name.trim() || parsedPlayers.length < 2}
            className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors text-sm tracking-widest uppercase shadow-lg shadow-indigo-950/50"
          >
            {loading ? 'Creating…' : 'Submit'}
          </button>
          {(!form.name.trim() || parsedPlayers.length < 2) && (
            <p className="text-xs text-gray-600 mt-2">
              {!form.name.trim() ? 'Enter a tournament name to continue.' : 'Add at least 2 participants to continue.'}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
