import { getPlayerTheme } from '../utils/playerIcons'

/**
 * PlayerAvatar — auto-assigns a football-themed color + emoji badge
 * based on the player's index in the roster.
 *
 * Props:
 *   player  — { name, ... }
 *   index   — player's position in the list (0-based) for theme assignment
 *   size    — 'xs' | 'sm' | 'md' | 'lg'  (default 'md')
 *   badge   — show emoji badge overlay  (default false)
 */
export default function PlayerAvatar({ player, index = 0, size = 'md', badge = false }) {
  const theme = getPlayerTheme(index)

  const sizeMap = {
    xs: { outer: 'w-5 h-5',  text: 'text-[9px]',  badgePos: '-bottom-0.5 -right-0.5', badgeSize: 'text-[8px]' },
    sm: { outer: 'w-7 h-7',  text: 'text-[11px]', badgePos: '-bottom-1 -right-1',     badgeSize: 'text-[10px]' },
    md: { outer: 'w-9 h-9',  text: 'text-sm',     badgePos: '-bottom-1 -right-1',     badgeSize: 'text-xs' },
    lg: { outer: 'w-12 h-12', text: 'text-base',  badgePos: '-bottom-1 -right-1',     badgeSize: 'text-sm' },
  }

  const s = sizeMap[size] ?? sizeMap.md
  const initial = (player?.name ?? '?')[0].toUpperCase()

  return (
    <div className={`relative ${s.outer} rounded-full ${theme.bg} border-2 ${theme.border} flex items-center justify-center font-bold text-white shrink-0`}>
      <span className={s.text}>{initial}</span>
      {badge && (
        <span className={`absolute ${s.badgePos} ${s.badgeSize} leading-none select-none`}>
          {theme.emoji}
        </span>
      )}
    </div>
  )
}
