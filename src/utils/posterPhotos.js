/**
 * Shared player-photo storage for tournament posters.
 *
 * Photos are stored on the SERVER (column players.photo_data_url) so
 * they sync across every device — uploads from the host's laptop now
 * show up on phones, co-organiser devices, and the public live page.
 *
 * The photo is a base64 data-URL ~200KB max (we resize on the client
 * to a 800px square JPEG before saving, regardless of original size).
 *
 * Functions:
 *   getPlayerPhoto(player)             → returns the data-URL or null
 *   savePlayerPhoto(playerId, dataUrl) → uploads to Supabase
 *   removePlayerPhoto(playerId)        → clears the column
 *   readFileAsResizedDataUrl(file)     → file → resized data-URL
 *
 * NOTE: pass the full player object (from useTournament) to
 * getPlayerPhoto — it just reads player.photo_data_url. There's no
 * extra round-trip; the field comes back automatically with the rest
 * of the tournament data.
 *
 * Legacy localStorage photos (from before this migration) are still
 * read as a fallback so existing uploads keep working until you
 * re-upload them. Once the host re-uploads, the new server copy
 * takes priority.
 */

import { supabase } from '../supabaseClient'

// Resize cap — keeps each photo ≲200 KB after JPEG compression so a
// row's total size stays well within Postgres / Supabase limits.
const MAX_DIM = 800
const JPEG_QUALITY = 0.85
const MAX_INPUT_BYTES = 10 * 1024 * 1024 // 10 MB raw file cap (we'll resize it anyway)

// Legacy localStorage key — kept for backwards-compat reads only.
function legacyKey(tournamentId, playerId) {
  return `poster-photo:${tournamentId}:${playerId}`
}

/**
 * Get the photo for a player. Prefers the server-side data-URL
 * (player.photo_data_url) and falls back to any legacy localStorage
 * value from before the migration.
 */
export function getPlayerPhoto(player, tournamentIdForFallback) {
  if (!player) return null
  if (player.photo_data_url) return player.photo_data_url
  // Fallback to legacy localStorage (per-device) entries
  if (typeof window === 'undefined') return null
  const tid = tournamentIdForFallback ?? player.tournament_id
  if (!tid || !player.id) return null
  try { return localStorage.getItem(legacyKey(tid, player.id)) }
  catch { return null }
}

/**
 * Save a photo for a player. Writes to Supabase so every device sees
 * it. Also clears any legacy localStorage copy.
 */
export async function savePlayerPhoto(player, dataUrl) {
  if (!player?.id) throw new Error('No player provided')
  const { error } = await supabase
    .from('players')
    .update({ photo_data_url: dataUrl })
    .eq('id', player.id)
  if (error) throw error

  // Clear legacy local copy so old per-device photos don't override
  // the new shared one.
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(legacyKey(player.tournament_id, player.id))
    }
  } catch { /* ignore */ }
}

/** Remove the photo for a player. */
export async function removePlayerPhoto(player) {
  if (!player?.id) return
  const { error } = await supabase
    .from('players')
    .update({ photo_data_url: null })
    .eq('id', player.id)
  if (error) throw error
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(legacyKey(player.tournament_id, player.id))
    }
  } catch { /* ignore */ }
}

/**
 * Read a file, downscale it to a ≤MAX_DIM JPEG, return a data-URL.
 * Resizing happens in a hidden <canvas> so any large camera shot
 * arriving at 4000×3000 becomes a manageable square thumbnail.
 */
export function readFileAsResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'))
    if (!file.type?.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    if (file.size > MAX_INPUT_BYTES) return reject(new Error('Image is larger than 10 MB — pick a smaller one.'))

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load that image.'))
      img.onload = () => {
        try {
          // Scale so the longest side <= MAX_DIM, keep aspect.
          const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
          const w = Math.round(img.width  * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width  = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          // Use JPEG — much smaller than PNG for photos
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          resolve(dataUrl)
        } catch (e) {
          reject(new Error('Could not resize image: ' + e.message))
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// ── Legacy exports kept so existing imports don't break ───────────
// These will be removed once all callers are migrated.

/** @deprecated Use getPlayerPhoto(player) — needs the full player object now. */
export function getPlayerPhotoByIds(tournamentId, playerId) {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(legacyKey(tournamentId, playerId)) }
  catch { return null }
}

/** @deprecated Use savePlayerPhoto(player, dataUrl). */
export function setPlayerPhoto() {
  throw new Error('setPlayerPhoto is deprecated — use savePlayerPhoto(player, dataUrl) which writes to Supabase.')
}

/** @deprecated Use removePlayerPhoto(player). */
export function clearPlayerPhoto() {
  throw new Error('clearPlayerPhoto is deprecated — use removePlayerPhoto(player) which writes to Supabase.')
}

/** @deprecated Use readFileAsResizedDataUrl. */
export const readFileAsDataUrl = readFileAsResizedDataUrl
