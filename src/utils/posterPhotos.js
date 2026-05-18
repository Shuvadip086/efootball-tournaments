/**
 * Shared photo storage for tournament posters.
 *
 * Photos are kept as data-URLs in localStorage, keyed by tournament +
 * player ID, so the same headshot follows a player wherever they
 * appear (champion, runner-up, top scorer).
 *
 *   key:  `poster-photo:{tournamentId}:{playerId}`
 *   val:  data:image/...;base64,...
 *
 * NOTE: localStorage is per-device. The host who uploads photos on
 * their laptop will see them on the live page on that laptop. Other
 * viewers see polished placeholder avatars instead.
 */

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB raw file cap

export function photoKey(tournamentId, playerId) {
  return `poster-photo:${tournamentId}:${playerId}`
}

export function getPlayerPhoto(tournamentId, playerId) {
  if (typeof window === 'undefined' || !tournamentId || !playerId) return null
  try { return localStorage.getItem(photoKey(tournamentId, playerId)) }
  catch { return null }
}

export function setPlayerPhoto(tournamentId, playerId, dataUrl) {
  if (typeof window === 'undefined' || !tournamentId || !playerId) return
  try { localStorage.setItem(photoKey(tournamentId, playerId), dataUrl) }
  catch (e) { throw new Error(`Could not save photo locally: ${e.message}`) }
}

export function clearPlayerPhoto(tournamentId, playerId) {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(photoKey(tournamentId, playerId)) }
  catch { /* ignore */ }
}

/**
 * File → data-URL conversion with basic validation.
 * Returns the data-URL string. Throws on invalid file.
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'))
    if (!file.type?.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    if (file.size > MAX_BYTES) return reject(new Error('Image is larger than 5MB — try a smaller one.'))
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}
