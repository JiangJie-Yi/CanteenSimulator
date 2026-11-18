// Those living upstairs (item 339, the owner's, 2026-11-18: 「2樓有點太隨便，員工上樓也得呈現」): what they're doing up there by the clock, and
// their way up the stair and down it, beat by beat. Pure rules; the room (shops/grill/DormRoom) draws them, the shop's walks (Roasting's
// crew) say when they set foot on the stair.

/** asleep from four in the morning (the shop shuts at half past four: in bed as soon as they're up) till eleven; the rest of the day at rest */
export const SLEEP_FROM = 4 * 60
export const SLEEP_TO = 11 * 60
export type DormDoing = 'sleep' | 'rest'
export function dormDoing(minute: number): DormDoing {
  const m = ((minute % 1440) + 1440) % 1440
  return m >= SLEEP_FROM && m < SLEEP_TO ? 'sleep' : 'rest'
}

/** the climb up the stair or down it (s); the walk between the stair's head and their place (the room's metres a second); sitting down onto
 * it or getting up off it (s) */
export const CLIMB_S = 1.6
export const WALK_MPS = 0.8
export const SETTLE_S = 0.5

/** coming up, `t` seconds after setting foot on the stair (`walk`: how far from the stair's head to their place): climbing (k 0..1 up it),
 * walking to their place, settling onto it, or there */
export function upBeat(t: number, walk: number): { phase: 'climb' | 'walk' | 'settle' | 'there'; k: number } {
  if (t < CLIMB_S) return { phase: 'climb', k: Math.max(0, t) / CLIMB_S }
  const w = Math.max(0.01, walk) / WALK_MPS
  if (t < CLIMB_S + w) return { phase: 'walk', k: (t - CLIMB_S) / w }
  if (t < CLIMB_S + w + SETTLE_S) return { phase: 'settle', k: (t - CLIMB_S - w) / SETTLE_S }
  return { phase: 'there', k: 1 }
}
/** going down, `t` seconds after setting off: up off their place, the walk to the stair's head, down it (k 0..1 down), then gone */
export function downBeat(t: number, walk: number): { phase: 'rise' | 'walk' | 'climb' | 'gone'; k: number } {
  if (t < SETTLE_S) return { phase: 'rise', k: Math.max(0, t) / SETTLE_S }
  const w = Math.max(0.01, walk) / WALK_MPS
  if (t < SETTLE_S + w) return { phase: 'walk', k: (t - SETTLE_S) / w }
  if (t < SETTLE_S + w + CLIMB_S) return { phase: 'climb', k: (t - SETTLE_S - w) / CLIMB_S }
  return { phase: 'gone', k: 1 }
}
/** how long going down takes, walk and all */
export const downLength = (walk: number) => SETTLE_S + Math.max(0.01, walk) / WALK_MPS + CLIMB_S

/** whether one living in is upstairs: up the stair since they last came down (`cameUp`: through the staff door at the day's end, the shop
 * not shut yet till the last of them is out); else the shop shut, unless they're still walking out to the staff door downstairs; open, only
 * while still on their way down (`downFor`: seconds since they set off, null if they never did, being at work since before) */
export function upstairs(open: boolean, walkingOut: boolean, downFor: number | null, downTotal: number, cameUp = false): boolean {
  if (cameUp) return true
  if (!open) return !walkingOut
  return downFor !== null && downFor < downTotal
}
