// Auto-assigned football-themed player icons
// Each player gets a unique color + emoji based on their index

export const PLAYER_THEMES = [
  { bg: 'bg-red-600',     border: 'border-red-500',     shadow: 'shadow-red-900/50',    emoji: '🔴', label: 'Red' },
  { bg: 'bg-blue-600',    border: 'border-blue-500',    shadow: 'shadow-blue-900/50',   emoji: '🔵', label: 'Blue' },
  { bg: 'bg-amber-500',   border: 'border-amber-400',   shadow: 'shadow-amber-900/50',  emoji: '⭐', label: 'Gold' },
  { bg: 'bg-emerald-600', border: 'border-emerald-500', shadow: 'shadow-emerald-900/50',emoji: '🟢', label: 'Green' },
  { bg: 'bg-purple-600',  border: 'border-purple-500',  shadow: 'shadow-purple-900/50', emoji: '💜', label: 'Purple' },
  { bg: 'bg-orange-500',  border: 'border-orange-400',  shadow: 'shadow-orange-900/50', emoji: '🔥', label: 'Orange' },
  { bg: 'bg-teal-600',    border: 'border-teal-500',    shadow: 'shadow-teal-900/50',   emoji: '💎', label: 'Teal' },
  { bg: 'bg-rose-600',    border: 'border-rose-500',    shadow: 'shadow-rose-900/50',   emoji: '❤️', label: 'Rose' },
  { bg: 'bg-indigo-600',  border: 'border-indigo-500',  shadow: 'shadow-indigo-900/50', emoji: '👑', label: 'Indigo' },
  { bg: 'bg-cyan-500',    border: 'border-cyan-400',    shadow: 'shadow-cyan-900/50',   emoji: '⚡', label: 'Cyan' },
  { bg: 'bg-lime-600',    border: 'border-lime-500',    shadow: 'shadow-lime-900/50',   emoji: '🌟', label: 'Lime' },
  { bg: 'bg-pink-600',    border: 'border-pink-500',    shadow: 'shadow-pink-900/50',   emoji: '🌸', label: 'Pink' },
  { bg: 'bg-yellow-600',  border: 'border-yellow-500',  shadow: 'shadow-yellow-900/50', emoji: '🏆', label: 'Yellow' },
  { bg: 'bg-violet-600',  border: 'border-violet-500',  shadow: 'shadow-violet-900/50', emoji: '🔮', label: 'Violet' },
  { bg: 'bg-sky-500',     border: 'border-sky-400',     shadow: 'shadow-sky-900/50',    emoji: '🦅', label: 'Sky' },
  { bg: 'bg-fuchsia-600', border: 'border-fuchsia-500', shadow: 'shadow-fuchsia-900/50',emoji: '🌺', label: 'Fuchsia' },
]

export function getPlayerTheme(index) {
  return PLAYER_THEMES[index % PLAYER_THEMES.length]
}
