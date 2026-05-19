/**
 * Discord webhook notifier — fires rich-embed messages to a Discord
 * channel when interesting tournament events happen.
 *
 * Setup: tournament owner pastes a webhook URL into the Settings tab.
 * Webhook URLs are created in Discord via:
 *   Server Settings → Integrations → Webhooks → New Webhook → Copy URL
 *
 * Implementation notes:
 *   · Discord webhook endpoints support CORS for direct browser POSTs.
 *   · We swallow ALL errors — a missing/invalid webhook should never
 *     break score saving. Failures are logged to console only.
 *   · Embed colours use the same indigo / emerald / amber palette as
 *     the rest of the app for visual consistency.
 */

const COLORS = {
  matchResult:   0x6366f1,   // indigo
  upset:         0xf59e0b,   // amber — when a winner flips
  roundComplete: 0x10b981,   // emerald
  champion:      0xfbbf24,   // gold
}

const PUBLIC_URL = (() => {
  if (typeof window === 'undefined') return ''
  return window.location.origin
})()

function tournamentLink(tournament) {
  if (!tournament?.slug) return PUBLIC_URL
  return `${PUBLIC_URL}/t/${tournament.slug}`
}

async function postWebhook(url, payload) {
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    // Never let a webhook failure break the rest of the app.
    console.warn('Discord webhook failed:', e?.message ?? e)
  }
}

/**
 * Fire a "match result saved" embed.
 *
 *   tournament   – { id, name, slug, discord_webhook_url, format }
 *   fixture      – the saved fixture (with new home_score / away_score)
 *   homeName     – display name of the home player
 *   awayName     – display name of the away player
 *   opts.legLabel  – optional "Leg 1" / "Leg 2" tag
 *   opts.roundLabel – optional "Semi-Finals" / "Final" / "Match Day 3"
 *   opts.aggregateLine – optional "Aggregate: 5–3" line for two-leg ties
 */
export async function notifyMatchResult({ tournament, fixture, homeName, awayName, legLabel, roundLabel, aggregateLine }) {
  const url = tournament?.discord_webhook_url
  if (!url) return
  if (!fixture || fixture.status !== 'completed') return

  const h = fixture.home_score ?? 0
  const a = fixture.away_score ?? 0
  const headline = `${homeName ?? 'Home'} **${h}** — **${a}** ${awayName ?? 'Away'}`

  const fields = []
  if (roundLabel) fields.push({ name: 'Round', value: roundLabel, inline: true })
  if (legLabel)   fields.push({ name: 'Leg',   value: legLabel,   inline: true })
  if (aggregateLine) fields.push({ name: 'Aggregate', value: aggregateLine, inline: false })

  await postWebhook(url, {
    embeds: [{
      title: `⚽ Match result — ${tournament?.name ?? 'Tournament'}`,
      description: headline,
      url: tournamentLink(tournament),
      color: COLORS.matchResult,
      fields,
      footer: { text: 'eFootball Tournaments' },
      timestamp: new Date().toISOString(),
    }],
  })
}

/**
 * Fire a "winner changed mid-tournament" embed when an edit flips the
 * advancing player. Helps spectators in the Discord see that the
 * bracket shape just shifted.
 */
export async function notifyWinnerFlipped({ tournament, fromName, toName, roundsTouched }) {
  const url = tournament?.discord_webhook_url
  if (!url) return
  const rounds = (roundsTouched ?? []).join(', ')
  await postWebhook(url, {
    embeds: [{
      title: `🔄 Bracket update — ${tournament?.name ?? 'Tournament'}`,
      description: `**${fromName}** is out, **${toName}** advances${rounds ? ` to ${rounds}` : ''}.`,
      url: tournamentLink(tournament),
      color: COLORS.upset,
      footer: { text: 'eFootball Tournaments' },
      timestamp: new Date().toISOString(),
    }],
  })
}

/**
 * Fire a "champion crowned" celebration embed when the final is saved.
 */
export async function notifyChampion({ tournament, championName, runnerUpName, finalScore }) {
  const url = tournament?.discord_webhook_url
  if (!url) return
  await postWebhook(url, {
    embeds: [{
      title: `🏆 Champion: ${championName ?? 'TBD'}!`,
      description: `**${tournament?.name ?? 'Tournament'}** is decided.\n\nFinal: **${finalScore ?? '—'}**${runnerUpName ? `\nRunner-up: ${runnerUpName}` : ''}`,
      url: tournamentLink(tournament),
      color: COLORS.champion,
      footer: { text: 'eFootball Tournaments — see the live page for the full podium' },
      timestamp: new Date().toISOString(),
    }],
  })
}

/**
 * Send a test ping — used by the Settings panel "Test webhook" button so
 * the user can verify the URL works before the next match.
 */
export async function testWebhook(url) {
  if (!url) throw new Error('Paste a Discord webhook URL first')
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '✅ Webhook connected',
        description: 'eFootball Tournaments will post match results, bracket changes, and the champion here.',
        color: COLORS.roundComplete,
        footer: { text: 'eFootball Tournaments' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}
