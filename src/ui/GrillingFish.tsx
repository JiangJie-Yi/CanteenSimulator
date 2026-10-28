import { FISH_EMBLEM } from './fishEmblem'

/**
 * The loading screen's emblem (scripts/fish-emblem.py): a salt-grilled ayu on its bamboo skewer over flames in a gold-ringed medallion. It
 * cooks as the shop loads: `done` (0..1) takes it from raw to golden, the grill's bars searing in and the salt coming up white.
 */
export function GrillingFish({ done = 0 }: { done?: number }) {
  return <div className="fish-emblem-wrap" style={{ '--done': Math.max(0, Math.min(1, done)) } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: FISH_EMBLEM }} />
}
