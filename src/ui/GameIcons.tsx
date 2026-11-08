// The game's own small icons, drawn here (the owner's: designed, never an emoji or a special character): each a 16-unit picture in the
// colour of the text around it (currentColor), for the staff's special skills (data/staff's SKILLS), the badges beside them (up for a buff,
// down for a debuff), the dice that draws the applicants again, and the stars of a rating (whole, half, empty).
import type { ReactElement } from 'react'
import type { SkillId } from '@/data/staff'

const box = { viewBox: '0 0 16 16', 'aria-hidden': true } as const
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** each skill's picture */
const SKILL_ART: Record<SkillId, ReactElement> = {
  // (nimble: a double chevron pressing on, two speed lines behind it)
  quick: <><path {...line} d="M6.5 4 10.5 8 6.5 12M10 4 14 8 10 12" /><path {...line} d="M1.5 6.2h3M2.5 9.8h2.5" /></>,
  // (early bird: the sun half up over the horizon, its rays)
  earlyBird: <><path fill="currentColor" d="M4.2 11a3.8 3.8 0 0 1 7.6 0Z" /><path {...line} d="M1.5 11h13M8 2.6v1.8M3.3 4.8l1.2 1.2M12.7 4.8l-1.2 1.2M1.8 8.4h1.6M12.6 8.4h1.6" /></>,
  // (sturdy: a heart, a pulse across it)
  sturdy: <><path fill="currentColor" opacity="0.9" d="M8 14.2 2.3 8.6A3.4 3.4 0 0 1 8 4.1a3.4 3.4 0 0 1 5.7 4.5Z" /><path fill="none" stroke="var(--icon-cut, #fff)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" d="M3.6 8.6h2.1l1-1.8 1.6 3.4 1.1-1.6h2.9" /></>,
  // (night owl: a round face, its ear tufts, two big eyes, a beak)
  nightOwl: <><path fill="currentColor" d="M3 4.2 4.6 6A5 5 0 0 1 8 5a5 5 0 0 1 3.4 1L13 4.2l.3 4.4A5.3 5.3 0 0 1 8 14a5.3 5.3 0 0 1-5.3-5.4Z" /><circle cx="5.9" cy="9" r="1.75" fill="var(--icon-cut, #fff)" /><circle cx="10.1" cy="9" r="1.75" fill="var(--icon-cut, #fff)" /><circle cx="5.9" cy="9" r="0.8" fill="currentColor" /><circle cx="10.1" cy="9" r="0.8" fill="currentColor" /><path fill="var(--icon-cut, #fff)" d="M7.3 10.6h1.4L8 12Z" /></>,
  // (craftsman: a kitchen knife, its blade's edge and its handle)
  craftsman: <><path fill="currentColor" d="M2 11.6 10.8 2.8c1.4-.4 2.1.3 1.8 1.7L6.6 10.5Z" /><path fill="currentColor" opacity="0.75" d="m6.1 11 1.4 1.4-2.6 2.6a1 1 0 0 1-1.4 0l0 0a1 1 0 0 1 0-1.4Z" /><path {...line} strokeWidth="1" d="M4.3 9.3 9.5 4.1" opacity="0.55" /></>,
  // (iron man: a shield, a bar and a rivet on it)
  ironMan: <><path fill="currentColor" d="M8 1.6 13.4 3.6v4.2c0 3.2-2.3 5.6-5.4 6.6C4.9 13.4 2.6 11 2.6 7.8V3.6Z" /><path fill="none" stroke="var(--icon-cut, #fff)" strokeWidth="1.3" strokeLinecap="round" d="M8 4.4v6.6M5.2 7.2h5.6" /></>,
  // (whirlwind: a spiral wind, three turns opening out)
  whirlwind: <><path {...line} d="M2 5.2h8.4a2 2 0 1 0-2-2M2 8.4h11a2 2 0 1 1-2 2M3.5 11.6h4" /></>,
  // (prodigy: a crown, three points with a jewel on each, its band)
  prodigy: <><path fill="currentColor" d="M2.2 5.2 5 8.6 8 3.6l3 5 2.8-3.4-1 7.2H3.2Z" /><circle cx="2.2" cy="4.6" r="1.1" fill="currentColor" /><circle cx="8" cy="2.8" r="1.1" fill="currentColor" /><circle cx="13.8" cy="4.6" r="1.1" fill="currentColor" /><rect x="3.2" y="12.4" width="9.6" height="1.6" rx="0.5" fill="currentColor" /></>,
}
export function SkillIcon({ id, size = 13 }: { id: SkillId; size?: number }) {
  return <svg {...box} width={size} height={size} className="game-icon">{SKILL_ART[id]}</svg>
}

/** a buff (up) or a debuff (down): a filled chevron */
export function StatusIcon({ up, size = 9 }: { up: boolean; size?: number | string }) {
  return <svg {...box} width={size} height={size} className="game-icon"><path fill="currentColor" d={up ? 'M8 3 14 11.5H2Z' : 'M8 13 2 4.5h12Z'} /></svg>
}

/** the dice that draws the applicants again: a die seen a little from above, five pips */
export function DiceIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...box} width={size} height={size} className="game-icon">
      <rect x="2" y="2" width="12" height="12" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[[5.2, 5.2], [10.8, 5.2], [8, 8], [5.2, 10.8], [10.8, 10.8]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.15" fill="currentColor" />)}
    </svg>
  )
}

const STAR = 'M8 1.4 10 5.7l4.7.5-3.5 3.2 1 4.6L8 11.6 3.8 14l1-4.6L1.3 6.2 6 5.7Z'
/** a star of a rating: whole, half (its left half), or empty */
export function StarIcon({ fill = 1, size = 14 }: { fill?: 0 | 0.5 | 1; size?: number | string }) {
  return (
    <svg {...box} width={size} height={size} className="game-icon game-star">
      {fill === 0.5 && <defs><clipPath id="star-half"><rect x="0" y="0" width="8" height="16" /></clipPath></defs>}
      <path d={STAR} fill="currentColor" opacity={fill === 1 ? 1 : 0.25} />
      {fill === 0.5 && <path d={STAR} fill="currentColor" clipPath="url(#star-half)" />}
    </svg>
  )
}
/** a rating as five stars, to the half */
export function Stars({ value, size = 14 }: { value: number; size?: number | string }) {
  const v = Math.round(value * 2) / 2
  return <span className="game-stars">{[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size={size} fill={v >= i + 1 ? 1 : v >= i + 0.5 ? 0.5 : 0} />)}</span>
}
